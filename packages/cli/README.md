# Agentic Insights

`agentic-insights` launches a local dashboard that reads your Codex and Claude Code usage artifacts and helps you understand coding-agent usage with token, water, energy, and carbon estimates.

## Run

```bash
npx agentic-insights@0.2.0
```

That command starts a local server, opens the dashboard in your browser, and reads usage data from your machine.

You can also install a reusable command:

```bash
npm install -g agentic-insights
agentic-insights
```

## Useful flags

```bash
agentic-insights --port 3001
agentic-insights --host 127.0.0.1
agentic-insights --codex-home /path/to/.codex
agentic-insights --no-open
```

## Data source

By default the app reads local Codex artifacts from:

- `~/.codex/sessions`
- `~/.codex/archived_sessions`
- `~/.codex/log/codex-tui.log`
- `~/.claude/projects`
- `~/.claude/usage-data/session-meta`

Override the Codex location with `--codex-home` or `CODEX_HOME=/path/to/.codex`. Claude Code usage is read from the default `~/.claude` home for the current user.

## Repository

- Source: https://github.com/max-stoddard/agentic-insights
- Issues: https://github.com/max-stoddard/agentic-insights/issues
