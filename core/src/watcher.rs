use crate::config::Config;
use crate::{db, models, worker};
use anyhow::{Context, Result};

pub struct WatchStats {
    pub corrected: usize,
    pub merged: usize,
    pub prs: usize,
    pub swept: usize,
    pub promoted: usize,
}

pub async fn watch_once(cfg: &Config) -> Result<WatchStats> {
    let tasks = {
        let conn = db::connect()?;
        db::migrate(&conn)?;
        let mut tasks = db::list_tasks(&conn, None, Some(models::status::COMPLETED), 200, 0)?;
        tasks.extend(db::list_tasks(&conn, None, Some(models::status::IN_REVIEW), 200, 0)?);
        tasks
    };
    let mut corrected = 0usize;
    let mut merged = 0usize;
    let mut prs = 0usize;
    let mut promoted = 0usize;
    for task in &tasks {
        match watch_task(cfg, task).await {
            Ok(WatchAction::Corrected) => corrected += 1,
            Ok(WatchAction::Merged) => merged += 1,
            Ok(WatchAction::PrReady) => prs += 1,
            Ok(WatchAction::Promoted) => promoted += 1,
            Ok(WatchAction::Idle) => {}
            Err(e) => tracing::error!(task = task.id, "{e:#}"),
        }
    }
    let (stale, checkouts) = {
        let conn = db::connect()?;
        let stale = db::finished_worktrees(&conn)?;
        let checkouts: Vec<String> = db::list_projects(&conn)?
            .into_iter()
            .filter(|p| !p.local_path.is_empty())
            .map(|p| {
                crate::config::expand_home(&p.local_path)
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        (stale, checkouts)
    };
    let mut swept = 0usize;
    for (work_id, path) in stale {
        if !std::path::Path::new(&path).exists() {
            if let Ok(conn) = db::connect() {
                let _ = db::clear_worktree_path(&conn, work_id);
            }
            continue;
        }
        let mut removed = false;
        for checkout in &checkouts {
            if git_in(checkout, &["worktree", "remove", "--force", &path])
                .await
                .is_ok()
            {
                removed = true;
                break;
            }
        }
        if removed {
            if let Ok(conn) = db::connect() {
                let _ = db::clear_worktree_path(&conn, work_id);
            }
            swept += 1;
        }
    }
    tracing::info!(corrected, merged, prs, swept, promoted, "watcher: reviewed completed tasks");
    Ok(WatchStats { corrected, merged, prs, swept, promoted })
}

enum WatchAction {
    Idle,
    Corrected,
    Merged,
    PrReady,
    Promoted,
}

async fn watch_task(cfg: &Config, task: &models::Task) -> Result<WatchAction> {
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
        _ => return Ok(WatchAction::Idle),
    };
    if task.branch.is_empty() {
        return Ok(WatchAction::Idle);
    }
    let (decision, unresolved) = {
        let conn = db::connect()?;
        (
            db::latest_decision(&conn, task.id)?,
            db::unresolved_changes(&conn, task.id)?,
        )
    };
    if unresolved > 0 {
        run_correction(&project, task, cfg.service.work_timeout_secs, &cfg.explain).await?;
        crate::events::publish(
            "work.correction",
            Some(task.project_id),
            Some(task.id),
            None,
            format!("task #{} correction started", task.id),
        );
        return Ok(WatchAction::Corrected);
    }
    if task.status == models::status::COMPLETED {
        let conn = db::connect()?;
        db::update_task(&conn, task.id, Some(models::status::IN_REVIEW), None, None)?;
        crate::events::publish(
            "review.ready",
            Some(task.project_id),
            Some(task.id),
            None,
            format!("task #{} completed -> in-review", task.id),
        );
        return Ok(WatchAction::Promoted);
    }
    let approved = matches!(decision, Some(ref d) if d.kind == models::review_kind::APPROVAL);
    if !approved {
        return Ok(WatchAction::Idle);
    }
    if cfg.merge.mode == "pr" {
        let action = ready_pr(&project, task).await?;
        if matches!(action, WatchAction::PrReady) {
            crate::events::publish(
                "work.pr_ready",
                Some(task.project_id),
                Some(task.id),
                None,
                format!("task #{} pr ready", task.id),
            );
        }
        return Ok(action);
    }
    merge_local(&project, task).await?;
    crate::events::publish(
        "work.merged",
        Some(task.project_id),
        Some(task.id),
        None,
        format!("task #{} merged", task.id),
    );
    Ok(WatchAction::Merged)
}

fn correction_prompt(task: &models::Task, reviews: &[models::ReviewComment]) -> String {
    let mut comments = String::new();
    for r in reviews {
        comments.push_str(&format!("- {}: {}\n", r.author, r.body));
    }
    format!(
        "# Review corrections for {}\n\nAddress each unresolved review comment below, then follow the working agreement.\n\n## Title\n\n{}\n\n## Body\n\n{}\n\n## Instructions\n\n{}\n\n## Unresolved review comments\n\n{}\n## Working agreement\n\n- Address each comment. \n- Make one atomic commit per logical change as you go, using conventional commits (feat/fix/docs/chore/refactor/test). Leave nothing uncommitted when you finish.\n- If you cannot proceed, explain why and exit non-zero.\n",
        task.external_id.as_deref().unwrap_or("native"),
        task.title,
        if task.body.trim().is_empty() { "(none)" } else { &task.body },
        if task.instructions.trim().is_empty() { "(none)" } else { &task.instructions },
        comments,
    )
}

async fn run_correction(project: &models::Project, task: &models::Task, timeout_secs: u64, explain: &crate::config::Explain) -> Result<()> {
    let work = {
        let conn = db::connect()?;
        db::latest_work_for_task(&conn, task.id)?
    };
    let (worktree_str, branch) = match work {
        Some(w) if !w.worktree_path.is_empty() => (w.worktree_path.clone(), w.branch.clone()),
        _ => {
            let root =
                crate::config::expand_home("~/.local/share/formless-hands/worktrees");
            std::fs::create_dir_all(&root)
                .with_context(|| format!("create {}", root.display()))?;
            (
                root.join(format!("wt-{}-{}", project.name, task.id))
                    .to_string_lossy()
                    .to_string(),
                task.branch.clone(),
            )
        }
    };
    if !std::path::Path::new(&worktree_str).exists() {
        worker::git_worktree_add(&project.local_path, &worktree_str, &branch).await?;
    }
    let reviews = {
        let conn = db::connect()?;
        db::list_reviews(&conn, task.id)?
            .into_iter()
            .filter(|r| r.kind == models::review_kind::CHANGES && !r.resolved)
            .collect::<Vec<_>>()
    };
    let session = {
        let conn = db::connect()?;
        db::latest_session_for_task(&conn, task.id)?
    };
    let prompt = correction_prompt(task, &reviews);
    let attempt = task.attempts + 1;
    let log_path = crate::config::expand_home("~/.local/share/formless-hands")
        .join("transcripts")
        .join(format!("task-{}-attempt-{attempt}.log", task.id));
    {
        let conn = db::connect()?;
        db::begin_attempt(&conn, task.id, &branch)?;
    }
    let header = format!(
        "work correction: task #{} attempt {attempt} branch {branch} session {}\n",
        task.id,
        session.as_deref().unwrap_or("none"),
    );
    std::fs::write(&log_path, &header)
        .with_context(|| format!("write {}", log_path.display()))?;
    let work_id = {
        let conn = db::connect()?;
        db::insert_work(&conn, task.id, &worktree_str, &branch, &log_path.to_string_lossy())?
    };
    let extra: Vec<&str> = match &session {
        Some(sid) => vec!["--session", sid.as_str()],
        None => vec![],
    };
    tracing::info!(task = task.id, work = work_id, "watcher: correction running");
    match worker::run_agent(&worktree_str, &prompt, &log_path, &extra, timeout_secs).await {
        Err(msg) => {
            let conn = db::connect()?;
            worker::finish_failed(&conn, work_id, -1, &msg).ok();
            db::block_task(&conn, task.id, &msg)?;
            tracing::error!(task = task.id, work = work_id, "{msg}");
        }
        Ok(outcome) if outcome.timed_out => {
            let msg = "correction timed out";
            worker::finish_failed(&db::connect()?, work_id, 124, msg).ok();
            let conn = db::connect()?;
            if let Some(pid) = outcome.pid {
                let _ = db::set_work_pid(&conn, work_id, pid as i64);
            }
            db::update_task(&conn, task.id, Some(models::status::TRIAGED), None, None)?;
            db::set_task_backoff(
                &conn,
                task.id,
                &crate::linear::backoff_until_now_plus(crate::linear::backoff_delay_secs(1)),
            )?;
            tracing::warn!(task = task.id, work = work_id, "{msg} — released to triage with backoff");
        }
        Ok(outcome) => {
            let conn = db::connect()?;
            if let Some(pid) = outcome.pid {
                let _ = db::set_work_pid(&conn, work_id, pid as i64);
            }
            worker::record_session(&conn, work_id, &log_path);
            db::finish_work(&conn, work_id, outcome.code)?;
            if outcome.code == 0 {
                drop(conn);
                match crate::explain::explain_work(task, work_id, &worktree_str, &project.default_branch, explain).await {
                    Ok(n) => tracing::info!(task = task.id, work = work_id, notes = n, "watcher: explanations stored"),
                    Err(e) => tracing::warn!(task = task.id, work = work_id, "{e:#} — continuing without notes"),
                }
                let conn = db::connect()?;
                db::resolve_changes(&conn, task.id)?;
                db::update_task(&conn, task.id, Some(models::status::IN_REVIEW), None, None)?;
                crate::events::publish(
                    "review.ready",
                    Some(task.project_id),
                    Some(task.id),
                    Some(work_id),
                    format!("task #{} correction done, awaiting review", task.id),
                );
                tracing::info!(task = task.id, work = work_id, "watcher: correction done, awaiting review");
            } else {
                let msg = format!(
                    "correction exited with code {}: {}",
                    outcome.code, outcome.stderr_tail
                );
                db::block_task(&conn, task.id, &msg)?;
                tracing::error!(task = task.id, work = work_id, "{msg}");
            }
        }
    }
    Ok(())
}

async fn git_in(checkout: &str, args: &[&str]) -> Result<String> {
    let out = tokio::process::Command::new("git")
        .arg("-C")
        .arg(checkout)
        .args(args)
        .output()
        .await
        .context("run git — is git installed and on PATH?")?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    anyhow::bail!("git {} failed: {err}", args.join(" "))
}

async fn merge_local(project: &models::Project, task: &models::Task) -> Result<()> {
    let checkout = crate::config::expand_home(&project.local_path)
        .to_string_lossy()
        .to_string();
    git_in(&checkout, &["checkout", &project.default_branch])
        .await
        .with_context(|| format!("prepare {} for merge", project.default_branch))?;
    if let Err(e) = git_in(
        &checkout,
        &["merge", "--no-ff", &task.branch, "-m", &format!("Merge {}", task.branch)],
    )
    .await
    {
        let conn = db::connect()?;
        db::block_task(&conn, task.id, &format!("merge failed: {e:#}"))?;
        tracing::error!(task = task.id, "{e:#}");
        return Ok(());
    }
    {
        let conn = db::connect()?;
        db::update_task(&conn, task.id, Some(models::status::MERGED), None, None)?;
    }
    let latest_work = db::connect()
        .and_then(|conn| db::latest_work_for_task(&conn, task.id))
        .ok()
        .flatten();
    if let Some(work) = latest_work {
        if !work.worktree_path.is_empty() {
            let _ = git_in(&checkout, &["worktree", "remove", "--force", &work.worktree_path]).await;
        }
        if let Ok(conn) = db::connect() {
            let _ = db::clear_worktree_path(&conn, work.id);
        }
    }
    let _ = git_in(&checkout, &["branch", "-d", &task.branch]).await;
    tracing::info!(task = task.id, branch = %task.branch, "watcher: merged");
    Ok(())
}

async fn ready_pr(project: &models::Project, task: &models::Task) -> Result<WatchAction> {
    let (owner, repo) = match crate::projects::github_repo(&project.remote_url) {
        Ok(pair) => pair,
        Err(_) => {
            tracing::info!(task = task.id, "watcher: pr mode needs a github remote");
            return Ok(WatchAction::Idle);
        }
    };
    let checkout = crate::config::expand_home(&project.local_path)
        .to_string_lossy()
        .to_string();
    let push = tokio::process::Command::new("git")
        .arg("-C")
        .arg(&checkout)
        .args(["push", "--porcelain", "origin", &task.branch])
        .output()
        .await
        .context("run git — is git installed and on PATH?")?;
    if !push.status.success() {
        let err = String::from_utf8_lossy(&push.stderr).trim().to_string();
        let conn = db::connect()?;
        db::block_task(&conn, task.id, &format!("push failed: {err}"))?;
        tracing::error!(task = task.id, "push failed: {err}");
        return Ok(WatchAction::Idle);
    }
    let changed = String::from_utf8_lossy(&push.stdout).lines().any(|line| {
        line.starts_with(' ') || line.starts_with('*') || line.starts_with('+')
    });
    if !changed {
        tracing::debug!(task = task.id, "watcher: branch already on origin");
        return Ok(WatchAction::Idle);
    }
    tracing::info!(
        task = task.id,
        "watcher: pr ready https://github.com/{owner}/{repo}/compare/{}...{}?expand=1",
        project.default_branch,
        task.branch,
    );
    Ok(WatchAction::PrReady)
}
