mod config;
mod db;
mod ipc;
mod models;
mod poller;
mod projects;
mod triage;
mod watcher;
mod worker;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(about = "Autonomous coding-agent orchestrator")]
struct Cli {
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Run the background service (poll -> triage -> work -> watch loop).
    Run,
    /// Manage tracked projects (repository + task sources).
    Project {
        #[command(subcommand)]
        cmd: ProjectCmd,
    },
    /// Manage task sources (where a project's tasks are pulled from).
    Source {
        #[command(subcommand)]
        cmd: SourceCmd,
    },
    /// Manage tasks.
    Task {
        #[command(subcommand)]
        cmd: TaskCmd,
    },
}

#[derive(Subcommand)]
enum ProjectCmd {
    Add {
        url: String,
        #[arg(long)]
        name: Option<String>,
        #[arg(long)]
        path: Option<String>,
    },
    List,
    Remove {
        name: String,
    },
}

#[derive(Subcommand)]
enum SourceCmd {
    Add {
        #[arg(long)]
        project: String,
        #[arg(long)]
        kind: String,
        #[arg(long, short = 's')]
        set: Vec<String>,
    },
    List {
        #[arg(long)]
        project: Option<String>,
    },
    Remove {
        id: i64,
    },
    Enable {
        id: i64,
    },
    Disable {
        id: i64,
    },
}

#[derive(Subcommand)]
enum TaskCmd {
    Create {
        title: String,
        #[arg(long)]
        project: String,
        #[arg(long, default_value = "")]
        body: String,
        #[arg(long, default_value = "0")]
        priority: i64,
    },
    List {
        #[arg(long)]
        project: Option<String>,
        #[arg(long)]
        status: Option<String>,
        #[arg(long, default_value = "20")]
        limit: i64,
    },
    Update {
        id: i64,
        #[arg(long)]
        status: Option<String>,
        #[arg(long)]
        priority: Option<i64>,
        #[arg(long)]
        instructions: Option<String>,
    },
}

fn open_db() -> Result<rusqlite::Connection> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    Ok(conn)
}

fn project_id_by_name(conn: &rusqlite::Connection, name: &str) -> Result<i64> {
    Ok(db::get_project_by_name(conn, name)?
        .with_context(|| format!("no project named '{name}'"))?
        .id)
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();
    match cli.cmd {
        Cmd::Run => {
            let cfg = config::load()?;
            drop(open_db()?);
            tracing::info!("formless-hands starting");
            run_loops(cfg).await?;
        }
        Cmd::Project { cmd } => match cmd {
            ProjectCmd::Add { url, name, path } => {
                let conn = open_db()?;
                let name = match name {
                    Some(n) => {
                        if !projects::valid_name(&n) {
                            anyhow::bail!("invalid name '{n}' — use letters, digits, '-', '_' or '.'");
                        }
                        n
                    }
                    None => projects::derive_name(&url)?,
                };
                let project = match db::get_project_by_name(&conn, &name)? {
                    Some(r) => r,
                    None => match db::get_project_by_remote(&conn, url.trim())? {
                        Some(r) => r,
                        None => {
                            let id = db::insert_project(
                                &conn,
                                &models::NewProject {
                                    name: &name,
                                    remote_url: url.trim(),
                                    local_path: path.as_deref().unwrap_or(""),
                                },
                            )?;
                            db::get_project_by_name(&conn, &name)?
                                .context(format!("project #{id} vanished"))?
                        }
                    },
                };
                let project = projects::ensure_local(&conn, &project).await?;
                println!("{} [{}] {}", project.name, project.status, project.local_path);
                if project.status == models::project_status::ERROR {
                    eprintln!("{}", project.status_detail);
                    std::process::exit(1);
                }
            }
            ProjectCmd::List => {
                let conn = open_db()?;
                for r in db::list_projects(&conn)? {
                    println!("{:<16} {:<12} {}", r.name, r.status, r.local_path);
                }
            }
            ProjectCmd::Remove { name } => {
                let conn = open_db()?;
                if db::remove_project(&conn, &name)? {
                    println!("removed {name} (checkout left on disk)");
                } else {
                    anyhow::bail!("no project named '{name}'");
                }
            }
        },
        Cmd::Source { cmd } => match cmd {
            SourceCmd::Add { project, kind, set } => {
                if !models::source_kind::valid(&kind) {
                    anyhow::bail!(
                        "invalid kind '{kind}' — one of: {}",
                        models::source_kind::ALL.join(", ")
                    );
                }
                let conn = open_db()?;
                let project_id = project_id_by_name(&conn, &project)?;
                let mut map = serde_json::Map::new();
                for kv in &set {
                    let (k, v) = kv.split_once('=').with_context(|| {
                        format!("bad --set '{kv}' — expected key=value")
                    })?;
                    map.insert(k.to_string(), serde_json::Value::String(v.to_string()));
                }
                let config_json = serde_json::Value::Object(map).to_string();
                let duplicate = db::list_sources(&conn, Some(project_id))?
                    .into_iter()
                    .any(|s| s.kind == kind && s.config_json == config_json);
                if duplicate {
                    anyhow::bail!("that source already exists for project '{project}'");
                }
                let id = db::insert_source(
                    &conn,
                    &models::NewTaskSource {
                        project_id,
                        kind: &kind,
                        config_json: &config_json,
                    },
                )?;
                println!("created source #{id} ({kind})");
            }
            SourceCmd::List { project } => {
                let conn = open_db()?;
                let project_id = match project {
                    Some(name) => Some(project_id_by_name(&conn, &name)?),
                    None => None,
                };
                for s in db::list_sources(&conn, project_id)? {
                    let state = if s.enabled { "on" } else { "off" };
                    let owner = db::get_project_by_id(&conn, s.project_id)?
                        .map(|p| p.name)
                        .unwrap_or_else(|| format!("#{}", s.project_id));
                    println!(
                        "{:<5} {:<12} {:<8} {:<4} {}",
                        s.id, owner, s.kind, state, s.config_json
                    );
                }
            }
            SourceCmd::Remove { id } => {
                let conn = open_db()?;
                if db::remove_source(&conn, id)? {
                    println!("removed source #{id}");
                } else {
                    anyhow::bail!("no source #{id}");
                }
            }
            SourceCmd::Enable { id } => {
                let conn = open_db()?;
                if db::set_source_enabled(&conn, id, true)? {
                    println!("enabled source #{id}");
                } else {
                    anyhow::bail!("no source #{id}");
                }
            }
            SourceCmd::Disable { id } => {
                let conn = open_db()?;
                if db::set_source_enabled(&conn, id, false)? {
                    println!("disabled source #{id}");
                } else {
                    anyhow::bail!("no source #{id}");
                }
            }
        },
        Cmd::Task { cmd } => match cmd {
            TaskCmd::Create {
                title,
                project,
                body,
                priority,
            } => {
                let conn = open_db()?;
                let project_id = project_id_by_name(&conn, &project)?;
                let id = db::insert_task(
                    &conn,
                    &models::NewTask {
                        project_id,
                        task_source_id: None,
                        external_id: None,
                        url: "",
                        title: &title,
                        body: &body,
                        priority,
                    },
                )?;
                println!("created task #{id}");
            }
            TaskCmd::List { project, status, limit } => {
                let conn = open_db()?;
                let project_id = match project {
                    Some(name) => Some(project_id_by_name(&conn, &name)?),
                    None => None,
                };
                if let Some(s) = &status {
                    if !models::status::valid(s) {
                        anyhow::bail!(
                            "invalid status '{s}' — one of: {}",
                            models::status::ALL.join(", ")
                        );
                    }
                }
                for t in db::list_tasks(&conn, project_id, status.as_deref(), limit)? {
                    let source = t.source_kind.as_deref().unwrap_or("");
                    println!("{:<5} {:<10} {:<12} {}", t.id, t.status, source, t.title);
                }
            }
            TaskCmd::Update {
                id,
                status,
                priority,
                instructions,
            } => {
                if let Some(s) = &status {
                    if !models::status::valid(s) {
                        anyhow::bail!(
                            "invalid status '{s}' — one of: {}",
                            models::status::ALL.join(", ")
                        );
                    }
                }
                let conn = open_db()?;
                if db::update_task(
                    &conn,
                    id,
                    status.as_deref(),
                    priority,
                    instructions.as_deref(),
                )? {
                    println!("updated task #{id}");
                } else {
                    anyhow::bail!("no task #{id}");
                }
            }
        },
    }
    Ok(())
}

async fn pipeline_tick(cfg: &config::Config) {
    let start = std::time::Instant::now();
    tracing::info!("tick=pipeline start");
    if let Err(e) = poller::poll_once().await {
        tracing::error!(error = %e, "tick=pipeline poll failed");
        return;
    }
    if let Err(e) = triage::triage_once(cfg).await {
        tracing::error!(error = %e, "tick=pipeline triage failed");
        return;
    }
    if let Err(e) = worker::work_once(cfg).await {
        tracing::error!(error = %e, "tick=pipeline worker failed");
    }
    tracing::info!(elapsed_ms = start.elapsed().as_millis(), "tick=pipeline done");
}

async fn watch_tick(cfg: &config::Config) {
    let start = std::time::Instant::now();
    tracing::info!("tick=watch start");
    if let Err(e) = watcher::watch_once(cfg).await {
        tracing::error!(error = %e, "tick=watch failed");
    }
    tracing::info!(elapsed_ms = start.elapsed().as_millis(), "tick=watch done");
}

async fn run_loops(cfg: config::Config) -> Result<()> {
    use std::sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    };
    use tokio_cron_scheduler::{Job, JobScheduler};

    let poll_schedule = config::normalize_cron("poll_cron", &cfg.service.poll_cron)?;
    let watch_schedule = config::normalize_cron("watch_cron", &cfg.service.watch_cron)?;

    let mut sched = JobScheduler::new().await.context("start cron scheduler")?;

    let pipeline_guard: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
    let watch_guard: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));

    {
        let cfg = cfg.clone();
        let poll_cron = cfg.service.poll_cron.clone();
        let guard = Arc::clone(&pipeline_guard);
        let job = Job::new_async(poll_schedule.as_str(), move |_uuid, _lock| {
            let cfg = cfg.clone();
            let guard = Arc::clone(&guard);
            Box::pin(async move {
                if guard.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                    tracing::info!("tick=pipeline skipped (previous run still active)");
                    return;
                }
                pipeline_tick(&cfg).await;
                guard.store(false, Ordering::SeqCst);
            })
        })
        .with_context(|| {
            format!(
                "bad poll_cron '{}' — expected cron like \"0 0 * * * *\"",
                poll_cron
            )
        })?;
        sched.add(job).await.context("schedule poll job")?;
    }

    {
        let cfg = cfg.clone();
        let watch_cron = cfg.service.watch_cron.clone();
        let guard = Arc::clone(&watch_guard);
        let job = Job::new_async(watch_schedule.as_str(), move |_uuid, _lock| {
            let cfg = cfg.clone();
            let guard = Arc::clone(&guard);
            Box::pin(async move {
                if guard.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                    tracing::info!("tick=watch skipped (previous run still active)");
                    return;
                }
                watch_tick(&cfg).await;
                guard.store(false, Ordering::SeqCst);
            })
        })
        .with_context(|| {
            format!(
                "bad watch_cron '{}' — expected cron like \"0 */2 * * * *\"",
                watch_cron
            )
        })?;
        sched.add(job).await.context("schedule watch job")?;
    }

    sched.start().await.context("run cron scheduler")?;
    tracing::info!(
        poll = %cfg.service.poll_cron,
        watch = %cfg.service.watch_cron,
        "scheduler started (UTC)"
    );

    ipc::serve_with_shutdown(&cfg, async {
        if tokio::signal::ctrl_c().await.is_err() {
            tracing::error!("shutdown signal handler failed");
        }
    })
    .await?;

    tracing::info!("shutting down scheduler");
    sched.shutdown().await.context("stop cron scheduler")?;
    tracing::info!("formless-hands stopped");
    Ok(())
}
