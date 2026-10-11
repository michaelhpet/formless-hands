use anyhow::{Context, Result};
use serde::Deserialize;

fn default_poll_cron() -> String {
    "0 0 * * * *".into()
}
fn default_watch_cron() -> String {
    "0 */2 * * * *".into()
}
fn default_max_workers() -> usize {
    1
}

fn default_server_port() -> u16 {
    7770
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct Config {
    #[serde(default)]
    pub service: Service,
    #[serde(default)]
    pub server: Server,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
pub struct Service {
    #[serde(default = "default_poll_cron")]
    pub poll_cron: String,
    #[serde(default = "default_watch_cron")]
    pub watch_cron: String,
    #[serde(default = "default_max_workers")]
    pub max_concurrent_workers: usize,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Server {
    #[serde(default = "default_server_port")]
    pub port: u16,
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

pub fn load() -> Result<Config> {
    let p = expand_home("~/.config/formless-hands/config.toml");
    if !p.exists() {
        let cfg = Config::default();
        normalize_cron("poll_cron", &cfg.service.poll_cron)?;
        normalize_cron("watch_cron", &cfg.service.watch_cron)?;
        return Ok(cfg);
    }
    let raw = std::fs::read_to_string(&p).with_context(|| format!("read {}", p.display()))?;
    let cfg: Config = toml::from_str(&raw).with_context(|| format!("parse {}", p.display()))?;
    normalize_cron("poll_cron", &cfg.service.poll_cron).with_context(|| format!("parse {}", p.display()))?;
    normalize_cron("watch_cron", &cfg.service.watch_cron)
        .with_context(|| format!("parse {}", p.display()))?;
    Ok(cfg)
}

