---
name: project-snapshot
description: Generate and visualize project state snapshots - track iterations, tasks, modules, and health metrics over time.
origin: ECC (Everything Claude Code)
---

# Project Snapshot Skill

Generate project state snapshots that capture iterations, tasks, module status, and health metrics. Visualize project progress through an interactive dashboard.

## When to Activate

- Starting a new project or phase
- Before major refactoring
- After completing significant milestones
- When you need to visualize project health
- During long sessions to understand current state

## Why Project Snapshots?

Claude Code sessions are ephemeral - context is lost between sessions. Project snapshots provide:

- **Persistent project memory** - What was done, what's in progress, what's blocked
- **Health metrics** - Test coverage, dependency status, code quality
- **Visual progress** - Dashboard showing iterations and module completion
- **Historical tracking** - Snapshots over time show trajectory

## Commands

### `/snapshot`

Generate a project state snapshot. Captures:
- Current git branch and status
- Dependencies and their health
- Test status and coverage
- Module completion rates
- Recent changes

```bash
# Generate snapshot
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js"

# Generate and save to custom path
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js" --output .claude/snapshots/sprint-1.json
```

### `/snapshot dashboard`

Start an interactive dashboard (requires Node.js) OR generate static HTML:

```bash
# Start web dashboard (requires npm install express)
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/dashboard.js" --mode web

# Generate static HTML report
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/dashboard.js" --mode static --output snapshot.html
```

### `/snapshot status`

Quick status check - shows current snapshot summary without generating new one:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/status.js"
```

### `/snapshot track <module> <status>`

Track a specific module's status:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js" --track auth-module --status developed
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js" --track api-v2 --status confirmed
```

## Configuration

Edit `config.json` to customize:

```json
{
  "snapshotDir": ".claude/snapshots",
  "maxSnapshots": 30,
  "trackOnSessionEnd": true,
  "includePatterns": ["src/**", "tests/**"],
  "excludePatterns": ["node_modules/**", "dist/**", "*.log"]
}
```

## Data Format

Snapshots are stored as JSON with this structure:

```json
{
  "project_name": "my-project",
  "snapshot_id": "snap-2024-01-15-001",
  "timestamp": "2024-01-15T10:30:00Z",
  "git": {
    "branch": "main",
    "commit": "abc123",
    "status": "clean"
  },
  "dependencies": [...],
  "modules": [...],
  "health": {
    "tests": { "passed": 45, "failed": 2 },
    "coverage": 78.5,
    "lint": "passed"
  }
}
```

See `references/data-format.md` for full schema.

## Integration with Hooks

The skill integrates with Claude Code hooks for automatic tracking:

- **SessionEnd**: Auto-generate snapshot if significant changes detected
- **PreCompact**: Save current snapshot state before compaction
- **SessionStart**: Load latest snapshot into context

Add to `hooks.json`:

```json
{
  "SessionEnd": [
    {
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "node \"${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/snapshot.js\" --auto"
      }]
    }
  ]
}
```

## Use Cases

1. **Sprint tracking** - Each sprint generates a snapshot; compare progress over time
2. **Refactoring safety** - Snapshot before major refactor; rollback if needed
3. **Onboarding** - New team members see current project state at a glance
4. **Health monitoring** - Track test coverage and lint status over time

## Related

- `strategic-compact` skill - Context management
- `continuous-learning` skill - Extract patterns from sessions
- Session hooks in `scripts/hooks/` - Session persistence
