use crate::{db, linear, models};
use anyhow::{Context, Result};
use rusqlite::Connection;

pub struct PlannedSource {
    pub project_id: i64,
    pub kind: String,
    pub config_json: String,
}

pub async fn resolve_config(
    kind: &str,
    set: &[(String, String)],
    url: Option<&str>,
) -> Result<(String, Option<String>)> {
    if !models::source_kind::valid(kind) {
        anyhow::bail!(
            "invalid kind '{kind}' — one of: {}",
            models::source_kind::ALL.join(", ")
        );
    }
    if kind != models::source_kind::LINEAR && url.is_some() {
        anyhow::bail!("--url is only supported for linear sources");
    }
    if url.is_some() && !set.is_empty() {
        anyhow::bail!("pass either url or key=value pairs, not both");
    }
    let mut map = serde_json::Map::new();
    let mut notice = None;
    if let Some(link) = url {
        match linear::parse_linear_url(link)? {
            linear::UrlScope::Team(team) => {
                map.insert("team".to_string(), serde_json::Value::String(team));
            }
            linear::UrlScope::Project(uuid) => {
                let (name, teams) = linear::resolve_project(&uuid).await?;
                if teams.len() > 1 {
                    notice = Some(format!(
                        "project spans {} teams — scoping to {}",
                        teams.len(),
                        teams[0]
                    ));
                }
                map.insert(
                    "team".to_string(),
                    serde_json::Value::String(teams[0].clone()),
                );
                map.insert("project".to_string(), serde_json::Value::String(name));
            }
        }
    }
    for (k, v) in set {
        map.insert(k.clone(), serde_json::Value::String(v.clone()));
    }
    Ok((serde_json::Value::Object(map).to_string(), notice))
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
