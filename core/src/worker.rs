use crate::config::Config;
use anyhow::Result;

pub async fn work_once(cfg: &Config) -> Result<()> {
    tracing::info!(
        max_workers = cfg.service.max_concurrent_workers,
        "worker: claim triaged task and run opencode (stub)"
    );
    Ok(())
}
