use crate::{db, linear, models};
use anyhow::{Context, Result};
use rusqlite::Connection;

pub struct PlannedSource {
    pub project_id: i64,
    pub kind: String,
    pub config_json: String,
}

pub fn resolve_config(kind: &str, set: &[(String, String)]) -> Result<String> {
    if !models::source_kind::valid(kind) {
        anyhow::bail!(
            "invalid kind '{kind}' — one of: {}",
            models::source_kind::ALL.join(", ")
        );
    }
    let mut map = serde_json::Map::new();
    for (k, v) in set {
        map.insert(k.clone(), serde_json::Value::String(v.clone()));
    }
    Ok(serde_json::Value::Object(map).to_string())
}

pub fn parse_set(set: &[String]) -> Result<Vec<(String, String)>> {
    set.iter()
        .map(|kv| {
            let (k, v) = kv.split_once('=').with_context(|| {
                format!("bad --set '{kv}' — expected key=value")
            })?;
            Ok((k.to_string(), v.to_string()))
        })
        .collect()
}

pub fn is_duplicate(conn: &Connection, planned: &PlannedSource) -> Result<bool> {
    Ok(db::list_sources(conn, Some(planned.project_id))?
        .into_iter()
        .any(|s| s.kind == planned.kind && s.config_json == planned.config_json))
}

pub fn insert_planned(conn: &Connection, planned: &PlannedSource) -> Result<i64> {
    db::insert_source(
        conn,
        &models::NewTaskSource {
            project_id: planned.project_id,
            kind: &planned.kind,
            config_json: &planned.config_json,
        },
    )
}

pub async fn ping_if_linear(kind: &str) -> Option<String> {
    if kind != models::source_kind::LINEAR {
        return None;
    }
    linear::ping().await.err().map(|e| e.to_string())
}
