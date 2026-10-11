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

pub async fn triage_once(_cfg: &Config) -> Result<()> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    let mut promoted = 0usize;
    let mut unblocked = 0usize;
    let mut parked = 0usize;
    let mut waiting = 0usize;
    let mut needs_context = 0usize;
    let mut blocked = 0usize;

    for task in db::list_tasks(&conn, None, Some(models::status::OPEN), 500, 0)? {
        if linear::backoff_active(&task.backoff_until) {
            waiting += 1;
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

    tracing::info!(
        promoted,
        needs_context,
        blocked,
        unblocked,
        parked,
        waiting,
        "triage: judged open and blocked tasks"
    );
    Ok(())
}
