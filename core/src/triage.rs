use crate::config::Config;
use anyhow::Result;

pub async fn triage_once(_cfg: &Config) -> Result<()> {
    tracing::info!("triage: prioritize open tasks (stub)");
    Ok(())
}
