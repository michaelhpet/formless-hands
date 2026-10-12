use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

fn default_poll_cron() -> String {
    "0 0 * * * *".into()
}
fn default_watch_cron() -> String {
    "0 */2 * * * *".into()
}
fn default_max_workers() -> usize {
    1
}
fn default_work_timeout_secs() -> u64 {
    1800
}

fn default_server_port() -> u16 {
    7770
}

fn default_merge_mode() -> String {
    "local".into()
}
fn default_prompt_diff_chars() -> usize {
    60_000
}
fn default_transcript_chars() -> usize {
    8_000
}
fn default_commits_chars() -> usize {
    4_000
}
fn default_max_batches() -> usize {
    4
}

#[derive(Debug, Deserialize, Serialize, Clone, Default)]
pub struct Config {
    #[serde(default)]
    pub service: Service,
    #[serde(default)]
    pub server: Server,
    #[serde(default)]
    pub merge: Merge,
    #[serde(default)]
    pub explain: Explain,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[allow(dead_code)]
pub struct Service {
    #[serde(default = "default_poll_cron")]
    pub poll_cron: String,
    #[serde(default = "default_watch_cron")]
    pub watch_cron: String,
    #[serde(default = "default_max_workers")]
    pub max_concurrent_workers: usize,
    #[serde(default = "default_work_timeout_secs")]
    pub work_timeout_secs: u64,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Server {
    #[serde(default = "default_server_port")]
    pub port: u16,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Merge {
    #[serde(default = "default_merge_mode")]
    pub mode: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Explain {
    #[serde(default = "default_prompt_diff_chars")]
    pub prompt_diff_chars: usize,
    #[serde(default = "default_transcript_chars")]
    pub transcript_chars: usize,
    #[serde(default = "default_commits_chars")]
    pub commits_chars: usize,
    #[serde(default = "default_max_batches")]
    pub max_batches: usize,
}

impl Default for Explain {
    fn default() -> Self {
        Self {
            prompt_diff_chars: default_prompt_diff_chars(),
            transcript_chars: default_transcript_chars(),
            commits_chars: default_commits_chars(),
            max_batches: default_max_batches(),
        }
    }
}

impl Default for Merge {
    fn default() -> Self {
        Self {
            mode: default_merge_mode(),
        }
    }
}

impl Default for Server {
    fn default() -> Self {
        Self {
            port: default_server_port(),
        }
    }
}

impl Default for Service {
    fn default() -> Self {
        Self {
            poll_cron: default_poll_cron(),
            watch_cron: default_watch_cron(),
            max_concurrent_workers: default_max_workers(),
            work_timeout_secs: default_work_timeout_secs(),
        }
    }
}

pub(crate) fn expand_home(s: &str) -> std::path::PathBuf {
    match s.strip_prefix("~/") {
        Some(rest) => std::env::var("HOME")
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|_| std::path::PathBuf::from("."))
            .join(rest),
        None => std::path::PathBuf::from(s),
    }
}

pub fn normalize_cron(label: &str, expr: &str) -> Result<String> {
    let trimmed = expr.trim();
    if trimmed.is_empty() {
        anyhow::bail!("bad {label} '' — expected cron like \"0 0 * * * *\"");
    }
    let fields: Vec<&str> = trimmed.split_whitespace().collect();
    match fields.len() {
        5 => Ok(format!("0 {trimmed}")),
        6 | 7 => Ok(trimmed.to_string()),
        n => anyhow::bail!(
            "bad {label} '{expr}' — expected 5-7 space-separated fields, got {n}"
        ),
    }
}

pub fn path() -> std::path::PathBuf {
    expand_home("~/.config/formless-hands/config.toml")
}

pub fn validate(cfg: &Config) -> Result<()> {
    normalize_cron("poll_cron", &cfg.service.poll_cron)?;
    normalize_cron("watch_cron", &cfg.service.watch_cron)?;
    if !(1..=32).contains(&cfg.service.max_concurrent_workers) {
        anyhow::bail!(
            "bad max_concurrent_workers {} — expected 1-32",
            cfg.service.max_concurrent_workers
        );
    }
    if cfg.server.port == 0 {
        anyhow::bail!("bad port 0 — expected 1-65535");
    }
    if !(60..=86400).contains(&cfg.service.work_timeout_secs) {
        anyhow::bail!(
            "bad work_timeout_secs {} — expected 60-86400",
            cfg.service.work_timeout_secs
        );
    }
    if cfg.merge.mode != "local" && cfg.merge.mode != "pr" {
        anyhow::bail!(
            "bad merge mode '{}' — expected local or pr",
            cfg.merge.mode
        );
    }
    if cfg.explain.prompt_diff_chars < 1000 {
        anyhow::bail!(
            "bad prompt_diff_chars {} — expected at least 1000",
            cfg.explain.prompt_diff_chars
        );
    }
    if cfg.explain.transcript_chars < 1000 {
        anyhow::bail!(
            "bad transcript_chars {} — expected at least 1000",
            cfg.explain.transcript_chars
        );
    }
    if cfg.explain.commits_chars < 500 {
        anyhow::bail!(
            "bad commits_chars {} — expected at least 500",
            cfg.explain.commits_chars
        );
    }
    if !(1..=10).contains(&cfg.explain.max_batches) {
        anyhow::bail!(
            "bad max_batches {} — expected 1-10",
            cfg.explain.max_batches
        );
    }
    Ok(())
}

pub fn load() -> Result<Config> {
    let p = path();
    if !p.exists() {
        let cfg = Config::default();
        validate(&cfg)?;
        return Ok(cfg);
    }
    let raw = std::fs::read_to_string(&p).with_context(|| format!("read {}", p.display()))?;
    let cfg: Config = toml::from_str(&raw).with_context(|| format!("parse {}", p.display()))?;
    validate(&cfg).with_context(|| format!("parse {}", p.display()))?;
    Ok(cfg)
}

pub fn save(cfg: &Config) -> Result<()> {
    validate(cfg)?;
    let p = path();
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).with_context(|| format!("create {}", dir.display()))?;
    }
    let raw = toml::to_string(cfg).with_context(|| format!("encode {}", p.display()))?;
    std::fs::write(&p, raw).with_context(|| format!("write {}", p.display()))?;
    Ok(())
}

