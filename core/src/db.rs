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

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Connection {
        let path = std::env::temp_dir().join(format!(
            "fh-test-{}-{}.sqlite",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap_or(0)
        ));
        connect_at(&path).expect("test db")
    }

    #[test]
    fn repoll_updates_content_but_keeps_local_status() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO projects (name, remote_url) VALUES ('p', 'file:///p')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_sources (project_id, kind, config_json) VALUES (1, 'linear', '{}')",
            [],
        )
        .unwrap();
        fn task(title: &str) -> PolledTask<'_> {
            PolledTask {
                project_id: 1,
                task_source_id: 1,
                external_id: "ENG-1",
                url: "https://linear.app/i/1",
                title,
                body: "b",
                priority: 3,
                labels_json: "[\"bug\"]",
            }
        }
        upsert_polled_task(&conn, &task("first")).unwrap();
        conn.execute("UPDATE tasks SET status = 'in-progress' WHERE id = 1", [])
            .unwrap();
        upsert_polled_task(&conn, &task("second")).unwrap();
        let (title, status): (String, String) = conn
            .query_row("SELECT title, status FROM tasks WHERE id = 1", [], |r| {
                Ok((r.get(0)?, r.get(1)?))
            })
            .unwrap();
        assert_eq!(title, "second");
        assert_eq!(status, "in-progress");
    }

    #[test]
    fn source_backoff_roundtrip() {
        let conn = test_db();
        conn.execute(
            "INSERT INTO projects (name, remote_url) VALUES ('p', 'file:///p')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_sources (project_id, kind, config_json) VALUES (1, 'linear', '{}')",
            [],
        )
        .unwrap();
        set_source_backoff(&conn, 1, "2099-01-01T00:00:00Z", "busy").unwrap();
        let s = list_enabled_sources(&conn).unwrap().pop().unwrap();
        assert_eq!(s.backoff_count, 1);
        assert_eq!(s.last_error, "busy");
        set_source_polled(&conn, 1, "abc").unwrap();
        let s = list_enabled_sources(&conn).unwrap().pop().unwrap();
        assert_eq!(s.backoff_count, 0);
        assert_eq!(s.backoff_until, "");
        assert_eq!(s.last_error, "");
        assert_eq!(s.cursor, "abc");
    }
}
