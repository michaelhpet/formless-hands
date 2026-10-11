use crate::db;
use crate::models::{project_status, Project};
use anyhow::{Context, Result};
use rusqlite::Connection;
use std::path::{Path, PathBuf};

static NAME_RE: std::sync::LazyLock<regex::Regex> = std::sync::LazyLock::new(|| {
    regex::Regex::new(r"^[A-Za-z0-9._-]+$").unwrap()
});

pub fn valid_name(name: &str) -> bool {
    NAME_RE.is_match(name) && name != "." && name != ".."
}

pub fn normalize_remote(url: &str) -> String {
    url.trim_end_matches('/').trim_end_matches(".git").to_string()
}

fn split_host_path(url: &str) -> Result<(String, String)> {
    if let Some((scheme, rest)) = url.split_once("://") {
        if !["ssh", "https", "git", "file"].contains(&scheme) {
            anyhow::bail!("unsupported URL scheme '{scheme}://' — use an SSH URL like git@github.com:owner/project.git");
        }
        let rest = rest.split('@').next_back().unwrap_or(rest);
        let (_, path) = rest
            .split_once('/')
            .filter(|(host, path)| !host.is_empty() && !path.is_empty())
            .context("URL has no host/path — expected host:owner/repo or scheme://host/owner/repo")?;
        let host = rest.split('/').next().unwrap_or("").to_string();
        return Ok((host, path.to_string()));
    }
    let (left, path) = url.split_once(':').context(
        "not a cloneable URL — expected git@host:owner/repo.git or scheme://host/owner/repo",
    )?;
    if left.is_empty() || left.contains('/') || path.is_empty() || path.starts_with('/') {
        anyhow::bail!(
            "not a cloneable URL — expected git@host:owner/repo.git or scheme://host/owner/repo"
        );
    }
    let host = left.rsplit('@').next().unwrap_or(left).to_string();
    Ok((host, path.to_string()))
}

pub enum RepoRef {
    Remote(String),
    Local(PathBuf),
}

pub fn classify_repo_arg(arg: &str) -> Result<RepoRef> {
    let path = Path::new(arg);
    if path.is_dir() {
        let abs = path
            .canonicalize()
            .with_context(|| format!("resolve local directory '{arg}'"))?;
        return Ok(RepoRef::Local(abs));
    }
    Ok(RepoRef::Remote(arg.to_string()))
}

pub fn derive_local_name(dir: &Path) -> Result<String> {
    let stem = dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();
    if !valid_name(&stem) {
        anyhow::bail!("directory name '{stem}' is not a valid project name — pass --name explicitly");
    }
    Ok(stem)
}

pub async fn assert_repo(dir: &Path) -> Result<()> {
    let (is_repo, _) = git(&["rev-parse", "--git-dir"], Some(dir)).await?;
    if !is_repo {
        anyhow::bail!("'{}' is not a git repository — init one or pass an SSH clone URL", dir.display());
    }
    Ok(())
}

pub async fn worktree_root(dir: &Path) -> Result<PathBuf> {
    let (ok, out) = git(&["rev-parse", "--show-toplevel"], Some(dir)).await?;
    if ok && !out.trim().is_empty() {
        return Ok(PathBuf::from(out));
    }
    dir.canonicalize()
        .with_context(|| format!("resolve local directory '{}'", dir.display()))
}

pub async fn origin_of(dir: &Path) -> String {
    match git(&["remote", "get-url", "origin"], Some(dir)).await {
        Ok((true, origin)) => origin,
        _ => String::new(),
    }
}

pub fn is_local_remote(remote_url: &str) -> bool {
    Path::new(remote_url).is_absolute()
}

pub fn derive_github_name(url: &str) -> Result<String> {
    let (host, _) = split_host_path(url)?;
    if host != "github.com" {
        anyhow::bail!("only github repositories are supported — got host '{host}'");
    }
    derive_name(url)
}

pub fn derive_name(url: &str) -> Result<String> {
    let (_, path) = split_host_path(url)?;
    let stem = path
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .rsplit('/')
        .next()
        .unwrap_or("");
    if !valid_name(stem) {
        anyhow::bail!("cannot derive a directory name from '{url}' — pass --name explicitly");
    }
    Ok(stem.to_string())
}

pub fn default_clone_root() -> PathBuf {
    crate::config::expand_home("~/Work")
}

async fn git(args: &[&str], dir: Option<&Path>) -> Result<(bool, String)> {
    let mut cmd = tokio::process::Command::new("git");
    if let Some(d) = dir {
        cmd.arg("-C").arg(d);
    }
    cmd.args(args);
    let out = cmd.output().await.context("run git — is git installed and on PATH?")?;
    let mut text = String::from_utf8_lossy(&out.stderr).to_string();
    if text.trim().is_empty() {
        text = String::from_utf8_lossy(&out.stdout).to_string();
    }
    Ok((out.status.success(), text.trim().to_string()))
}

fn clone_hint(url: &str, stderr: &str) -> String {
    let host = split_host_path(url).map(|(h, _)| h).unwrap_or_default();
    if stderr.contains("Permission denied (publickey)") {
        format!("SSH key rejected by {host} — add your key to the account or check ~/.ssh/config, then rerun.")
    } else if stderr.contains("Repository not found") {
        "Host reports repository not found — check the URL spelling and that your account has access.".to_string()
    } else if stderr.contains("Could not resolve host") || stderr.contains("Could not resolve hostname") {
        "Cannot reach the host — check internet access and the hostname.".to_string()
    } else if stderr.contains("Authentication failed") {
        "Git authentication failed — check your credential helper or ssh key for this host.".to_string()
    } else {
        "git clone failed — check your git setup for this host.".to_string()
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    format!("{}…", &s[..max])
}

async fn detect_branch(path: &Path) -> String {
    if let Ok((true, out)) = git(&["symbolic-ref", "refs/remotes/origin/HEAD"], Some(path)).await {
        if let Some(branch) = out.strip_prefix("refs/remotes/origin/") {
            if !branch.trim().is_empty() {
                return branch.trim().to_string();
            }
        }
    }
    "main".to_string()
}

async fn is_matching_checkout(path: &Path, remote_url: &str) -> Result<bool> {
    let (is_repo, _) = git(&["rev-parse", "--git-dir"], Some(path)).await?;
    if !is_repo {
        return Ok(false);
    }
    let (ok, origin) = git(&["remote", "get-url", "origin"], Some(path)).await?;
    Ok(ok && normalize_remote(&origin) == normalize_remote(remote_url))
}

pub struct PlannedProject {
    pub name: String,
    pub remote_url: String,
    pub local_path: String,
}

pub struct ConnectionState {
    pub local_path: String,
    pub default_branch: String,
    pub status: &'static str,
    pub status_detail: String,
}

pub async fn plan_add(repo: &str, path: Option<&str>) -> Result<PlannedProject> {
    match classify_repo_arg(repo)? {
        RepoRef::Remote(url) => Ok(PlannedProject {
            name: derive_github_name(&url)?,
            remote_url: url.trim().to_string(),
            local_path: path.unwrap_or("").to_string(),
        }),
        RepoRef::Local(dir) => {
            if path.is_some() {
                anyhow::bail!("--path is for clone URLs — '{}' already is the checkout", dir.display());
            }
            assert_repo(&dir).await?;
            let dir = worktree_root(&dir).await?;
            let dir_str = dir.to_string_lossy().to_string();
            let origin = origin_of(&dir).await;
            Ok(PlannedProject {
                name: derive_local_name(&dir)?,
                remote_url: if origin.is_empty() { dir_str.clone() } else { origin },
                local_path: dir_str,
            })
        }
    }
}

pub fn find_existing(conn: &Connection, planned: &PlannedProject) -> Result<Option<Project>> {
    if let Some(r) = db::get_project_by_name(conn, &planned.name)? {
        return Ok(Some(r));
    }
    if let Some(r) = db::get_project_by_remote(conn, &planned.remote_url)? {
        return Ok(Some(r));
    }
    if !planned.local_path.is_empty() {
        if let Some(r) = db::get_project_by_local_path(conn, &planned.local_path)? {
            return Ok(Some(r));
        }
    }
    Ok(None)
}

pub fn insert_planned(conn: &Connection, planned: &PlannedProject) -> Result<Project> {
    let id = db::insert_project(
        &conn,
        &crate::models::NewProject {
            name: &planned.name,
            remote_url: &planned.remote_url,
            local_path: &planned.local_path,
        },
    )?;
    db::get_project_by_name(conn, &planned.name)?.context(format!("project #{id} vanished"))
}

pub async fn connect_planned(planned: &PlannedProject, default_branch: &str) -> ConnectionState {
    let connected = |local_path: String, branch: String| ConnectionState {
        local_path,
        default_branch: branch,
        status: project_status::CONNECTED,
        status_detail: String::new(),
    };
    let mut target = if planned.local_path.is_empty() {
        default_clone_root().join(&planned.name)
    } else {
        crate::config::expand_home(&planned.local_path)
    };
    if !target.exists() {
        let conventional = default_clone_root().join(&planned.name);
        if conventional != target {
            if let Ok(true) = is_matching_checkout(&conventional, &planned.remote_url).await {
                target = conventional;
            }
        }
    }
    let target_str = target.to_string_lossy().to_string();

    if target.exists() {
        let (is_repo, _) = git(&["rev-parse", "--git-dir"], Some(&target))
            .await
            .unwrap_or((false, String::new()));
        if !is_repo {
            return error_state(&target_str, default_branch, "exists but is not a git repository — move it aside or pass --path to a different directory.", "");
        }
        let (ok, origin) = git(&["remote", "get-url", "origin"], Some(&target))
            .await
            .unwrap_or((false, String::new()));
        let remote_ok = ok && normalize_remote(&origin) == normalize_remote(&planned.remote_url);
        let local_ok = is_local_remote(&planned.remote_url) && planned.remote_url == target_str;
        if !remote_ok && !local_ok {
            return error_state(&target_str, default_branch, &format!("checkout points at a different remote ('{origin}') — fix with git remote set-url origin {} or pass --path elsewhere.", planned.remote_url), "");
        }
        let branch = detect_branch(&target).await;
        return connected(target_str, branch);
    }
    if is_local_remote(&planned.remote_url) && planned.remote_url == target_str {
        return ConnectionState {
            local_path: String::new(),
            default_branch: default_branch.to_string(),
            status: project_status::ERROR,
            status_detail: format!("local directory '{target_str}' no longer exists — move it back or remove the project."),
        };
    }
    if let Some(parent) = target.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            return error_state(&target_str, default_branch, &format!("create {}: {e}", parent.display()), "");
        }
    }
    match git(&["clone", &planned.remote_url, &target_str], None).await {
        Ok((true, _)) => {
            let branch = detect_branch(&target).await;
            connected(target_str, branch)
        }
        Ok((false, err)) => {
            let hint = clone_hint(&planned.remote_url, &err);
            error_state(&target_str, default_branch, &hint, &err)
        }
        Err(e) => error_state(&target_str, default_branch, "run git — is git installed and on PATH?", &e.to_string()),
    }
}

fn error_state(target_str: &str, default_branch: &str, hint: &str, raw: &str) -> ConnectionState {
    let status_detail = if raw.is_empty() {
        hint.to_string()
    } else {
        format!("{hint}\n{}", truncate(raw, 1500))
    };
    let keep_path = if Path::new(target_str).exists() {
        target_str.to_string()
    } else {
        String::new()
    };
    ConnectionState {
        local_path: keep_path,
        default_branch: default_branch.to_string(),
        status: project_status::ERROR,
        status_detail,
    }
}

pub fn write_connection(conn: &Connection, id: i64, state: &ConnectionState) -> Result<()> {
    db::set_project_connection(conn, id, &state.local_path, &state.default_branch, state.status, &state.status_detail)
}

pub async fn add_project(conn: &Connection, repo: &str, path: Option<&str>) -> Result<Project> {
    let planned = plan_add(repo, path).await?;
    let project = match find_existing(conn, &planned)? {
        Some(r) => r,
        None => insert_planned(conn, &planned)?,
    };
    let state = connect_planned(&planned, &project.default_branch).await;
    write_connection(conn, project.id, &state)?;
    db::get_project_by_name(conn, &project.name)?.context("project vanished")
}
