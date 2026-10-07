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

pub async fn ensure_local(conn: &Connection, project: &Project) -> Result<Project> {
    let mut target = if project.local_path.is_empty() {
        default_clone_root().join(&project.name)
    } else {
        crate::config::expand_home(&project.local_path)
    };
    if !target.exists() {
        let conventional = default_clone_root().join(&project.name);
        if conventional != target && is_matching_checkout(&conventional, &project.remote_url).await? {
            target = conventional;
        }
    }
    let target_str = target.to_string_lossy().to_string();

    if target.exists() {
        let (is_repo, _) = git(&["rev-parse", "--git-dir"], Some(&target)).await?;
        if !is_repo {
            return fail(conn, project, &target_str, "exists but is not a git repository — move it aside or pass --path to a different directory.", "").await;
        }
        let (ok, origin) = git(&["remote", "get-url", "origin"], Some(&target)).await?;
        if !ok || normalize_remote(&origin) != normalize_remote(&project.remote_url) {
            return fail(conn, project, &target_str, &format!("checkout points at a different remote ('{origin}') — fix with git remote set-url origin {} or pass --path elsewhere.", project.remote_url), "").await;
        }
        let branch = detect_branch(&target).await;
        db::set_project_connection(conn, project.id, &target_str, &branch, project_status::CONNECTED, "")?;
    } else {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create {}", parent.display()))?;
        }
        let (ok, err) = git(&["clone", &project.remote_url, &target_str], None).await?;
        if !ok {
            let hint = clone_hint(&project.remote_url, &err);
            return fail(conn, project, &target_str, &hint, &err).await;
        }
        let branch = detect_branch(&target).await;
        db::set_project_connection(conn, project.id, &target_str, &branch, project_status::CONNECTED, "")?;
    }
    db::get_project_by_name(conn, &project.name)?.context("project vanished")
}

async fn fail(
    conn: &Connection,
    project: &Project,
    local_path: &str,
    hint: &str,
    raw: &str,
) -> Result<Project> {
    let detail = if raw.is_empty() {
        hint.to_string()
    } else {
        format!("{hint}\n{}", truncate(raw, 1500))
    };
    let keep_path = if Path::new(local_path).exists() {
        local_path
    } else {
        ""
    };
    db::set_project_connection(conn, project.id, keep_path, &project.default_branch, project_status::ERROR, &detail)?;
    db::get_project_by_name(conn, &project.name)?.context("project vanished")
}
