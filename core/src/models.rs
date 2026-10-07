use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub remote_url: String,
    pub local_path: String,
    pub default_branch: String,
    pub status: String,
    pub status_detail: String,
}

#[derive(Debug)]
pub struct NewProject<'a> {
    pub name: &'a str,
    pub remote_url: &'a str,
    pub local_path: &'a str,
}

#[allow(dead_code)]
pub mod project_status {
    pub const UNCONNECTED: &str = "unconnected";
    pub const CONNECTED: &str = "connected";
    pub const MISSING: &str = "missing";
    pub const ERROR: &str = "error";
}

#[derive(Debug, Clone, Serialize)]
#[allow(dead_code)]
pub struct TaskSource {
    pub id: i64,
    pub project_id: i64,
    pub kind: String,
    pub enabled: bool,
    pub last_polled_at: Option<String>,
    pub cursor: String,
    pub config_json: String,
}

#[derive(Debug)]
pub struct NewTaskSource<'a> {
    pub project_id: i64,
    pub kind: &'a str,
    pub config_json: &'a str,
}

#[allow(dead_code)]
pub mod source_kind {
    pub const LINEAR: &str = "linear";
    pub const GITHUB: &str = "github";

    pub const ALL: &[&str] = &[LINEAR, GITHUB];

    pub fn valid(s: &str) -> bool {
        ALL.contains(&s)
    }
}

#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct Task {
    pub id: i64,
    pub project_id: i64,
    pub task_source_id: Option<i64>,
    pub source_kind: Option<String>,
    pub external_id: Option<String>,
    pub title: String,
    pub status: String,
    pub priority: i64,
    pub pr_number: Option<i64>,
}

#[derive(Debug)]
pub struct NewTask<'a> {
    pub project_id: i64,
    pub task_source_id: Option<i64>,
    pub external_id: Option<&'a str>,
    pub url: &'a str,
    pub title: &'a str,
    pub body: &'a str,
    pub priority: i64,
}

#[allow(dead_code)]
pub mod status {
    pub const OPEN: &str = "open";
    pub const TRIAGED: &str = "triaged";
    pub const IN_PROGRESS: &str = "in-progress";
    pub const DEV_COMPLETE: &str = "dev-complete";
    pub const IN_REVIEW: &str = "in-review";
    pub const MERGED: &str = "merged";
    pub const CLOSED: &str = "closed";
    pub const BLOCKED: &str = "blocked";
    pub const NEEDS_CONTEXT: &str = "needs-context";

    pub const ALL: &[&str] = &[
        OPEN,
        TRIAGED,
        IN_PROGRESS,
        DEV_COMPLETE,
        IN_REVIEW,
        MERGED,
        CLOSED,
        BLOCKED,
        NEEDS_CONTEXT,
    ];

    pub fn valid(s: &str) -> bool {
        ALL.contains(&s)
    }
}
