mod config;
mod db;
mod ipc;
mod linear;
mod models;
mod sources;
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
        repo: String,
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
        #[arg(long)]
        url: Option<String>,
    },
    List {
        #[arg(long)]
        project: String,
    },
    Remove {
        id: i64,
        #[arg(long)]
        project: String,
    },
    Enable {
        id: i64,
        #[arg(long)]
        project: String,
    },
    Disable {
        id: i64,
        #[arg(long)]
        project: String,
    },
    Poll {
        #[arg(long)]
        project: String,
        id: Option<i64>,
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
        project: String,
        #[arg(long)]
        status: Option<String>,
        #[arg(long, default_value = "20")]
        limit: i64,
    },
    Update {
        id: i64,
        #[arg(long)]
        project: String,
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

fn daemon_lock() -> Result<std::fs::File> {
    let path = crate::config::expand_home("~/.local/share/formless-hands/daemon.lock");
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)
            .with_context(|| format!("create {}", dir.display()))?;
    }
    let file = std::fs::File::create(&path)
        .with_context(|| format!("open {}", path.display()))?;
    try_lock(&file).with_context(|| {
        "another daemon is already running (could not lock daemon.lock)"
    })?;
    Ok(file)
}

fn try_lock(file: &std::fs::File) -> Result<()> {
    use fs2::FileExt;
    file.try_lock_exclusive()
        .map_err(|_| anyhow::anyhow!("locked by another process"))
}

fn project_id_by_name(conn: &rusqlite::Connection, name: &str) -> Result<i64> {
    Ok(db::get_project_by_name(conn, name)?
        .with_context(|| format!("no project named '{name}'"))?
        .id)
}

fn require_task_in_project(conn: &rusqlite::Connection, id: i64, project: &str) -> Result<()> {
    let want = project_id_by_name(conn, project)?;
    match db::task_project_id(conn, id)? {
        Some(got) if got == want => Ok(()),
        Some(_) => anyhow::bail!("task #{id} is not in project '{project}'"),
        None => anyhow::bail!("no task #{id}"),
    }
}

fn require_source_in_project(conn: &rusqlite::Connection, id: i64, project: &str) -> Result<()> {
    let want = project_id_by_name(conn, project)?;
    match db::get_source(conn, id)? {
        Some(s) if s.project_id == want => Ok(()),
        Some(_) => anyhow::bail!("source #{id} is not in project '{project}'"),
        None => anyhow::bail!("no source #{id}"),
    }
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
            let _lock = daemon_lock()?;
            tracing::info!("formless-hands starting");
            run_loops(cfg).await?;
        }
        Cmd::Project { cmd } => match cmd {
            ProjectCmd::Add { repo, path } => {
                let conn = open_db()?;
                let project = projects::add_project(&conn, &repo, path.as_deref()).await?;
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
            SourceCmd::Add { project, kind, set, url } => {
                let conn = open_db()?;
                let project_id = project_id_by_name(&conn, &project)?;
                let pairs = sources::parse_set(&set)?;
                let (config_json, notice) =
                    sources::resolve_config(&kind, &pairs, url.as_deref()).await?;
                if let Some(n) = notice {
                    println!("{n}");
                }
                let planned = sources::PlannedSource {
                    project_id,
                    kind: kind.clone(),
                    config_json,
                };
                if sources::is_duplicate(&conn, &planned)? {
                    anyhow::bail!("that source already exists for project '{project}'");
                }
                let id = sources::insert_planned(&conn, &planned)?;
                match sources::ping_if_linear(&kind).await {
                    None if kind == models::source_kind::LINEAR => {
                        println!("created source #{id} ({kind}) — Linear reachable")
                    }
                    None => println!("created source #{id} ({kind})"),
                    Some(err) => {
                        let _ = db::set_source_error(&conn, id, &err);
                        eprintln!("created source #{id} ({kind}) but Linear is unreachable:");
                        eprintln!("{err}");
                        std::process::exit(1);
                    }
                }
            }
            SourceCmd::List { project } => {
                let conn = open_db()?;
                let project_id = project_id_by_name(&conn, &project)?;
                for s in db::list_sources(&conn, Some(project_id))? {
                    let state = if s.enabled { "on" } else { "off" };
                    let owner = db::get_project_by_id(&conn, s.project_id)?
                        .map(|p| p.name)
                        .unwrap_or_else(|| format!("#{}", s.project_id));
                    let err: String = s.last_error.lines().next().unwrap_or("").chars().take(100).collect();
                    if err.is_empty() {
                        println!(
                            "{:<5} {:<12} {:<8} {:<4} {}",
                            s.id, owner, s.kind, state, s.config_json
                        );
                    } else {
                        println!(
                            "{:<5} {:<12} {:<8} {:<4} {}  ! {err}",
                            s.id, owner, s.kind, state, s.config_json
                        );
                    }
                }
            }
            SourceCmd::Remove { id, project } => {
                let conn = open_db()?;
                require_source_in_project(&conn, id, &project)?;
                db::remove_source(&conn, id)?;
                println!("removed source #{id}");
            }
            SourceCmd::Enable { id, project } => {
                let conn = open_db()?;
                require_source_in_project(&conn, id, &project)?;
                db::set_source_enabled(&conn, id, true)?;
                println!("enabled source #{id}");
            }
            SourceCmd::Disable { id, project } => {
                let conn = open_db()?;
                require_source_in_project(&conn, id, &project)?;
                db::set_source_enabled(&conn, id, false)?;
                println!("disabled source #{id}");
            }
            SourceCmd::Poll { project, id } => {
                let conn = open_db()?;
                let project_id = project_id_by_name(&conn, &project)?;
                drop(conn);
                match id {
                    Some(i) => {
                        {
                            let conn = open_db()?;
                            require_source_in_project(&conn, i, &project)?;
                        }
                        match poller::poll_single(i).await? {
                            poller::Outcome::Synced(n) => {
                                println!("source #{i}: synced ({n} open issues)")
                            }
                            poller::Outcome::Skipped(reason) => {
                                println!("source #{i}: skipped ({reason})")
                            }
                            poller::Outcome::Failed(msg) => {
                                eprintln!("source #{i}: {msg}");
                                std::process::exit(1);
                            }
                        }
                    }
                    None => {
                        let totals = poller::poll_project(project_id).await?;
                        println!(
                            "polled {} source(s), {} open issue(s)",
                            totals.sources, totals.upserted
                        );
                    }
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
                let project_id = project_id_by_name(&conn, &project)?;
                if let Some(s) = &status {
                    if !models::status::valid(s) {
                        anyhow::bail!(
                            "invalid status '{s}' — one of: {}",
                            models::status::ALL.join(", ")
                        );
                    }
                }
                for t in db::list_tasks(&conn, Some(project_id), status.as_deref(), limit, 0)? {
                    let source = t.source_kind.as_deref().unwrap_or("");
                    println!("{:<5} {:<10} {:<12} {}", t.id, t.status, source, t.title);
                }
            }
            TaskCmd::Update {
                id,
                project,
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
                require_task_in_project(&conn, id, &project)?;
                db::update_task(
                    &conn,
                    id,
                    status.as_deref(),
                    priority,
                    instructions.as_deref(),
                )?;
                println!("updated task #{id}");
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
