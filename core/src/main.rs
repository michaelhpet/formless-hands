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
#[command(name = "formless-hands", about = "Autonomous coding-agent orchestrator")]
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
    /// Manage registered agents.
    Agent {
        #[command(subcommand)]
        cmd: AgentCmd,
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
enum AgentCmd {
    Create {
        name: String,
        #[arg(long, default_value = "")]
        description: String,
        #[arg(long, default_value = "")]
        system_prompt: String,
        #[arg(long, default_value = "")]
        model: String,
    },
    List,
    Update {
        name: String,
        #[arg(long)]
        description: Option<String>,
        #[arg(long)]
        system_prompt: Option<String>,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        enabled: Option<bool>,
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
        Cmd::Agent { cmd } => match cmd {
            AgentCmd::Create {
                name,
                description,
                system_prompt,
                model,
            } => {
                if !projects::valid_name(&name) {
                    anyhow::bail!("invalid name '{name}' — use letters, digits, '-', '_' or '.'");
                }
                let conn = open_db()?;
                if db::get_agent_by_name(&conn, &name)?.is_some() {
                    anyhow::bail!("agent '{name}' already exists");
                }
                let id = db::insert_agent(
                    &conn,
                    &models::NewAgent {
                        name: &name,
                        description: &description,
                        system_prompt: &system_prompt,
                        model: &model,
                    },
                )?;
                println!("created agent '{name}' (#{id})");
            }
            AgentCmd::List => {
                let conn = open_db()?;
                for a in db::list_agents(&conn)? {
                    let state = if a.enabled { "on" } else { "off" };
                    println!("{:<16} {:<4} {:<16} {}", a.name, state, a.model, a.description);
                }
            }
            AgentCmd::Update {
                name,
                description,
                system_prompt,
                model,
                enabled,
            } => {
                let conn = open_db()?;
                if db::update_agent(
                    &conn,
                    &name,
                    description.as_deref(),
                    system_prompt.as_deref(),
                    model.as_deref(),
                    enabled,
                )? {
                    println!("updated agent '{name}'");
                } else {
                    anyhow::bail!("no agent named '{name}'");
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

async fn run_loops(cfg: config::Config) -> Result<()> {
    tracing::info!("tick: poll -> triage -> work -> watch (single pass, v0)");
    poller::poll_once().await?;
    triage::triage_once(&cfg).await?;
    worker::work_once(&cfg).await?;
    watcher::watch_once(&cfg).await?;
    ipc::serve(&cfg).await?;
    Ok(())
}
