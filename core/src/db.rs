use crate::models::{NewProject, NewTask, NewTaskSource, Project, Task, TaskSource, Work};
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
  backoff_until TEXT NOT NULL DEFAULT '',
  backoff_count INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT NOT NULL DEFAULT '',
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
  backoff_until TEXT NOT NULL DEFAULT '',
  backoff_count INTEGER NOT NULL DEFAULT 0,
  decision_at   TEXT NOT NULL DEFAULT '',
  decision_note TEXT NOT NULL DEFAULT '',
  decision_hash TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE TABLE IF NOT EXISTS works (
  id          INTEGER PRIMARY KEY,
  task_id     INTEGER NOT NULL REFERENCES tasks(id),
  worktree_path TEXT NOT NULL DEFAULT '',
  branch      TEXT NOT NULL DEFAULT '',
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  exit_code   INTEGER,
  log_path    TEXT NOT NULL DEFAULT '',
  session_id  TEXT
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

pub fn db_path() -> std::path::PathBuf {
    match std::env::var("FH_DB_PATH") {
        Ok(p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => crate::config::expand_home("~/.local/share/formless-hands/database.sqlite"),
    }
}

pub fn connect() -> Result<Connection> {
    connect_at(&db_path())
}

pub fn connect_at(path: &std::path::Path) -> Result<Connection> {
    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
        }
    }
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

fn task_row(r: &rusqlite::Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        project_id: r.get(1)?,
        task_source_id: r.get(2)?,
        source_kind: r.get(3)?,
        external_id: r.get(4)?,
        title: r.get(5)?,
        body: r.get(6)?,
        labels: r.get(7)?,
        instructions: r.get(8)?,
        status: r.get(9)?,
        priority: r.get(10)?,
        pr_number: r.get(11)?,
        branch: r.get(12)?,
        attempts: r.get(13)?,
        backoff_until: r.get(14)?,
        backoff_count: r.get(15)?,
        decision_at: r.get(16)?,
        decision_note: r.get(17)?,
        decision_hash: r.get(18)?,
    })
}

const TASK_COLS: &str = "t.id, t.project_id, t.task_source_id, s.kind, t.external_id,
    t.title, t.body, t.labels, t.instructions, t.status, t.priority, t.pr_number,
    t.branch, t.attempts, t.backoff_until, t.backoff_count,
    t.decision_at, t.decision_note, t.decision_hash";

pub fn list_tasks(
    conn: &Connection,
    project_id: Option<i64>,
    status: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<Vec<Task>> {
    let sql = format!(
        "SELECT {TASK_COLS}
         FROM tasks t LEFT JOIN task_sources s ON s.id = t.task_source_id
         WHERE (?1 IS NULL OR t.project_id = ?1) AND (?2 IS NULL OR t.status = ?2)
         ORDER BY t.priority DESC, t.id ASC LIMIT ?3 OFFSET ?4"
    );
    let mut st = conn.prepare(&sql)?;
    let rows = st.query_map((project_id, status, limit, offset), task_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn get_task(conn: &Connection, id: i64) -> Result<Option<Task>> {
    let sql = format!(
        "SELECT {TASK_COLS}
         FROM tasks t LEFT JOIN task_sources s ON s.id = t.task_source_id
         WHERE t.id = ?1"
    );
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([id], task_row)?;
    Ok(rows.next().transpose()?)
}

fn work_row(r: &rusqlite::Row) -> rusqlite::Result<Work> {
    Ok(Work {
        id: r.get(0)?,
        task_id: r.get(1)?,
        task_external_id: r.get(2)?,
        task_title: r.get(3)?,
        project_id: r.get(4)?,
        worktree_path: r.get(5)?,
        branch: r.get(6)?,
        started_at: r.get(7)?,
        finished_at: r.get(8)?,
        exit_code: r.get(9)?,
        log_path: r.get(10)?,
        session_id: r.get(11)?,
    })
}

pub fn list_works(
    conn: &Connection,
    project_id: Option<i64>,
    limit: i64,
    offset: i64,
) -> Result<Vec<Work>> {
    let mut st = conn.prepare(
        "SELECT w.id, w.task_id, t.external_id, t.title, t.project_id,
           w.worktree_path, w.branch, w.started_at, w.finished_at, w.exit_code, w.log_path,
           w.session_id
         FROM works w JOIN tasks t ON t.id = w.task_id
         WHERE (?1 IS NULL OR t.project_id = ?1)
         ORDER BY w.id DESC LIMIT ?2 OFFSET ?3",
    )?;
    let rows = st.query_map((project_id, limit, offset), work_row)?;
    Ok(rows.collect::<std::result::Result<Vec<_>, _>>()?)
}

pub fn get_work(conn: &Connection, id: i64) -> Result<Option<Work>> {
    let mut st = conn.prepare(
        "SELECT w.id, w.task_id, t.external_id, t.title, t.project_id,
           w.worktree_path, w.branch, w.started_at, w.finished_at, w.exit_code, w.log_path,
           w.session_id
         FROM works w JOIN tasks t ON t.id = w.task_id
         WHERE w.id = ?1",
    )?;
    let mut rows = st.query_map([id], work_row)?;
    Ok(rows.next().transpose()?)
}

pub fn record_decision(
    conn: &Connection,
    id: i64,
    status: &str,
    note: &str,
    hash: &str,
) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET status = ?1, decision_note = ?2, decision_hash = ?3,
           decision_at = datetime('now'), updated_at = datetime('now') WHERE id = ?4",
        rusqlite::params![status, note, hash, id],
    )?;
    Ok(())
}

pub fn claim_task(conn: &Connection, id: i64, branch: &str) -> Result<bool> {
    Ok(conn.execute(
        "UPDATE tasks SET status = 'in-progress', locked = 1, attempts = attempts + 1,
           branch = ?1, updated_at = datetime('now')
         WHERE id = ?2 AND status = 'triaged'",
        rusqlite::params![branch, id],
    )? > 0)
}

pub fn block_task(conn: &Connection, id: i64, error: &str) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET status = 'blocked', locked = 0, last_error = ?1,
           updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![error, id],
    )?;
    Ok(())
}

pub fn has_open_work(conn: &Connection) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM works WHERE finished_at IS NULL",
        [],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}

pub fn insert_work(
    conn: &Connection,
    task_id: i64,
    worktree_path: &str,
    branch: &str,
    log_path: &str,
) -> Result<i64> {
    conn.execute(
        "INSERT INTO works (task_id, worktree_path, branch, log_path)
          VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![task_id, worktree_path, branch, log_path],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn finish_work(conn: &Connection, id: i64, exit_code: i64) -> Result<()> {
    conn.execute(
        "UPDATE works SET finished_at = datetime('now'), exit_code = ?1 WHERE id = ?2",
        rusqlite::params![exit_code, id],
    )?;
    Ok(())
}

pub fn set_task_backoff(conn: &Connection, id: i64, until: &str) -> Result<()> {
    conn.execute(
        "UPDATE tasks SET backoff_until = ?1, backoff_count = backoff_count + 1,
           locked = 0, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![until, id],
    )?;
    Ok(())
}

pub fn set_work_session(conn: &Connection, id: i64, session_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE works SET session_id = ?1 WHERE id = ?2",
        rusqlite::params![session_id, id],
    )?;
    Ok(())
}

pub fn task_project_id(conn: &Connection, id: i64) -> Result<Option<i64>> {
    let mut st = conn.prepare("SELECT project_id FROM tasks WHERE id = ?1")?;
    let mut rows = st.query_map([id], |r| r.get(0))?;
    Ok(rows.next().transpose()?)
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

pub fn get_project_by_local_path(conn: &Connection, local_path: &str) -> Result<Option<Project>> {
    let sql = format!("SELECT {PROJECT_COLS} FROM projects WHERE local_path = ?1");
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([local_path], project_row)?;
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
        backoff_until: r.get(7)?,
        backoff_count: r.get(8)?,
        last_error: r.get(9)?,
    })
}

const SOURCE_COLS: &str =
    "id, project_id, kind, enabled, last_polled_at, cursor, config_json,
     backoff_until, backoff_count, last_error";

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

pub fn get_source(conn: &Connection, id: i64) -> Result<Option<TaskSource>> {
    let sql = format!("SELECT {SOURCE_COLS} FROM task_sources WHERE id = ?1");
    let mut st = conn.prepare(&sql)?;
    let mut rows = st.query_map([id], source_row)?;
    Ok(rows.next().transpose()?)
}

pub fn set_source_polled(conn: &Connection, id: i64, cursor: &str) -> Result<()> {
    conn.execute(
        "UPDATE task_sources SET last_polled_at = datetime('now'), cursor = ?1,
           backoff_until = '', backoff_count = 0, last_error = '',
           updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![cursor, id],
    )?;
    Ok(())
}

pub fn set_source_backoff(conn: &Connection, id: i64, until: &str, err: &str) -> Result<()> {
    conn.execute(
        "UPDATE task_sources SET backoff_until = ?1, backoff_count = backoff_count + 1,
           last_error = ?2, updated_at = datetime('now') WHERE id = ?3",
        rusqlite::params![until, err, id],
    )?;
    Ok(())
}

pub fn set_source_error(conn: &Connection, id: i64, err: &str) -> Result<()> {
    conn.execute(
        "UPDATE task_sources SET last_error = ?1, backoff_until = '', backoff_count = 0,
           updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![err, id],
    )?;
    Ok(())
}

pub struct PolledTask<'a> {
    pub project_id: i64,
    pub task_source_id: i64,
    pub external_id: &'a str,
    pub url: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub priority: i64,
    pub labels_json: &'a str,
}

pub fn upsert_polled_task(conn: &Connection, task: &PolledTask) -> Result<()> {
    conn.execute(
        "INSERT INTO tasks (project_id, task_source_id, external_id, url, title, body, priority, labels)
          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
          ON CONFLICT(task_source_id, external_id) DO UPDATE SET
            url = excluded.url, title = excluded.title, body = excluded.body,
            priority = excluded.priority, labels = excluded.labels,
            updated_at = datetime('now')",
        rusqlite::params![
            task.project_id,
            task.task_source_id,
            task.external_id,
            task.url,
            task.title,
            task.body,
            task.priority,
            task.labels_json
        ],
    )?;
    Ok(())
}
