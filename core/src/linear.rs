use anyhow::Result;
use serde::Deserialize;

const ENDPOINT: &str = "https://api.linear.app/graphql";
const MAX_PAGES: usize = 5;

const ISSUES_QUERY: &str = r#"query($teamKey: String!, $after: String) {
  issues(filter: { team: { key: { eq: $teamKey } } }, first: 50, after: $after, orderBy: updatedAt) {
    nodes {
      identifier title description url priority
      state { type }
      project { name }
      team { key }
      labels(first: 10) { nodes { name } }
      relations(first: 10) { nodes { type relatedIssue { identifier } } }
      inverseRelations(first: 10) { nodes { type issue { identifier } } }
    }
    pageInfo { hasNextPage endCursor }
  }
}"#;

#[derive(Debug)]
pub enum PollError {
    Fatal(String),
    Retryable(String),
}

impl std::fmt::Display for PollError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PollError::Fatal(m) | PollError::Retryable(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for PollError {}

pub struct Scope {
    pub team: String,
    pub project: Option<String>,
    pub label: Option<String>,
}

pub enum UrlScope {
    Team(String),
    Project(String),
}

pub fn parse_linear_url(raw: &str) -> Result<UrlScope> {
    let with_scheme = if raw.contains("://") {
        raw.to_string()
    } else {
        format!("https://{raw}")
    };
    let parsed = url::Url::parse(&with_scheme)
        .map_err(|_| anyhow::anyhow!("'{raw}' is not a Linear URL — expected https://linear.app/<workspace>/team/<KEY>/… or …/project/<slug>-<id>/…"))?;
    if parsed.host_str() != Some("linear.app") {
        anyhow::bail!("'{raw}' is not a Linear URL — expected a linear.app link");
    }
    let segs: Vec<&str> = parsed.path_segments().map(|s| s.collect()).unwrap_or_default();
    let pos = |name: &str| {
        segs.iter().position(|s| s.eq_ignore_ascii_case(name)).and_then(|i| segs.get(i + 1).copied())
    };
    if let Some(team) = pos("team") {
        let team = team.trim();
        if team.is_empty() {
            anyhow::bail!("'{raw}' has no team key after /team/");
        }
        return Ok(UrlScope::Team(team.to_string()));
    }
    if let Some(issue) = pos("issue") {
        let team = issue.split('-').next().map(str::trim).unwrap_or("");
        if team.is_empty() {
            anyhow::bail!("'{raw}' has no team prefix in the issue key");
        }
        return Ok(UrlScope::Team(team.to_string()));
    }
    if let Some(slug) = pos("project") {
        let id = slug.rsplit('-').next().map(str::trim).unwrap_or("");
        if id.is_empty() || !id.chars().all(|c| c.is_ascii_hexdigit()) {
            anyhow::bail!("'{raw}' has no project id after /project/<slug>-<id>/");
        }
        return Ok(UrlScope::Project(id.to_string()));
    }
    anyhow::bail!("'{raw}' is not a team, project, or issue URL — open the team or project in Linear and copy that link");
}

#[derive(Debug, Deserialize)]
struct ProjectData {
    project: ProjectNode,
}

#[derive(Debug, Default, Deserialize)]
struct ProjectNode {
    #[serde(default)]
    name: String,
    #[serde(default)]
    teams: TeamConnection,
}

#[derive(Debug, Default, Deserialize)]
struct TeamConnection {
    #[serde(default)]
    nodes: Vec<TeamNode>,
}

#[derive(Debug, Default, Deserialize)]
struct TeamNode {
    #[serde(default)]
    key: String,
}

pub async fn resolve_project(uuid: &str) -> Result<(String, Vec<String>)> {
    let key = api_key().map_err(|e| {
        anyhow::anyhow!("{e} — a key is needed to resolve the project in the link; otherwise use -s team=<KEY>")
    })?;
    let http = client().map_err(|e| anyhow::anyhow!("{e}"))?;
    let data: ProjectData = graphql(
        &http,
        &key,
        "query($id: String!) { project(id: $id) { name teams(first: 10) { nodes { key } } } }",
        serde_json::json!({ "id": uuid }),
        "project lookup",
    )
    .await
    .map_err(|e| anyhow::anyhow!("{e}"))?;
    let teams: Vec<String> = data
        .project
        .teams
        .nodes
        .into_iter()
        .map(|t| t.key)
        .filter(|k| !k.trim().is_empty())
        .collect();
    if data.project.name.trim().is_empty() || teams.is_empty() {
        anyhow::bail!("Linear returned no project for id '{uuid}' — check the link");
    }
    Ok((data.project.name, teams))
}

pub struct PollStats {
    pub upserted: usize,
    pub cursor: String,
}

#[derive(Debug, Deserialize)]
struct GraphResponse<T> {
    data: Option<T>,
    errors: Option<Vec<GraphError>>,
}

#[derive(Debug, Deserialize)]
struct GraphError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct ViewerData {
    viewer: Viewer,
}

#[derive(Debug, Deserialize)]
struct Viewer {
    id: String,
}

#[derive(Debug, Deserialize)]
struct IssuesData {
    issues: IssueConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IssueConnection {
    nodes: Vec<IssueNode>,
    page_info: PageInfo,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IssueNode {
    #[serde(default)]
    identifier: String,
    #[serde(default)]
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    url: String,
    #[serde(default)]
    priority: i64,
    #[serde(default)]
    state: Option<IssueState>,
    #[serde(default)]
    project: Option<IssueProject>,
    #[serde(default)]
    labels: Option<LabelConnection>,
    #[serde(default)]
    relations: Option<RelationConnection>,
    #[serde(default)]
    inverse_relations: Option<RelationConnection>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelationConnection {
    #[serde(default)]
    nodes: Vec<RelationNode>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelationNode {
    #[serde(default)]
    r#type: String,
    #[serde(default)]
    related_issue: Option<IssueRef>,
    #[serde(default)]
    issue: Option<IssueRef>,
}

#[derive(Debug, Default, Deserialize)]
struct IssueRef {
    #[serde(default)]
    identifier: String,
}

#[derive(Debug, Deserialize)]
struct IssueState {
    #[serde(default)]
    r#type: String,
}

#[derive(Debug, Deserialize)]
struct IssueProject {
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
struct LabelConnection {
    #[serde(default)]
    nodes: Vec<LabelNode>,
}

#[derive(Debug, Deserialize)]
struct LabelNode {
    #[serde(default)]
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageInfo {
    #[serde(default)]
    has_next_page: bool,
    #[serde(default)]
    end_cursor: Option<String>,
}

pub fn api_key() -> Result<String> {
    match std::env::var("LINEAR_API_KEY") {
        Ok(k) if !k.trim().is_empty() => Ok(k.trim().to_string()),
        _ => anyhow::bail!(
            "Linear request failed: no LINEAR_API_KEY in the environment — export LINEAR_API_KEY with a Linear personal API key and retry"
        ),
    }
}

pub fn task_priority(linear_priority: i64) -> i64 {
    match linear_priority {
        1 => 0,
        2 => 1,
        3 => 2,
        4 => 3,
        _ => 4,
    }
}

pub fn backoff_delay_secs(failures: i64) -> i64 {
    let shift = failures.clamp(1, 6) - 1;
    (60 << shift).min(1800)
}

pub fn backoff_until_now_plus(delay_secs: i64) -> String {
    (chrono::Utc::now() + chrono::Duration::seconds(delay_secs)).to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

pub fn backoff_active(backoff_until: &str) -> bool {
    if backoff_until.is_empty() {
        return false;
    }
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    backoff_until > now.as_str()
}

fn scope_of(source: &crate::models::TaskSource) -> Result<Scope, PollError> {
    let v: serde_json::Value = source.config_json.parse().map_err(|_| {
        PollError::Fatal(format!(
            "source #{}: config is not valid JSON — recreate it with `source add --project <name> --kind linear -s team=ENG`",
            source.id
        ))
    })?;
    let team = v
        .get("team")
        .and_then(|t| t.as_str())
        .map(str::trim)
        .filter(|t| !t.is_empty())
        .ok_or_else(|| {
            PollError::Fatal(format!(
                "source #{}: missing team scope — recreate it with -s team=ENG",
                source.id
            ))
        })?
        .to_string();
    let opt = |k: &str| {
        v.get(k)
            .and_then(|t| t.as_str())
            .map(str::trim)
            .filter(|t| !t.is_empty())
            .map(str::to_string)
    };
    Ok(Scope {
        team,
        project: opt("project"),
        label: opt("label"),
    })
}

fn client() -> Result<reqwest::Client, PollError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| PollError::Retryable(format!("Linear request failed: cannot build HTTP client ({e}) — will retry with backoff")))
}

async fn graphql<T: for<'de> Deserialize<'de>>(
    http: &reqwest::Client,
    key: &str,
    query: &str,
    variables: serde_json::Value,
    what: &str,
) -> Result<T, PollError> {
    let resp = http
        .post(ENDPOINT)
        .header("Authorization", key)
        .json(&serde_json::json!({ "query": query, "variables": variables }))
        .send()
        .await
        .map_err(|e| PollError::Retryable(format!("Linear request failed for {what}: {e} — will retry with backoff")))?;
    let status = resp.status();
    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = resp
            .headers()
            .get(reqwest::header::RETRY_AFTER)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<i64>().ok())
            .unwrap_or(60)
            .clamp(1, 1800);
        return Err(PollError::Retryable(format!(
            "Linear rate-limited the request for {what} (HTTP 429, retry after ~{retry_after}s) — will retry with backoff"
        )));
    }
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return Err(PollError::Fatal(format!(
            "Linear rejected the API key for {what} (HTTP {status}) — check that LINEAR_API_KEY is a valid Linear personal API key with access to the workspace"
        )));
    }
    if status.is_server_error() {
        return Err(PollError::Retryable(format!(
            "Linear returned HTTP {status} for {what} — will retry with backoff"
        )));
    }
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return Err(PollError::Fatal(format!(
            "Linear returned HTTP {status} for {what}: {}",
            body.chars().take(300).collect::<String>()
        )));
    }
    let parsed: GraphResponse<T> = resp.json().await.map_err(|e| {
        PollError::Retryable(format!("Linear returned an unreadable response for {what}: {e} — will retry with backoff"))
    })?;
    if let Some(errors) = parsed.errors {
        if !errors.is_empty() {
            let messages: Vec<String> = errors.into_iter().map(|e| e.message).collect();
            if messages.iter().any(|m| m.to_lowercase().contains("auth")) {
                return Err(PollError::Fatal(format!(
                    "Linear refused the request for {what}: {} — check LINEAR_API_KEY",
                    messages.join("; ")
                )));
            }
            return Err(PollError::Retryable(format!(
                "Linear returned errors for {what}: {} — will retry with backoff",
                messages.join("; ")
            )));
        }
    }
    parsed.data.ok_or_else(|| {
        PollError::Retryable(format!("Linear returned no data for {what} — will retry with backoff"))
    })
}

fn in_scope(node: &IssueNode, scope: &Scope) -> bool {
    if let Some(want) = &scope.project {
        if node.project.as_ref().map(|p| &p.name) != Some(want) {
            return false;
        }
    }
    if let Some(want) = &scope.label {
        let names: Vec<&str> = node
            .labels
            .as_ref()
            .map(|l| l.nodes.iter().map(|n| n.name.as_str()).collect())
            .unwrap_or_default();
        if !names.iter().any(|n| n.eq_ignore_ascii_case(want)) {
            return false;
        }
    }
    true
}

fn is_blocks(relation_type: &str) -> bool {
    relation_type
        .chars()
        .filter(|c| c.is_ascii_alphabetic())
        .collect::<String>()
        .eq_ignore_ascii_case("blocks")
}

fn sync_relations(
    conn: &rusqlite::Connection,
    source_id: i64,
    task_id: i64,
    node: &IssueNode,
) -> Result<()> {
    let mut blockers: Vec<i64> = Vec::new();
    if let Some(incoming) = &node.inverse_relations {
        for edge in &incoming.nodes {
            if !is_blocks(&edge.r#type) {
                continue;
            }
            let identifier = edge.issue.as_ref().map(|i| i.identifier.trim()).unwrap_or("");
            if identifier.is_empty() {
                continue;
            }
            if let Some(dep) = crate::db::task_id_by_external(conn, source_id, identifier)? {
                blockers.push(dep);
            }
        }
    }
    let mut outgoing: Vec<(i64, i64)> = Vec::new();
    if let Some(relations) = &node.relations {
        for edge in &relations.nodes {
            if !is_blocks(&edge.r#type) {
                continue;
            }
            let identifier = edge
                .related_issue
                .as_ref()
                .map(|i| i.identifier.trim())
                .unwrap_or("");
            if identifier.is_empty() {
                continue;
            }
            if let Some(other) = crate::db::task_id_by_external(conn, source_id, identifier)? {
                outgoing.push((other, task_id));
            }
        }
    }
    crate::db::set_synced_dependencies(conn, task_id, &blockers)?;
    for (dependent, blocker) in outgoing {
        if dependent == blocker {
            continue;
        }
        match crate::db::reaches(conn, blocker, dependent) {
            Ok(true) => {
                tracing::warn!(task = dependent, blocker, "linear: skipping cyclic blocks edge");
            }
            Err(e) => {
                tracing::warn!(task = dependent, "linear: edge check failed: {e:#}");
            }
            Ok(false) => {
                crate::db::add_dependency(conn, dependent, blocker, "linear")?;
            }
        }
    }
    Ok(())
}

fn is_open(node: &IssueNode) -> bool {
    !matches!(
        node.state.as_ref().map(|s| s.r#type.as_str()),
        Some("completed") | Some("cancelled") | Some("canceled")
    )
}

pub async fn ping() -> Result<()> {
    let key = api_key()?;
    let http = client().map_err(|e| anyhow::anyhow!("{e}"))?;
    let data: ViewerData = graphql(
        &http,
        &key,
        "query { viewer { id } }",
        serde_json::Value::Null,
        "connection check",
    )
    .await
    .map_err(|e| anyhow::anyhow!("{e}"))?;
    if data.viewer.id.trim().is_empty() {
        anyhow::bail!("Linear connection check failed: unexpected empty viewer id");
    }
    Ok(())
}

pub async fn poll_source(source: &crate::models::TaskSource) -> Result<PollStats, PollError> {
    let scope = scope_of(source)?;
    let key = api_key().map_err(|e| PollError::Fatal(e.to_string()))?;
    let http = client()?;
    let what = format!("source #{} (team {})", source.id, scope.team);
    let mut after: Option<String> = None;
    let mut collected: Vec<IssueNode> = Vec::new();
    let mut cursor = source.cursor.clone();
    for _ in 0..MAX_PAGES {
        let data: IssuesData = graphql(
            &http,
            &key,
            ISSUES_QUERY,
            serde_json::json!({ "teamKey": scope.team, "after": after }),
            &what,
        )
        .await?;
        for node in data.issues.nodes {
            if node.identifier.trim().is_empty() || !is_open(&node) || !in_scope(&node, &scope) {
                continue;
            }
            collected.push(node);
        }
        cursor = data.issues.page_info.end_cursor.clone().unwrap_or_default();
        if data.issues.page_info.has_next_page {
            after = data.issues.page_info.end_cursor;
        } else {
            break;
        }
    }
    let conn = crate::db::connect()
        .map_err(|e| PollError::Retryable(format!("database unavailable for {what}: {e} — will retry with backoff")))?;
    let db_error = |e: anyhow::Error| {
        PollError::Retryable(format!("database write failed for {what}: {e} — will retry with backoff"))
    };
    let mut upserted = 0usize;
    for node in &collected {
        let labels: Vec<&str> = node
            .labels
            .as_ref()
            .map(|l| l.nodes.iter().map(|n| n.name.as_str()).collect())
            .unwrap_or_default();
        let labels_json = serde_json::to_string(&labels).unwrap_or_else(|_| "[]".to_string());
        crate::db::upsert_polled_task(
            &conn,
            &crate::db::PolledTask {
                project_id: source.project_id,
                task_source_id: source.id,
                external_id: node.identifier.trim(),
                url: &node.url,
                title: &node.title,
                body: node.description.as_deref().unwrap_or(""),
                priority: task_priority(node.priority),
                labels_json: &labels_json,
            },
        )
        .map_err(&db_error)?;
        upserted += 1;
    }
    for node in &collected {
        let task_id = match crate::db::task_id_by_external(&conn, source.id, node.identifier.trim())
            .map_err(&db_error)?
        {
            Some(id) => id,
            None => {
                return Err(PollError::Retryable(format!(
                    "database write failed for {what}: task {} vanished — will retry with backoff",
                    node.identifier
                )))
            }
        };
        sync_relations(&conn, source.id, task_id, node).map_err(&db_error)?;
    }
    drop(conn);
    Ok(PollStats { upserted, cursor })
}
