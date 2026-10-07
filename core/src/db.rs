use crate::models::{NewProject, NewTask, NewTaskSource, Project, Task, TaskSource};
use anyhow::{Context, Result};
use rusqlite::Connection;
use std::fs;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  remote_url  TEXT NOT NULL UNIQUE,
  local_path  TEXT NOT NULL DEFAULT '',
  default_branch TEXT NOT NULL DEFAULT 'main',
  status      TEXT NOT NULL DEFAULT 'unconnected',
  status_detail TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS task_sources (
  id          INTEGER PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id),
  kind        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  last_polled_at TEXT,
  cursor      TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(project_id, kind, config_json)
);
CREATE TABLE IF NOT EXISTS tasks (
  id            INTEGER PRIMARY KEY,
  project_id    INTEGER NOT NULL REFERENCES projects(id),
  task_source_id INTEGER REFERENCES task_sources(id),
  external_id   TEXT,
  url           TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '',
  labels        TEXT NOT NULL DEFAULT '[]',
  instructions  TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'open',
  priority      INTEGER NOT NULL DEFAULT 0,
  locked        INTEGER NOT NULL DEFAULT 0,
  pr_number     INTEGER,
  branch        TEXT NOT NULL DEFAULT '',
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_source_id, external_id)
);
CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id),
  worktree_path TEXT NOT NULL DEFAULT '',
  branch      TEXT NOT NULL DEFAULT '',
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  exit_code   INTEGER,
  log_path    TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS review_comments (
  id        INTEGER PRIMARY KEY,
  task_id   INTEGER NOT NULL REFERENCES tasks(id),
  author    TEXT NOT NULL DEFAULT '',
  body      TEXT NOT NULL DEFAULT '',
  path      TEXT NOT NULL DEFAULT '',
  resolved  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

pub fn connect() -> Result<Connection> {
    let path = crate::config::expand_home("~/.local/share/formless-hands/database.sqlite");
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

pub fn list_tasks(
    conn: &Connection,
    project_id: Option<i64>,
    status: Option<&str>,
    limit: i64,
) -> Result<Vec<Task>> {
    let mut st = conn.prepare(
        "SELECT t.id, t.project_id, t.task_source_id, s.kind, t.external_id,
           t.title, t.status, t.priority, t.pr_number
         FROM tasks t LEFT JOIN task_sources s ON s.id = t.task_source_id
         WHERE (?1 IS NULL OR t.project_id = ?1) AND (?2 IS NULL OR t.status = ?2)
         ORDER BY t.priority DESC, t.id ASC LIMIT ?3",
    )?;
    let rows = st.query_map((project_id, status, limit), |r| {
        Ok(Task {
            id: r.get(0)?,
            project_id: r.get(1)?,
            task_source_id: r.get(2)?,
            source_kind: r.get(3)?,
            external_id: r.get(4)?,
            title: r.get(5)?,
            status: r.get(6)?,
            priority: r.get(7)?,
            pr_number: r.get(8)?,
        })
    })?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn insert_task(conn: &Connection, task: &NewTask) -> Result<i64> {
    conn.execute(
        "INSERT INTO tasks (project_id, task_source_id, external_id, url, title, body, priority)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            task.project_id,
            task.task_source_id,
            task.external_id,
            task.url,
            task.title,
            task.body,
            task.priority
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_task(
    conn: &Connection,
    id: i64,
    status: Option<&str>,
    priority: Option<i64>,
    instructions: Option<&str>,
) -> Result<bool> {
    let mut sets: Vec<String> = Vec::new();
    let mut vals: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(v) = status {
        sets.push("status = ?".to_string());
        vals.push(Box::new(v.to_string()));
    }
    if let Some(v) = priority {
        sets.push("priority = ?".to_string());
        vals.push(Box::new(v));
    }
    if let Some(v) = instructions {
        sets.push(
            "instructions = CASE WHEN instructions = '' THEN ? ELSE instructions || '\n\n' || ? END"
                .to_string(),
        );
        vals.push(Box::new(v.to_string()));
        vals.push(Box::new(v.to_string()));
    }
    if sets.is_empty() {
        anyhow::bail!("nothing to update — pass --status, --priority, or --instructions");
    }
    sets.push("updated_at = datetime('now')".to_string());
    let sql = format!("UPDATE tasks SET {} WHERE id = ?{}", sets.join(", "), vals.len() + 1);
    vals.push(Box::new(id));
    let refs: Vec<&dyn rusqlite::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
    Ok(conn.execute(&sql, refs.as_slice())? > 0)
}

pub fn insert_project(conn: &Connection, project: &NewProject) -> Result<i64> {
    conn.execute(
        "INSERT INTO projects (name, remote_url, local_path)
         VALUES (?1, ?2, ?3)",
        [project.name, project.remote_url, project.local_path],
    )?;
    Ok(conn.last_insert_rowid())
}

fn project_row(r: &rusqlite::Row) -> rusqlite::Result<Project> {
    Ok(Project {
        id: r.get(0)?,
        name: r.get(1)?,
        remote_url: r.get(2)?,
        local_path: r.get(3)?,
        default_branch: r.get(4)?,
        status: r.get(5)?,
        status_detail: r.get(6)?,
    })
}

const PROJECT_COLS: &str = "id, name, remote_url, local_path, default_branch, status, status_detail";

pub fn list_projects(conn: &Connection) -> Result<Vec<Project>> {
    let sql = format!("SELECT {PROJECT_COLS} FROM projects ORDER BY name");
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([], project_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn get_project_by_id(conn: &Connection, id: i64) -> Result<Option<Project>> {
    let sql = format!("SELECT {PROJECT_COLS} FROM projects WHERE id = ?1");
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([id], project_row)?;
    Ok(rows.next().transpose()?)
}

pub fn get_project_by_name(conn: &Connection, name: &str) -> Result<Option<Project>> {
    let sql = format!("SELECT {PROJECT_COLS} FROM projects WHERE name = ?1");
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([name], project_row)?;
    Ok(rows.next().transpose()?)
}

pub fn get_project_by_remote(conn: &Connection, remote_url: &str) -> Result<Option<Project>> {
    let sql = format!("SELECT {PROJECT_COLS} FROM projects WHERE remote_url = ?1");
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([remote_url], project_row)?;
    Ok(rows.next().transpose()?)
}

pub fn set_project_connection(
    conn: &Connection,
    id: i64,
    local_path: &str,
    default_branch: &str,
    status: &str,
    status_detail: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE projects SET local_path = ?1, default_branch = ?2, status = ?3,
           status_detail = ?4, updated_at = datetime('now') WHERE id = ?5",
        rusqlite::params![local_path, default_branch, status, status_detail, id],
    )?;
    Ok(())
}

pub fn remove_project(conn: &Connection, name: &str) -> Result<bool> {
    Ok(conn.execute("DELETE FROM projects WHERE name = ?1", [name])? > 0)
}

fn source_row(r: &rusqlite::Row) -> rusqlite::Result<TaskSource> {
    Ok(TaskSource {
        id: r.get(0)?,
        project_id: r.get(1)?,
        kind: r.get(2)?,
        enabled: r.get::<_, i64>(3)? != 0,
        last_polled_at: r.get(4)?,
        cursor: r.get(5)?,
        config_json: r.get(6)?,
    })
}

const SOURCE_COLS: &str =
    "id, project_id, kind, enabled, last_polled_at, cursor, config_json";

pub fn insert_source(conn: &Connection, source: &NewTaskSource) -> Result<i64> {
    conn.execute(
        "INSERT INTO task_sources (project_id, kind, config_json) VALUES (?1, ?2, ?3)",
        rusqlite::params![source.project_id, source.kind, source.config_json],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn list_sources(conn: &Connection, project_id: Option<i64>) -> Result<Vec<TaskSource>> {
    let sql = format!(
        "SELECT {SOURCE_COLS} FROM task_sources
         WHERE (?1 IS NULL OR project_id = ?1) ORDER BY project_id, kind"
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([project_id], source_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn list_enabled_sources(conn: &Connection) -> Result<Vec<TaskSource>> {
    let sql = format!(
        "SELECT {SOURCE_COLS} FROM task_sources WHERE enabled != 0 ORDER BY project_id, kind"
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map([], source_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn set_source_enabled(conn: &Connection, id: i64, enabled: bool) -> Result<bool> {
    Ok(conn.execute(
        "UPDATE task_sources SET enabled = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![if enabled { 1i64 } else { 0i64 }, id],
    )? > 0)
}

pub fn remove_source(conn: &Connection, id: i64) -> Result<bool> {
    Ok(conn.execute("DELETE FROM task_sources WHERE id = ?1", [id])? > 0)
}
