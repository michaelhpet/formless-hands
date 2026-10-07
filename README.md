# Formless hands

Autonomous coding-agent orchestrator for Software Engineers. Core background service polls
task sources on a schedule, triages tasks, runs worker agents (`opencode` CLI) in git worktrees, follows PR reviews, and merges only after human approval.

Work is scoped per project. Each project attaches one repository plus any
number of task sources (Linear, GitHub Issues, etc.) that are polled regularly
to populate the task list. Tasks can also be added manually: Manage them
via `formless-hands project add|list|remove` and `formless-hands source add|list|remove|enable|disable`. `formless-hands project add` takes the SSH clone URL; a
missing checkout is cloned to `~/Work/<name>` with the system `git` setup.

One binary, two faces: `formless-hands run` is the background service, while `formless-hands project|source|task ...` are short-lived terminal commands against the same SQLite DB.

## Commands

```text
formless-hands run
formless-hands project add <ssh-url> [--name] [--path] | list | remove <name>
formless-hands source add --project <name> --kind <linear|github> [-s key=value ...]
             | list [--project] | remove <id> | enable <id> | disable <id>
formless-hands task create <title> --project <name> [--body] [--priority]
             | list [--project] [--status] [--limit] | update <id> [--status] [--priority] [--instructions]
```

## Development Setup

All commands run from the repo root (`bun` reads `./package.json`):

```sh
bun install
bun run dev      # Vite on :5173, /api proxied to http://127.0.0.1:7770
cargo run -- run
```

## Building for Production

```sh
bun run build            # → gui/dist/
cargo build --release    # embeds gui/dist/ into the formless-hands binary
```
