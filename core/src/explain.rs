use crate::{db, diff, models};
use anyhow::{Context, Result};
use serde::Deserialize;

const EXPLAIN_TIMEOUT_SECS: u64 = 300;

#[derive(Debug, Deserialize)]
struct NoteDraft {
    path: String,
    old_range: Option<String>,
    new_range: Option<String>,
    hunk_header: Option<String>,
    body: String,
}

fn truncate_middle(s: &str, max: usize) -> String {
    if s.len() <= max {
        return s.to_string();
    }
    s[s.len() - max..].to_string()
}

fn explain_log_path(task_id: i64, work_id: i64) -> Result<std::path::PathBuf> {
    let dir = crate::config::expand_home("~/.local/share/formless-hands/transcripts");
    std::fs::create_dir_all(&dir).with_context(|| format!("create {}", dir.display()))?;
    Ok(dir.join(format!("task-{task_id}-work-{work_id}-explain.log")))
}

fn explainer_prompt(
    task: &models::Task,
    hunks_summary: &str,
    commits: &str,
    transcript_tail: &str,
    diff_text: &str,
) -> String {
    format!(
        "You are explaining a finished code change for a human reviewer. Do not modify any files. Read-only analysis.\n\
        \n\
        # Task\n\
        Title: {title}\n\
        Body: {body}\n\
        \n\
        # Commit messages on this branch\n\
        {commits}\n\
        \n\
        # Prior work transcript (excerpt, may explain why)\n\
        {transcript}\n\
        \n\
        # Diff hunks to explain\n\
        {hunks_summary}\n\
        \n\
        # Full unified diff\n\
        {diff}\n\
        \n\
        # Instructions\n\
        For each diff hunk listed above, write a short comment on this hunk: what changed and why it matters for review. \
        Ground every comment in the diff and the task context. Skip hunks that are purely mechanical renames only if there is nothing worth saying — otherwise explain each hunk. \
        Do not restate code literally. Call out risk, assumptions, or follow-ups where you see them.\n\
        \n\
        Output a JSON array only, one object per hunk you comment on, with exactly these keys:\n\
        [{{\"path\": \"src/example.rs\", \"old_range\": \"1-2\", \"new_range\": \"1-3\", \"hunk_header\": \"@@ -1,2 +1,3 @@\", \"body\": \"...\"}}]\n\
        Use the exact path, ranges, and hunk_header values from the hunks list. No markdown fences, no prose outside the JSON array.\n",
        title = task.title,
        body = if task.body.trim().is_empty() { "(none)" } else { &task.body },
        commits = if commits.trim().is_empty() { "(none)" } else { commits },
        transcript = if transcript_tail.trim().is_empty() { "(none)" } else { transcript_tail },
        hunks_summary = hunks_summary,
        diff = diff_text,
    )
}

fn extract_json_array(text: &str) -> Option<String> {
    let fenced = ["```json", "```JSON"];
    for fence in fenced {
        if let Some(start) = text.rfind(fence) {
            let rest = &text[start + fence.len()..];
            if let Some(end) = rest.find("```") {
                let candidate = rest[..end].trim().to_string();
                if candidate.starts_with('[') {
                    return Some(candidate);
                }
            }
        }
    }
    let start = text.rfind('[')?;
    let end = text.rfind(']')?;
    if end <= start {
        return None;
    }
    Some(text[start..=end].to_string())
}

pub(crate) async fn explain_work(
    task: &models::Task,
    work_id: i64,
    worktree: &str,
    base_branch: &str,
    explain: &crate::config::Explain,
) -> Result<usize> {
    let (parsed, _) = diff::diff_for_worktree(worktree, base_branch).await?;
    if parsed.files.is_empty() {
        tracing::info!(task = task.id, work = work_id, "explainer: empty diff, no notes");
        return Ok(0);
    }
    struct BatchHunk {
        summary_line: String,
        diff_text: String,
    }
    let mut explainable: Vec<BatchHunk> = Vec::new();
    for f in parsed.files.iter() {
        for h in f.hunks.iter() {
            let mut text = format!("diff --git a/{} b/{}\n{}\n", f.path, f.path, h.header);
            for l in h.old_lines.iter().filter(|l| l.kind == "removed") {
                text.push_str(&format!("-{}\n", l.text));
            }
            for l in &h.new_lines {
                let prefix = if l.kind == "added" { "+" } else { " " };
                text.push_str(&format!("{prefix}{}\n", l.text));
            }
            explainable.push(BatchHunk {
                summary_line: format!(
                    "- path: {} | old_range: {} | new_range: {} | hunk_header: {}",
                    f.path, h.old_range, h.new_range, h.header
                ),
                diff_text: text,
            });
        }
    }
    if explainable.is_empty() {
        return Ok(0);
    }
    let mut batches: Vec<Vec<usize>> = vec![Vec::new()];
    let mut batch_chars = 0usize;
    for (i, h) in explainable.iter().enumerate() {
        let size = h.diff_text.len() + h.summary_line.len();
        if !batches.last().map(|b| b.is_empty()).unwrap_or(true) && batch_chars + size > explain.prompt_diff_chars {
            batches.push(Vec::new());
            batch_chars = 0;
        }
        batches.last_mut().expect("batch").push(i);
        batch_chars += size;
    }
    let total_batches = batches.len();
    if total_batches > explain.max_batches {
        tracing::warn!(
            task = task.id, work = work_id,
            total_batches,
            max_batches = explain.max_batches,
            "explainer: diff exceeds batch budget, explaining first batches only"
        );
        batches.truncate(explain.max_batches);
    }

    let commits = diff::commit_messages_worktree(worktree, base_branch, explain.commits_chars).await;
    let transcript_tail = {
        let conn = db::connect()?;
        let log_path = db::get_work(&conn, work_id)?.map(|w| w.log_path).unwrap_or_default();
        if log_path.is_empty() {
            String::new()
        } else {
            truncate_middle(&std::fs::read_to_string(&log_path).unwrap_or_default(), explain.transcript_chars)
        }
    };

    let log_path = explain_log_path(task.id, work_id)?;
    let header = format!("explain: task #{} work #{work_id} base {base_branch}\n", task.id);
    std::fs::write(&log_path, &header)
        .with_context(|| format!("write {}", log_path.display()))?;

    let mut drafts: Vec<NoteDraft> = Vec::new();
    for (bi, batch) in batches.iter().enumerate() {
        let hunks_summary = batch.iter().map(|&i| explainable[i].summary_line.clone()).collect::<Vec<_>>().join("\n");
        let diff_text = batch.iter().map(|&i| explainable[i].diff_text.clone()).collect::<Vec<_>>().join("");
        let prompt = explainer_prompt(task, &hunks_summary, &commits, &transcript_tail, &diff_text);
        tracing::info!(task = task.id, work = work_id, batch = bi + 1, of = batches.len(), hunks = batch.len(), "explainer: fresh agent running");
        let outcome = crate::worker::run_agent(worktree, &prompt, &log_path, &[], EXPLAIN_TIMEOUT_SECS)
            .await
            .map_err(|e| anyhow::anyhow!(e))?;
        if outcome.timed_out || outcome.code != 0 {
            anyhow::bail!(
                "explainer failed on batch {bi}: code {} timed_out {} {}",
                outcome.code,
                outcome.timed_out,
                outcome.stderr_tail
            );
        }
        let log_text = std::fs::read_to_string(&log_path).unwrap_or_default();
        let json = extract_json_array(&log_text)
            .with_context(|| format!("explainer produced no JSON array (see {})", log_path.display()))?;
        let mut batch_drafts: Vec<NoteDraft> = serde_json::from_str(&json).context("parse explainer JSON")?;
        drafts.append(&mut batch_drafts);
    }

    let known: std::collections::HashSet<(String, String, String)> = parsed
        .files
        .iter()
        .flat_map(|f| {
            f.hunks.iter().map(|h| {
                (
                    f.path.clone(),
                    h.new_range.clone(),
                    h.header.clone(),
                )
            })
        })
        .collect();

    let conn = db::connect()?;
    db::delete_diff_notes_for_work(&conn, work_id)?;
    let source = format!("from work #{work_id}");
    let mut inserted = 0usize;
    for d in drafts {
        let body = d.body.trim();
        if body.is_empty() || d.path.trim().is_empty() {
            continue;
        }
        let new_range = d.new_range.unwrap_or_default();
        let old_range = d.old_range.unwrap_or_default();
        let hunk_header = d.hunk_header.unwrap_or_default();
        let matches = known.iter().any(|(p, nr, hh)| {
            p == &d.path && (new_range.is_empty() || nr == &new_range) && (hunk_header.is_empty() || hh == &hunk_header)
        });
        if !matches {
            tracing::warn!(task = task.id, work = work_id, path = %d.path, "explainer: dropping note with unknown hunk anchor");
            continue;
        }
        let (final_old, final_new, final_header) = known
            .iter()
            .find(|(p, nr, hh)| {
                p == &d.path && (new_range.is_empty() || nr == &new_range) && (hunk_header.is_empty() || hh == &hunk_header)
            })
            .map(|(_, nr, hh)| {
                let old = parsed
                    .files
                    .iter()
                    .find(|f| f.path == d.path)
                    .and_then(|f| f.hunks.iter().find(|h| &h.new_range == nr && hh == &h.header))
                    .map(|h| h.old_range.clone())
                    .unwrap_or_else(|| old_range.clone());
                (old, nr.clone(), hh.clone())
            })
            .unwrap_or((old_range, new_range, hunk_header));
        db::insert_diff_note(
            &conn,
            task.id,
            work_id,
            &parsed.commit_sha,
            &d.path,
            &final_old,
            &final_new,
            &final_header,
            body,
            &source,
        )?;
        inserted += 1;
    }
    tracing::info!(task = task.id, work = work_id, inserted, "explainer: notes stored");
    Ok(inserted)
}

