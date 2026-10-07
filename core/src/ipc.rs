use crate::{db, models};
use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query},
    http::{header, HeaderName, StatusCode},
    routing::get,
    Json, Router,
};
use serde::Deserialize;

#[cfg(not(gui_stub))]
static GUI: include_dir::Dir<'_> = include_dir::include_dir!("$CARGO_MANIFEST_DIR/gui/dist");

#[cfg(gui_stub)]
const STUB: &str = "<!doctype html><title>formless-hands</title><h1>formless-hands</h1><p>Frontend not built — run `bun run build` in gui/ then rebuild.</p>";

#[cfg(not(gui_stub))]
const STUB: &str = "<!doctype html><title>formless-hands</title><h1>formless-hands</h1><p>Page not found.</p>";

type Page = ([(HeaderName, &'static str); 1], Vec<u8>);

#[derive(Deserialize)]
struct TaskQuery {
    project: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

pub async fn serve(cfg: &crate::config::Config) -> Result<()> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    drop(conn);
    let app = Router::new()
        .route("/api/projects", get(api_projects))
        .route("/api/sources", get(api_sources))
        .route("/api/tasks", get(api_tasks))
        .route("/", get(index))
        .route("/{*path}", get(asset));
    let addr = format!("127.0.0.1:{}", cfg.server.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "serving gui + api");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn api_projects() -> Result<Json<Vec<models::Project>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    db::list_projects(&conn)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_sources() -> Result<Json<Vec<models::TaskSource>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    db::list_sources(&conn, None)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_tasks(
    Query(q): Query<TaskQuery>,
) -> Result<Json<Vec<models::Task>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let project_id = match q.project {
        Some(name) => match db::get_project_by_name(&conn, &name)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        {
            Some(r) => Some(r.id),
            None => return Err(StatusCode::NOT_FOUND),
        },
        None => None,
    };
    if let Some(s) = &q.status {
        if !models::status::valid(s) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }
    db::list_tasks(&conn, project_id, q.status.as_deref(), q.limit.unwrap_or(20))
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "map" => "application/json",
        "txt" => "text/plain; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn stub_page() -> Page {
    (
        [(header::CONTENT_TYPE, "text/html; charset=utf-8")],
        STUB.as_bytes().to_vec(),
    )
}

fn spa_bytes(path: &str) -> Option<Page> {
    #[cfg(not(gui_stub))]
    {
        GUI.get_file(path).map(|f| {
            (
                [(header::CONTENT_TYPE, content_type(path))],
                f.contents().to_vec(),
            )
        })
    }
    #[cfg(gui_stub)]
    {
        let _ = path;
        None
    }
}

async fn index() -> Page {
    spa_bytes("index.html").unwrap_or_else(stub_page)
}

async fn asset(Path(path): Path<String>) -> Page {
    let path = path.trim_start_matches('/');
    if path.is_empty() {
        return index().await;
    }
    spa_bytes(path)
        .or_else(|| spa_bytes("index.html"))
        .unwrap_or_else(stub_page)
}
