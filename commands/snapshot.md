---
description: Generate project snapshot and update observability dashboard
---

# Snapshot Command

Generate and visualize project state snapshots - track iterations, tasks, modules, and health metrics over time.

## What This Command Does

1. **Generate Snapshot** - Captures current project state (iterations, tasks, modules, git status, dependencies)
2. **Update Dashboard** - Regenerates the observability.html visualization
3. **Track Progress** - Saves snapshot to `.claude/snapshots/` for historical tracking

## When to Use

Use `/snapshot` when:
- After completing a plan or major task
- Before committing significant changes
- To visualize current project status
- To track progress over time
- After `/plan` to update the dashboard

## How It Works

The command runs both scripts in sequence:

1. `node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js"`
   - Collects git info, dependencies, modules, iterations, tasks
   - Saves to `.claude/snapshots/snap-YYYYMMDD-NNNNNN.json`

2. `node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/dashboard.js" --mode static --output observability.html`
   - Generates HTML visualization from all snapshots
   - Shows iterations, tasks, modules, language stats, git status

## Example Usage

```
User: /snapshot

Agent:
[Snapshot] Generating snapshot for: my-project
[Snapshot] Found 1 iteration(s)
[Snapshot] Found 10 task(s)
[Snapshot] Scanning files for language stats...
[Snapshot] Total files scanned: 267
[Snapshot] Saved to: .claude/snapshots/snap-20260303-022130.json

[Dashboard] Generated HTML: observability.html
[Dashboard] Included 4 snapshot(s)

✅ Snapshot complete! Open observability.html to view project status.
```

## Output

Files created/updated:
- `.claude/snapshots/snap-*.json` - Latest snapshot data
- `observability.html` - Interactive dashboard

## Automation

This command also runs automatically:
- After `/plan` saves a plan file (via auto-snapshot hook)
- Can be triggered manually anytime

## Configuration

Edit `.claude/project-snapshot.json` in your project root to customize:

```json
{
  "snapshotDir": ".claude/snapshots",
  "maxSnapshots": 30,
  "trackOnSessionEnd": true
}
```

## Related

- `project-snapshot` skill - Full documentation
- `strategic-compact` skill - Context management
- `continuous-learning` skill - Extract patterns from sessions
