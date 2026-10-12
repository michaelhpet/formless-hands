use crate::config::Config;
use crate::{db, models};
use anyhow::{Context, Result};

fn state_file(kind: &str, task_id: i64, attempt: i64, ext: &str) -> Result<std::path::PathBuf> {
    let dir = crate::config::expand_home("~/.local/share/formless-hands").join(kind);
    std::fs::create_dir_all(&dir).with_context(|| format!("create {}", dir.display()))?;
    Ok(dir.join(format!("task-{task_id}-attempt-{attempt}.{ext}")))
}

async fn git(args: &[&str], dir: &str) -> Result<(bool, String)> {
    let out = tokio::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .await
        .context("run git — is git installed and on PATH?")?;
    Ok((out.status.success(), String::from_utf8_lossy(&out.stderr).trim().to_string()))
}

async fn branch_exists(checkout: &str, branch: &str) -> bool {
    git(&["rev-parse", "--verify", "--quiet", branch], checkout)
        .await
        .map(|(ok, _)| ok)
        .unwrap_or(false)
}

fn slugify(title: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = true;
    for c in title.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c);
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }
    slug.trim_matches('-').chars().take(50).collect::<String>().trim_matches('-').to_string()
}

fn branch_type(labels_json: &str) -> &'static str {
    let labels: Vec<String> = serde_json::from_str(labels_json).unwrap_or_default();
    let has = |w: &str| labels.iter().any(|l| l.eq_ignore_ascii_case(w));
    if has("bug") || has("fix") {
        "fix"
    } else if has("docs") || has("documentation") {
        "docs"
    } else if has("chore") || has("maintenance") {
        "chore"
    } else if has("refactor") {
        "refactor"
    } else if has("test") || has("testing") {
        "test"
    } else {
        "feat"
    }
}

fn branch_name(task: &models::Task) -> String {
    let reference = match task.external_id.as_deref().map(str::trim) {
        Some(r) if !r.is_empty() => r.to_string(),
        _ => task.id.to_string(),
    };
    let kind = branch_type(&task.labels);
    let slug = slugify(&task.title);
    if slug.is_empty() {
        format!("{kind}/{reference}")
    } else {
        format!("{kind}/{reference}-{slug}")
    }
}

pub(crate) async fn git_worktree_add(checkout: &str, path: &str, branch: &str) -> Result<()> {
    let mut args = vec!["worktree", "add", path];
    if branch_exists(checkout, branch).await {
        args.push(branch);
    } else {
        args.extend(["-b", branch]);
    }
    let (ok, err) = git(&args, checkout).await?;
    if ok {
        return Ok(());
    }
    anyhow::bail!("git worktree add failed: {err}")
}

pub async fn work_once(cfg: &Config) -> Result<()> {
    if db::connect().map(|conn| db::has_open_work(&conn).unwrap_or(true))? {
        tracing::info!("worker: previous work still open, skipping");
        return Ok(());
    }
    let task = {
        let conn = db::connect()?;
        db::migrate(&conn)?;
        db::list_tasks(&conn, None, Some(models::status::TRIAGED), 1, 0)?.pop()
    };
    let task = match task {
        Some(t) => t,
        None => {
            tracing::info!("worker: no triaged tasks, idle");
            return Ok(());
        }
    };
    let project = {
        let conn = db::connect()?;
        db::get_project_by_id(&conn, task.project_id)?
    };
    let project = match project {
        Some(p)
            if p.status == models::project_status::CONNECTED && !p.local_path.is_empty() =>
        {
            p
        }
        _ => {
            tracing::warn!(task = task.id, "worker: project not connected, skipping");
            return Ok(());
        }
    };

    let attempt = task.attempts + 1;
    let branch = branch_name(&task);
    let claimed = {
        let conn = db::connect()?;
        db::claim_task(&conn, task.id, &branch)?
    };
    if !claimed {
        tracing::info!(task = task.id, "worker: task already claimed, skipping");
        return Ok(());
    }

    let worktree_root = crate::config::expand_home("~/.local/share/formless-hands/worktrees");
    std::fs::create_dir_all(&worktree_root)
        .with_context(|| format!("create {}", worktree_root.display()))?;
    let worktree = worktree_root.join(format!("wt-{}-{}", project.name, task.id));
    let worktree_str = worktree.to_string_lossy().to_string();
    if let Err(e) = git_worktree_add(&project.local_path, &worktree_str, &branch).await {
        let conn = db::connect()?;
        db::block_task(&conn, task.id, &e.to_string())?;
        tracing::error!(task = task.id, "{e:#}");
        return Ok(());
    }

    let prompt_path = state_file("prompts", task.id, attempt, "md")?;
    let prompt = format!(
        "# Task {}\n\nImplement this task.\n\n## Title\n\n{}\n\n## Body\n\n{}\n\n## Instructions\n\n{}\n\n## Working agreement\n\n- Make one atomic commit per logical change as you go, using conventional commits (feat/fix/docs/chore/refactor/test). Leave nothing uncommitted when you finish.\n- If you cannot proceed, explain why and exit non-zero.\n",
        task.external_id.as_deref().unwrap_or("native"),
        task.title,
        if task.body.trim().is_empty() { "(none)" } else { &task.body },
        if task.instructions.trim().is_empty() { "(none)" } else { &task.instructions },
    );
    if let Err(e) = std::fs::write(&prompt_path, &prompt)
        .with_context(|| format!("write {}", prompt_path.display()))
    {
        let conn = db::connect()?;
        db::block_task(&conn, task.id, &e.to_string())?;
        tracing::error!(task = task.id, "{e:#}");
        return Ok(());
    }

    let log_path = state_file("transcripts", task.id, attempt, "log")?;
    let header = format!(
        "work claim: task #{} attempt {attempt} branch {branch}\nrunning: opencode run --format json (cwd {worktree_str})\n",
        task.id,
    );
    if let Err(e) = std::fs::write(&log_path, &header)
        .with_context(|| format!("write {}", log_path.display()))
    {
        let conn = db::connect()?;
        db::block_task(&conn, task.id, &e.to_string())?;
        tracing::error!(task = task.id, "{e:#}");
        return Ok(());
    }

    let work_id = {
        let conn = db::connect()?;
        db::insert_work(&conn, task.id, &worktree_str, &branch, &log_path.to_string_lossy())?
    };

    tracing::info!(task = task.id, work = work_id, branch = %branch, "worker: agent running");
    match run_agent(&worktree_str, &prompt, &log_path, &[], cfg.service.work_timeout_secs).await {
        Err(msg) => {
            let conn = db::connect()?;
            finish_failed(&conn, work_id, -1, &msg).ok();
            db::block_task(&conn, task.id, &msg)?;
            tracing::error!(task = task.id, work = work_id, "{msg}");
            return Ok(());
        }
        Ok(outcome) if outcome.timed_out => {
            let msg = format!("agent timed out after {}s", cfg.service.work_timeout_secs);
            finish_failed(&db::connect()?, work_id, 124, &msg).ok();
            let conn = db::connect()?;
            if let Some(pid) = outcome.pid {
                let _ = db::set_work_pid(&conn, work_id, pid as i64);
            }
            record_session(&conn, work_id, &log_path);
            db::update_task(&conn, task.id, Some(models::status::TRIAGED), None, None)?;
            db::set_task_backoff(
                &conn,
                task.id,
                &crate::linear::backoff_until_now_plus(crate::linear::backoff_delay_secs(1)),
            )?;
            tracing::warn!(task = task.id, work = work_id, "{msg} — released to triage with backoff");
            return Ok(());
        }
        Ok(outcome) => {
            let conn = db::connect()?;
            if let Some(pid) = outcome.pid {
                let _ = db::set_work_pid(&conn, work_id, pid as i64);
            }
            record_session(&conn, work_id, &log_path);
            db::finish_work(&conn, work_id, outcome.code)?;
            if outcome.code == 0 {
                db::update_task(&conn, task.id, Some(models::status::COMPLETED), None, None)?;
                tracing::info!(task = task.id, work = work_id, "worker: completed");
            } else {
                let msg = format!("agent exited with code {}: {}", outcome.code, outcome.stderr_tail);
                db::block_task(&conn, task.id, &msg)?;
                tracing::error!(task = task.id, work = work_id, "{msg}");
            }
        }
    }
    Ok(())
}

fn session_in(value: &serde_json::Value) -> Option<String> {
    for key in ["sessionID", "sessionId", "session_id"] {
        if let Some(id) = value.get(key).and_then(|v| v.as_str()) {
            if !id.trim().is_empty() {
                return Some(id.to_string());
            }
        }
    }
    None
}

pub(crate) fn record_session(conn: &rusqlite::Connection, work_id: i64, log_path: &std::path::Path) {
    let Ok(text) = std::fs::read_to_string(log_path) else {
        return;
    };
    for line in text.lines() {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line) else {
            continue;
        };
        if let Some(id) = session_in(&value) {
            let _ = db::set_work_session(conn, work_id, &id);
            tracing::info!(work = work_id, session = %id, "worker: recorded session");
            return;
        }
        if let Some(obj) = value.as_object() {
            for nested in ["data", "session", "payload"] {
                if let Some(found) = obj.get(nested).and_then(session_in) {
                    let _ = db::set_work_session(conn, work_id, &found);
                    tracing::info!(work = work_id, session = %found, "worker: recorded session");
                    return;
                }
            }
        }
    }
}

pub(crate) struct AgentOutcome {
    pub code: i64,
    pub timed_out: bool,
    pub stderr_tail: String,
    pub pid: Option<u32>,
}

pub(crate) async fn run_agent(
    worktree: &str,
    message: &str,
    log_path: &std::path::Path,
    extra_args: &[&str],
    timeout_secs: u64,
) -> Result<AgentOutcome, String> {
    let mut args = vec!["run"];
    args.extend(extra_args);
    args.extend(["--format", "json"]);
    args.push(message);
    let child = tokio::process::Command::new("opencode")
        .args(&args)
        .current_dir(worktree)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("opencode not available: {e}"))?;
    let pid = child.id();
    let mut slot = Some(child);
    let output = match tokio::time::timeout(
        std::time::Duration::from_secs(timeout_secs),
        async { slot.take().expect("child").wait_with_output().await },
    )
    .await
    {
        Err(_) => {
            if let Some(mut child) = slot.take() {
                let _ = child.kill().await;
                let _ = child.wait().await;
            }
            let outcome = AgentOutcome {
                code: 124,
                timed_out: true,
                stderr_tail: format!("timed out after {timeout_secs}s"),
                pid,
            };
            append_timed_out(log_path, timeout_secs);
            return Ok(outcome);
        }
        Ok(Err(e)) => return Err(format!("agent wait failed: {e}")),
        Ok(Ok(output)) => output,
    };
    append_output(log_path, &output);
    Ok(AgentOutcome {
        code: output.status.code().unwrap_or(-1) as i64,
        timed_out: false,
        stderr_tail: tail_text(&String::from_utf8_lossy(&output.stderr), 2000),
        pid,
    })
}

fn append_timed_out(log_path: &std::path::Path, timeout_secs: u64) {
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().append(true).open(log_path) {
        let _ = writeln!(f, "--- timed out after {timeout_secs}s ---");
    }
}

fn tail_text(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.trim().to_string();
    }
    format!("…{}", &s[s.len() - max..])
}

fn append_output(log_path: &std::path::Path, output: &std::process::Output) {
    use std::io::Write;
    let mut text = String::from_utf8_lossy(&output.stdout).into_owned();
    text.push_str(&String::from_utf8_lossy(&output.stderr));
    let text = tail_text(&text, 200_000);
    if let Ok(mut f) = std::fs::OpenOptions::new().append(true).open(log_path) {
        let _ = writeln!(f, "--- exit: {} ---\n{text}", output.status);
    }
}

pub(crate) fn finish_failed(conn: &rusqlite::Connection, work_id: i64, code: i64, msg: &str) -> Result<()> {
    db::finish_work(conn, work_id, code)?;
    let entry = format!("\n--- failed: {msg} ---\n");
    if let Ok(Some(w)) = db::get_work(conn, work_id) {
        use std::io::Write;
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .append(true)
            .open(&w.log_path)
        {
            let _ = write!(f, "{entry}");
        }
    }
    Ok(())
}
