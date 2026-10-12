use crate::{config, db, models, poller, projects, sources};
use anyhow::{Context, Result};
use axum::{
    extract::{Path, Query},
    http::{header, HeaderName, StatusCode},
    routing::{get, post},
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
    page: Option<i64>,
}

pub fn router() -> Router {
    Router::new()
        .route("/api/projects", get(api_projects).post(api_project_create))
        .route("/api/projects/{name}", get(api_project))
        .route("/api/projects/{name}/poll", post(api_project_poll))
        .route("/api/sources", get(api_sources).post(api_source_create))
        .route(
            "/api/sources/{id}",
            get(api_source)
                .patch(api_source_update)
                .delete(api_source_delete),
        )
        .route("/api/tasks", get(api_tasks).post(api_task_create))
        .route("/api/tasks/{id}", get(api_task).patch(api_task_update))
        .route("/api/tasks/{id}/reviews", get(api_reviews).post(api_review_create))
        .route("/api/works", get(api_works))
        .route("/api/works/{id}", get(api_work))
        .route("/api/config", get(api_config).put(api_config_save))
        .route("/", get(index))
        .route("/{*path}", get(asset))
}

pub async fn serve_with_shutdown(
    cfg: &crate::config::Config,
    shutdown: impl std::future::Future<Output = ()> + Send + 'static,
) -> Result<()> {
    let conn = db::connect()?;
    db::migrate(&conn)?;
    drop(conn);
    let app = router();
    let addr = format!("127.0.0.1:{}", cfg.server.port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .with_context(|| format!("bind {addr}"))?;
    tracing::info!(%addr, "serving gui + api");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await?;
    Ok(())
}

async fn api_projects() -> Result<Json<Vec<models::Project>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    db::list_projects(&conn)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_project(Path(name): Path<String>) -> Result<Json<models::Project>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match db::get_project_by_name(&conn, &name).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Some(p) => Ok(Json(p)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct CreateProject {
    repo: String,
    path: Option<String>,
}

async fn api_project_create(
    Json(body): Json<CreateProject>,
) -> Result<(StatusCode, Json<models::Project>), (StatusCode, String)> {
    if body.repo.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "repo must not be empty".to_string()));
    }
    let planned = projects::plan_add(&body.repo, body.path.as_deref())
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let project = {
        let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
        match projects::find_existing(&conn, &planned) {
            Ok(Some(p)) => p,
            Ok(None) => projects::insert_planned(&conn, &planned)
                .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?,
            Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, String::new())),
        }
    };
    let state = projects::connect_planned(&planned, &project.default_branch).await;
    let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    projects::write_connection(&conn, project.id, &state)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    let project = db::get_project_by_name(&conn, &project.name)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    Ok((StatusCode::CREATED, Json(project)))
}

async fn api_project_poll(
    Path(name): Path<String>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let project_id = {
        let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
        db::get_project_by_name(&conn, &name)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
            .map(|p| p.id)
            .ok_or((StatusCode::NOT_FOUND, format!("no project named '{name}'")))?
    };
    let totals = poller::poll_project(project_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(serde_json::json!({ "sources": totals.sources, "upserted": totals.upserted })))
}

async fn api_sources() -> Result<Json<Vec<models::TaskSource>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    db::list_sources(&conn, None)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_source(Path(id): Path<i64>) -> Result<Json<models::TaskSource>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match db::get_source(&conn, id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Some(s) => Ok(Json(s)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct CreateSource {
    project: String,
    kind: String,
    config: Option<std::collections::HashMap<String, String>>,
    url: Option<String>,
}

async fn api_source_create(
    Json(body): Json<CreateSource>,
) -> Result<(StatusCode, Json<models::TaskSource>), (StatusCode, String)> {
    if body.url.is_some() && body.config.as_ref().is_some_and(|c| !c.is_empty()) {
        return Err((StatusCode::BAD_REQUEST, "pass either url or config, not both".to_string()));
    }
    let pairs: Vec<(String, String)> = body.config.unwrap_or_default().into_iter().collect();
    let (config_json, _) = sources::resolve_config(&body.kind, &pairs, body.url.as_deref())
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    let project_id = {
        let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
        db::get_project_by_name(&conn, &body.project)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
            .map(|p| p.id)
            .ok_or((StatusCode::NOT_FOUND, format!("no project named '{}'", body.project)))?
    };
    let planned = sources::PlannedSource {
        project_id,
        kind: body.kind.clone(),
        config_json,
    };
    let id = {
        let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
        if sources::is_duplicate(&conn, &planned)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        {
            return Err((StatusCode::CONFLICT, "that source already exists for this project".to_string()));
        }
        sources::insert_planned(&conn, &planned)
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
    };
    if let Some(err) = sources::ping_if_linear(&planned.kind).await {
        let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
        let _ = db::set_source_error(&conn, id, &err);
    }
    let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    let source = db::get_source(&conn, id)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    Ok((StatusCode::CREATED, Json(source)))
}

#[derive(Deserialize)]
struct UpdateSource {
    enabled: bool,
}

async fn api_source_update(
    Path(id): Path<i64>,
    Json(body): Json<UpdateSource>,
) -> Result<Json<models::TaskSource>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if !db::set_source_enabled(&conn, id, body.enabled).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        return Err(StatusCode::NOT_FOUND);
    }
    match db::get_source(&conn, id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Some(s) => Ok(Json(s)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn api_source_delete(Path(id): Path<i64>) -> Result<StatusCode, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if db::remove_source(&conn, id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
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
    let limit = q.limit.unwrap_or(20);
    if !(1..=500).contains(&limit) {
        return Err(StatusCode::BAD_REQUEST);
    }
    let page = q.page.unwrap_or(1);
    if page < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }
    let offset = (page - 1) * limit;
    db::list_tasks(&conn, project_id, q.status.as_deref(), limit, offset)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_task(Path(id): Path<i64>) -> Result<Json<models::Task>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match db::get_task(&conn, id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Some(t) => Ok(Json(t)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

#[derive(Deserialize)]
struct CreateTask {
    project: String,
    title: String,
    body: Option<String>,
    priority: Option<i64>,
}

async fn api_task_create(
    Json(body): Json<CreateTask>,
) -> Result<(StatusCode, Json<models::Task>), (StatusCode, String)> {
    if body.title.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "title must not be empty".to_string()));
    }
    let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    let project_id = db::get_project_by_name(&conn, &body.project)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .map(|p| p.id)
        .ok_or((StatusCode::NOT_FOUND, format!("no project named '{}'", body.project)))?;
    let id = db::insert_task(
        &conn,
        &models::NewTask {
            project_id,
            task_source_id: None,
            external_id: None,
            url: "",
            title: body.title.trim(),
            body: body.body.as_deref().unwrap_or(""),
            priority: body.priority.unwrap_or(0),
        },
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    let task = db::get_task(&conn, id)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    Ok((StatusCode::CREATED, Json(task)))
}

#[derive(Deserialize)]
struct UpdateTask {
    status: Option<String>,
    priority: Option<i64>,
    instructions: Option<String>,
}

async fn api_task_update(
    Path(id): Path<i64>,
    Json(body): Json<UpdateTask>,
) -> Result<Json<models::Task>, (StatusCode, String)> {
    if let Some(s) = &body.status {
        if !models::status::valid(s) {
            return Err((
                StatusCode::BAD_REQUEST,
                format!(
                    "invalid status '{s}' — one of: {}",
                    models::status::ALL.join(", ")
                ),
            ));
        }
    }
    if body.status.is_none() && body.priority.is_none() && body.instructions.is_none() {
        return Err((StatusCode::BAD_REQUEST, "nothing to update".to_string()));
    }
    let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    if !db::update_task(&conn, id, body.status.as_deref(), body.priority, body.instructions.as_deref())
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
    {
        return Err((StatusCode::NOT_FOUND, format!("no task #{id}")));
    }
    let task = db::get_task(&conn, id)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    Ok(Json(task))
}

#[derive(Deserialize)]
struct WorkQuery {
    project: Option<String>,
    limit: Option<i64>,
    page: Option<i64>,
}

async fn api_works(
    Query(q): Query<WorkQuery>,
) -> Result<Json<Vec<models::Work>>, StatusCode> {
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
    let limit = q.limit.unwrap_or(20);
    if !(1..=500).contains(&limit) {
        return Err(StatusCode::BAD_REQUEST);
    }
    let page = q.page.unwrap_or(1);
    if page < 1 {
        return Err(StatusCode::BAD_REQUEST);
    }
    db::list_works(&conn, project_id, limit, (page - 1) * limit)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_work(Path(id): Path<i64>) -> Result<Json<models::Work>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    match db::get_work(&conn, id).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)? {
        Some(w) => Ok(Json(w)),
        None => Err(StatusCode::NOT_FOUND),
    }
}

async fn api_config() -> Result<Json<config::Config>, (StatusCode, String)> {
    config::load().map(Json).map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn api_config_save(
    Json(body): Json<config::Config>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    config::save(&body).map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;
    Ok(Json(serde_json::json!({ "saved": true, "restart_required": true })))
}

fn task_missing(conn: &rusqlite::Connection, id: i64) -> Result<bool, StatusCode> {
    db::get_task(conn, id)
        .map(|t| t.is_none())
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn api_reviews(
    Path(id): Path<i64>,
) -> Result<Json<Vec<models::ReviewComment>>, StatusCode> {
    let conn = db::connect().map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    if task_missing(&conn, id)? {
        return Err(StatusCode::NOT_FOUND);
    }
    db::list_reviews(&conn, id)
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

#[derive(Deserialize)]
struct CreateReview {
    author: Option<String>,
    body: String,
    path: Option<String>,
    kind: Option<String>,
    resolved: Option<bool>,
}

async fn api_review_create(
    Path(id): Path<i64>,
    Json(body): Json<CreateReview>,
) -> Result<(StatusCode, Json<models::ReviewComment>), (StatusCode, String)> {
    let kind = body.kind.as_deref().unwrap_or(models::review_kind::COMMENT);
    if !models::review_kind::valid(kind) {
        return Err((
            StatusCode::BAD_REQUEST,
            format!(
                "invalid kind '{kind}' — one of: {}",
                models::review_kind::ALL.join(", ")
            ),
        ));
    }
    if body.body.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "body must not be empty".to_string()));
    }
    let conn = db::connect().map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    if task_missing(&conn, id).map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))? {
        return Err((StatusCode::NOT_FOUND, format!("no task #{id}")));
    }
    let resolved = body
        .resolved
        .unwrap_or(kind != models::review_kind::CHANGES);
    let author = body.author.unwrap_or_else(|| "human".to_string());
    let author = author.trim();
    let author = if author.is_empty() { "human" } else { author };
    let review_id = db::insert_review(
        &conn,
        id,
        author,
        body.body.trim(),
        body.path.as_deref().unwrap_or(""),
        kind,
        resolved,
    )
    .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    let review = db::list_reviews(&conn, id)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, String::new()))?
        .into_iter()
        .find(|r| r.id == review_id)
        .ok_or((StatusCode::INTERNAL_SERVER_ERROR, String::new()))?;
    Ok((StatusCode::CREATED, Json(review)))
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
