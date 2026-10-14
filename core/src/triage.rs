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

#[derive(Debug, Default, Clone)]
pub struct TriageStats {
    pub promoted: usize,
    pub unblocked: usize,
    pub parked: usize,
    pub waiting: usize,
    pub needs_context: usize,
    pub blocked: usize,
    pub recovered: usize,
    pub running: usize,
    pub waiting_on_deps: usize,
}

fn judge_single(conn: &rusqlite::Connection, task: &models::Task) -> Result<Option<String>> {
    if linear::backoff_active(&task.backoff_until) {
        return Ok(None);
    }
    if task.status != models::status::OPEN
        && task.status != models::status::BLOCKED
        && task.status != models::status::NEEDS_CONTEXT
    {
        return Ok(None);
    }
    let deps_open = db::dependency_statuses(conn, task.id)?
        .into_iter()
        .any(|(_, status)| status != models::status::MERGED && status != models::status::CLOSED);
    if deps_open {
        return Ok(None);
    }
    if task.status != models::status::OPEN
        && content_hash(task) == task.decision_hash
        && !task.decision_hash.is_empty()
    {
        return Ok(None);
    }
    let hash = content_hash(task);
    let next = match rule_judge(task) {
        Judgment::Actionable => models::status::TRIAGED.to_string(),
        Judgment::NeedsContext(note) => {
            db::record_decision(conn, task.id, models::status::NEEDS_CONTEXT, &note, &hash)?;
            return Ok(Some(models::status::NEEDS_CONTEXT.to_string()));
        }
        Judgment::Blocked(note) => {
            db::record_decision(conn, task.id, models::status::BLOCKED, &note, &hash)?;
            return Ok(Some(models::status::BLOCKED.to_string()));
        }
    };
    db::record_decision(conn, task.id, &next, "", &hash)?;
    Ok(Some(next))
}

pub fn retriage_task(id: i64) -> Result<Option<String>> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    let Some(task) = db::get_task(&conn, id)? else {
        return Ok(None);
    };
    let previous = task.status.clone();
    let project_id = task.project_id;
    let next = judge_single(&conn, &task)?;
    if let Some(ref status) = next {
        if status != &previous {
            crate::events::publish(
                "triage.promoted",
                Some(project_id),
                Some(id),
                None,
                format!("task #{id} {previous} -> {status}"),
            );
        }
    }
    Ok(next)
}

pub async fn triage_once(cfg: &Config) -> Result<TriageStats> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    let stuck_after = (cfg.service.work_timeout_secs * 2) as i64;
    let mut stats = TriageStats::default();

    for task in db::list_tasks(&conn, None, Some(models::status::OPEN), 500, 0)? {
        if linear::backoff_active(&task.backoff_until) {
            stats.waiting += 1;
            continue;
        }
        let deps_open = db::dependency_statuses(&conn, task.id)?
            .into_iter()
            .any(|(_, status)| status != models::status::MERGED && status != models::status::CLOSED);
        if deps_open {
            stats.waiting_on_deps += 1;
            continue;
        }
        let hash = content_hash(&task);
        match rule_judge(&task) {
            Judgment::Actionable => {
                db::record_decision(&conn, task.id, models::status::TRIAGED, "", &hash)?;
                stats.promoted += 1;
                crate::events::publish(
                    "triage.promoted",
                    Some(task.project_id),
                    Some(task.id),
                    None,
                    format!("task #{} promoted to triaged", task.id),
                );
            }
            Judgment::NeedsContext(note) => {
                db::record_decision(&conn, task.id, models::status::NEEDS_CONTEXT, &note, &hash)?;
                stats.needs_context += 1;
            }
            Judgment::Blocked(note) => {
                db::record_decision(&conn, task.id, models::status::BLOCKED, &note, &hash)?;
                stats.blocked += 1;
            }
        }
    }

    for status in [models::status::BLOCKED, models::status::NEEDS_CONTEXT] {
        for task in db::list_tasks(&conn, None, Some(status), 500, 0)? {
            if linear::backoff_active(&task.backoff_until) {
                stats.waiting += 1;
                continue;
            }
            if content_hash(&task) == task.decision_hash && !task.decision_hash.is_empty() {
                stats.parked += 1;
                continue;
            }
            let previous = task.status.clone();
            match rule_judge(&task) {
                Judgment::Actionable => {
                    let hash = content_hash(&task);
                    db::record_decision(&conn, task.id, models::status::TRIAGED, "", &hash)?;
                    tracing::info!(task = task.id, was = %previous, "triage: re-reviewed actionable");
                    stats.unblocked += 1;
                    crate::events::publish(
                        "triage.promoted",
                        Some(task.project_id),
                        Some(task.id),
                        None,
                        format!("task #{} {previous} -> triaged", task.id),
                    );
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
                stats.recovered += 1;
            }
            Some(w) if agent_alive(w.pid) => {
                stats.running += 1;
            }
            Some(w) => {
                let old = work_age_secs(&w.started_at).unwrap_or(i64::MAX);
                if old < stuck_after {
                    continue;
                }
                db::finish_work(&conn, w.id, -2)?;
                db::requeue_task(&conn, task.id)?;
                tracing::warn!(task = task.id, work = w.id, age_secs = old, "triage: reaped dead work");
                stats.recovered += 1;
            }
        }
    }

    tracing::info!(
        promoted = stats.promoted,
        needs_context = stats.needs_context,
        blocked = stats.blocked,
        unblocked = stats.unblocked,
        parked = stats.parked,
        waiting = stats.waiting,
        waiting_on_deps = stats.waiting_on_deps,
        recovered = stats.recovered,
        running = stats.running,
        "triage: judged open and blocked tasks"
    );
    Ok(stats)
}
