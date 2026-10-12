use anyhow::{Context, Result};
use serde::Serialize;

const MAX_DIFF_BYTES: usize = 2_000_000;

#[derive(Debug, Clone, Serialize)]
pub struct DiffLine {
    pub no: i64,
    pub text: String,
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedHunk {
    pub old_range: String,
    pub new_range: String,
    pub header: String,
    pub old_lines: Vec<DiffLine>,
    pub new_lines: Vec<DiffLine>,
    pub added: usize,
    pub removed: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedFile {
    pub path: String,
    pub stats: String,
    pub hunks: Vec<ParsedHunk>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParsedDiff {
    pub files: Vec<ParsedFile>,
    pub commit_sha: String,
    pub truncated: bool,
}

async fn git_out(dir: &str, args: &[&str]) -> Result<String> {
    let out = tokio::process::Command::new("git")
        .arg("-C")
        .arg(dir)
        .args(args)
        .output()
        .await
        .context("run git")?;
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
    }
    let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
    anyhow::bail!("git {} failed: {err}", args.join(" "))
}

fn range_label(start: i64, len: i64) -> String {
    if len <= 1 {
        return format!("{start}");
    }
    format!("{start}-{}", start + len - 1)
}

fn parse_hunk_header(header: &str) -> Option<(i64, i64, i64, i64, String)> {
    let header = header.trim();
    if !header.starts_with("@@") {
        return None;
    }
    let end = header[2..].find("@@").map(|i| i + 2)?;
    let ranges = header[2..end].trim();
    let context = header[end + 2..].trim().to_string();
    let mut parts = ranges.split_whitespace();
    let old = parts.next()?.strip_prefix('-')?;
    let new = parts.next()?.strip_prefix('+')?;
    let (old_start, old_len) = match old.split_once(',') {
        Some((s, l)) => (s.parse().ok()?, l.parse().ok()?),
        None => (old.parse().ok()?, 1),
    };
    let (new_start, new_len) = match new.split_once(',') {
        Some((s, l)) => (s.parse().ok()?, l.parse().ok()?),
        None => (new.parse().ok()?, 1),
    };
    Some((old_start, old_len, new_start, new_len, context))
}

fn file_path_from_diff_header(line: &str) -> Option<String> {
    let rest = line.strip_prefix("diff --git ")?;
    let mut parts = rest.split_whitespace();
    let a = parts.next()?;
    let b = parts.next()?;
    let b = b.strip_prefix("b/").unwrap_or(b);
    let _ = a;
    Some(b.to_string())
}

pub fn parse_unified_diff(raw: &str) -> (Vec<ParsedFile>, bool) {
    let mut files: Vec<ParsedFile> = Vec::new();
    let mut current_path: Option<String> = None;
    let mut current_hunks: Vec<ParsedHunk> = Vec::new();
    let mut hunk: Option<(String, i64, i64, Vec<DiffLine>, Vec<DiffLine>, usize, usize)> = None;
    let truncated = false;

    let flush_hunk = |hunks: &mut Vec<ParsedHunk>,
                          slot: &mut Option<(String, i64, i64, Vec<DiffLine>, Vec<DiffLine>, usize, usize)>| {
        if let Some((header, _old_cursor, _new_cursor, old_lines, new_lines, removed, added)) = slot.take() {
            if let Some((old_start, _, new_start, _, _)) = parse_hunk_header(&header) {
                let old_count = (old_lines.len() as i64).max(1);
                let new_count = (new_lines.len() as i64).max(1);
                hunks.push(ParsedHunk {
                    old_range: range_label(old_start, old_count),
                    new_range: range_label(new_start, new_count),
                    header,
                    old_lines,
                    new_lines,
                    added,
                    removed,
                });
            }
        }
    };

    for line in raw.lines() {
        if line.starts_with("diff --git ") {
            if let Some(path) = current_path.take() {
                flush_hunk(&mut current_hunks, &mut hunk);
                let (added, removed) =
                    current_hunks.iter().fold((0, 0), |(a, r), h| (a + h.added, r + h.removed));
                files.push(ParsedFile {
                    stats: format!("+{added} -{removed}"),
                    path,
                    hunks: std::mem::take(&mut current_hunks),
                });
            }
            current_path = file_path_from_diff_header(line);
            current_hunks = Vec::new();
            continue;
        }
        if line.starts_with("@@ ") {
            flush_hunk(&mut current_hunks, &mut hunk);
            let (old_start, _, new_start, _, _) = parse_hunk_header(line).unwrap_or((1, 1, 1, 1, String::new()));
            hunk = Some((line.to_string(), old_start, new_start, Vec::new(), Vec::new(), 0, 0));
            continue;
        }
        if line.starts_with("+++ ") || line.starts_with("--- ") || line.starts_with("index ") || line.starts_with("new file") || line.starts_with("old mode") || line.starts_with("new mode") {
            if line.starts_with("+++ b/") && current_path.is_none() {
                current_path = Some(line[6..].to_string());
            }
            continue;
        }
        if line.starts_with("\\ ") {
            continue;
        }
        let Some((_, old_no, new_no, old_lines, new_lines, removed, added)) = hunk.as_mut() else {
            continue;
        };
        if let Some(content) = line.strip_prefix('+') {
            new_lines.push(DiffLine { no: *new_no, text: content.to_string(), kind: "added".to_string() });
            *new_no += 1;
            *added += 1;
        } else if let Some(content) = line.strip_prefix('-') {
            old_lines.push(DiffLine { no: *old_no, text: content.to_string(), kind: "removed".to_string() });
            *old_no += 1;
            *removed += 1;
        } else if let Some(content) = line.strip_prefix(' ') {
            old_lines.push(DiffLine { no: *old_no, text: content.to_string(), kind: "context".to_string() });
            new_lines.push(DiffLine { no: *new_no, text: content.to_string(), kind: "context".to_string() });
            *old_no += 1;
            *new_no += 1;
        } else {
            continue;
        }
        let _ = (old_lines, new_lines, removed, added);
    }
    if let Some(path) = current_path.take() {
        flush_hunk(&mut current_hunks, &mut hunk);
        let (added, removed) =
            current_hunks.iter().fold((0, 0), |(a, r), h| (a + h.added, r + h.removed));
        files.push(ParsedFile {
            stats: format!("+{added} -{removed}"),
            path,
            hunks: std::mem::take(&mut current_hunks),
        });
    }
    files.retain(|f| !f.hunks.is_empty());
    (files, truncated)
}

fn cap_bytes(s: &str) -> (String, bool) {
    if s.len() <= MAX_DIFF_BYTES {
        return (s.to_string(), false);
    }
    (format!("{}\n…[truncated]", &s[..MAX_DIFF_BYTES]), true)
}

pub async fn diff_for_worktree(worktree: &str, base: &str) -> Result<(ParsedDiff, String)> {
    let raw = git_out(worktree, &["diff", "--no-color", "--unified=3", &format!("{base}...HEAD"), "--"])
        .await
        .context("diff worktree against base")?;
    let commit_sha = git_out(worktree, &["rev-parse", "HEAD"]).await.unwrap_or_default().trim().to_string();
    let (raw_capped, size_truncated) = cap_bytes(&raw);
    let (files, parse_truncated) = parse_unified_diff(&raw_capped);
    Ok((
        ParsedDiff { files, commit_sha, truncated: size_truncated || parse_truncated },
        raw_capped,
    ))
}

pub async fn diff_for_branch(checkout: &str, base: &str, branch: &str) -> Result<(ParsedDiff, String)> {
    let raw = git_out(checkout, &["diff", "--no-color", "--unified=3", &format!("{base}...{branch}"), "--"])
        .await
        .context("diff branch against base")?;
    let commit_sha = git_out(checkout, &["rev-parse", branch]).await.unwrap_or_default().trim().to_string();
    let (raw_capped, size_truncated) = cap_bytes(&raw);
    let (files, parse_truncated) = parse_unified_diff(&raw_capped);
    Ok((
        ParsedDiff { files, commit_sha, truncated: size_truncated || parse_truncated },
        raw_capped,
    ))
}

pub async fn commit_messages_worktree(worktree: &str, base: &str, max_chars: usize) -> String {
    let out = git_out(worktree, &["log", "--format=%s%n%b", &format!("{base}...HEAD"), "--"]).await.unwrap_or_default();
    if out.len() <= max_chars {
        return out.trim().to_string();
    }
    format!("{}\n…[truncated]", &out[..max_chars])
}

