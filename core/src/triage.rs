use crate::config::Config;
use crate::{db, linear, models};
use anyhow::Result;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

enum Judgment {
    Actionable,
    NeedsContext(String),
    Blocked(String),
}

fn content_hash(task: &models::Task) -> String {
    let mut hasher = DefaultHasher::new();
    (
        task.title.as_str(),
        task.body.as_str(),
        task.labels.as_str(),
        task.instructions.as_str(),
        task.priority,
    )
        .hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

fn rule_judge(task: &models::Task) -> Judgment {
    let labels: Vec<String> = serde_json::from_str(&task.labels).unwrap_or_default();
    if labels.iter().any(|l| l.eq_ignore_ascii_case("blocked")) {
        return Judgment::Blocked("labeled blocked upstream".to_string());
    }
    if task.body.trim().is_empty() && task.instructions.trim().is_empty() {
        return Judgment::NeedsContext(
            "no description — add context or instructions".to_string(),
        );
    }
    Judgment::Actionable
}

fn agent_alive(pid: Option<i64>) -> bool {
    let pid = match pid {
        Some(p) if p > 0 => p,
        _ => return false,
    };
    std::fs::read_to_string(format!("/proc/{pid}/cmdline"))
        .map(|cmd| cmd.contains("opencode"))
        .unwrap_or(false)
}

fn work_age_secs(started_at: &str) -> Option<i64> {
    let started = chrono::NaiveDateTime::parse_from_str(started_at, "%Y-%m-%d %H:%M:%S").ok()?;
    let now = chrono::Utc::now().naive_utc();
    Some((now - started).num_seconds().max(0))
}

pub async fn triage_once(cfg: &Config) -> Result<()> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    let stuck_after = (cfg.service.work_timeout_secs * 2) as i64;
    let mut promoted = 0usize;
    let mut unblocked = 0usize;
    let mut parked = 0usize;
    let mut waiting = 0usize;
    let mut needs_context = 0usize;
    let mut blocked = 0usize;
    let mut recovered = 0usize;
    let mut running = 0usize;
    let mut waiting_on_deps = 0usize;

    for task in db::list_tasks(&conn, None, Some(models::status::OPEN), 500, 0)? {
        if linear::backoff_active(&task.backoff_until) {
            waiting += 1;
            continue;
        }
        let deps_open = db::dependency_statuses(&conn, task.id)?
            .into_iter()
            .any(|(_, status)| status != models::status::MERGED && status != models::status::CLOSED);
        if deps_open {
            waiting_on_deps += 1;
            continue;
        }
        let hash = content_hash(&task);
        match rule_judge(&task) {
            Judgment::Actionable => {
                db::record_decision(&conn, task.id, models::status::TRIAGED, "", &hash)?;
                promoted += 1;
            }
            Judgment::NeedsContext(note) => {
                db::record_decision(&conn, task.id, models::status::NEEDS_CONTEXT, &note, &hash)?;
                needs_context += 1;
            }
            Judgment::Blocked(note) => {
                db::record_decision(&conn, task.id, models::status::BLOCKED, &note, &hash)?;
                blocked += 1;
            }
        }
    }

    for status in [models::status::BLOCKED, models::status::NEEDS_CONTEXT] {
        for task in db::list_tasks(&conn, None, Some(status), 500, 0)? {
            if linear::backoff_active(&task.backoff_until) {
                waiting += 1;
                continue;
            }
            if content_hash(&task) == task.decision_hash && !task.decision_hash.is_empty() {
                parked += 1;
                continue;
            }
            let previous = task.status.clone();
            match rule_judge(&task) {
                Judgment::Actionable => {
                    let hash = content_hash(&task);
                    db::record_decision(&conn, task.id, models::status::TRIAGED, "", &hash)?;
                    tracing::info!(task = task.id, was = %previous, "triage: re-reviewed actionable");
                    unblocked += 1;
                }
                Judgment::NeedsContext(note) => {
                    let hash = content_hash(&task);
                    db::record_decision(&conn, task.id, models::status::NEEDS_CONTEXT, &note, &hash)?;
                }
                Judgment::Blocked(note) => {
                    let hash = content_hash(&task);
                    db::record_decision(&conn, task.id, models::status::BLOCKED, &note, &hash)?;
                }
            }
        }
    }

    for task in db::list_tasks(&conn, None, Some(models::status::IN_PROGRESS), 500, 0)? {
        let work = db::open_work_for_task(&conn, task.id)?;
        match work {
            None => {
                db::requeue_task(&conn, task.id)?;
                tracing::info!(task = task.id, "triage: recovered orphan claim");
                recovered += 1;
            }
            Some(w) if agent_alive(w.pid) => {
                running += 1;
            }
            Some(w) => {
                let old = work_age_secs(&w.started_at).unwrap_or(i64::MAX);
                if old < stuck_after {
                    continue;
                }
                db::finish_work(&conn, w.id, -2)?;
                db::requeue_task(&conn, task.id)?;
                tracing::warn!(task = task.id, work = w.id, age_secs = old, "triage: reaped dead work");
                recovered += 1;
            }
        }
    }

    tracing::info!(
        promoted,
        needs_context,
        blocked,
        unblocked,
        parked,
        waiting,
        waiting_on_deps,
        recovered,
        running,
        "triage: judged open and blocked tasks"
    );
    Ok(())
}
