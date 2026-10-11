use crate::{db, linear};
use anyhow::{Context, Result};

pub struct PollTotals {
    pub sources: usize,
    pub upserted: usize,
}

pub enum Outcome {
    Skipped(String),
    Synced(usize),
    Failed(String),
}

async fn poll_one(source: &crate::models::TaskSource) -> Outcome {
    if source.kind != crate::models::source_kind::LINEAR {
        return Outcome::Skipped(format!("unsupported kind '{}'", source.kind));
    }
    match linear::poll_source(source).await {
        Ok(stats) => {
            let updated = db::connect().and_then(|conn| db::set_source_polled(&conn, source.id, &stats.cursor));
            match updated {
                Ok(()) => Outcome::Synced(stats.upserted),
                Err(e) => Outcome::Failed(format!("database write failed: {e}")),
            }
        }
        Err(linear::PollError::Fatal(msg)) => {
            if let Ok(conn) = db::connect() {
                let _ = db::set_source_error(&conn, source.id, &msg);
            }
            Outcome::Failed(msg)
        }
        Err(linear::PollError::Retryable(msg)) => {
            let delay = linear::backoff_delay_secs(source.backoff_count + 1);
            let until = linear::backoff_until_now_plus(delay);
            if let Ok(conn) = db::connect() {
                let _ = db::set_source_backoff(&conn, source.id, &until, &msg);
            }
            Outcome::Failed(format!("{msg} (backing off until {until})"))
        }
    }
}

async fn poll_many(sources: &[crate::models::TaskSource]) -> PollTotals {
    let mut totals = PollTotals { sources: 0, upserted: 0 };
    for source in sources {
        if linear::backoff_active(&source.backoff_until) {
            tracing::info!(source = source.id, until = %source.backoff_until, "poller: in backoff, skipping");
            continue;
        }
        match poll_one(source).await {
            Outcome::Synced(n) => {
                totals.sources += 1;
                totals.upserted += n;
                tracing::info!(source = source.id, upserted = n, "poller: synced open issues");
            }
            Outcome::Skipped(reason) => {
                tracing::info!(source = source.id, "{reason}, skipping");
            }
            Outcome::Failed(msg) => {
                tracing::error!(source = source.id, "{msg}");
            }
        }
    }
    tracing::info!(polled = totals.sources, upserted = totals.upserted, "poller: upsert open tasks");
    totals
}

fn enabled_sources() -> Result<Vec<crate::models::TaskSource>> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    Ok(db::list_enabled_sources(&conn)?)
}

pub async fn poll_once() -> Result<PollTotals> {
    Ok(poll_many(&enabled_sources()?).await)
}

pub async fn poll_project(project_id: i64) -> Result<PollTotals> {
    let sources: Vec<crate::models::TaskSource> = enabled_sources()?
        .into_iter()
        .filter(|s| s.project_id == project_id)
        .collect();
    Ok(poll_many(&sources).await)
}

pub async fn poll_single(id: i64) -> Result<Outcome> {
    let source = {
        let conn = db::connect()?;
        db::migrate(&conn)?;
        db::get_source(&conn, id)?.with_context(|| format!("no source #{id}"))?
    };
    if !source.enabled {
        anyhow::bail!("source #{id} is disabled — enable it first");
    }
    Ok(poll_one(&source).await)
}
