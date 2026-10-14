use serde::Serialize;
use std::sync::OnceLock;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
pub struct Event {
    pub seq: u64,
    pub kind: String,
    pub project_id: Option<i64>,
    pub task_id: Option<i64>,
    pub work_id: Option<i64>,
    pub message: String,
}

static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
static BUS: OnceLock<broadcast::Sender<Event>> = OnceLock::new();

fn bus() -> &'static broadcast::Sender<Event> {
    BUS.get_or_init(|| broadcast::channel(256).0)
}

pub fn subscribe() -> broadcast::Receiver<Event> {
    bus().subscribe()
}

pub fn publish(
    kind: &str,
    project_id: Option<i64>,
    task_id: Option<i64>,
    work_id: Option<i64>,
    message: String,
) {
    let seq = SEQ.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
    let event = Event {
        seq,
        kind: kind.to_string(),
        project_id,
        task_id,
        work_id,
        message,
    };
    let _ = bus().send(event);
}
