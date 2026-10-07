use crate::db;
use anyhow::Result;

pub async fn poll_once() -> Result<()> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    let mut polled = 0;
    for source in db::list_enabled_sources(&conn)? {
        let project = db::get_project_by_id(&conn, source.project_id)?;
        let project_name = project.as_ref().map(|p| p.name.as_str()).unwrap_or("?");
        polled += 1;
        tracing::info!(source = source.id, kind = %source.kind, project = %project_name, "poller: fetch open tickets");
    }
    tracing::info!(polled, "poller: upsert open tasks");
    Ok(())
}
