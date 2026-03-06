---
description: Generate project snapshot by analyzing plans and creating structured JSON data for dashboard visualization
---

# Snapshot Command

Generate and visualize project state snapshots using LLM-powered plan analysis - track requirements, iterations, tasks, modules, and test coverage.

## What This Command Does

1. **Detect Plan Changes** - Scan `.claude/plans/*/` and identify which plans need processing
2. **Initialize Environment** - Create `status.json` and empty JSON templates for new/modified plans
3. **Analyze & Populate** - LLM extracts data from `plan.md` to fill the JSON templates
4. **Finalize Snapshot** - Sync completion rates, test coverage, and mark processing as complete
5. **Launch Dashboard** - Start web server to visualize project status

## When to Use

Use `/snapshot` when:
- After completing a plan or major task
- Before committing significant changes
- To visualize current project status
- To track progress over time
- After `/plan` to update the dashboard

## Quick Start

Just run `/snapshot` - that's it!

The agent will:
1. **Scan** your plans
2. **Generate/update** JSON files
3. **Launch** dashboard at http://localhost:3847
4. **Open** dashboard in your browser

**To stop the dashboard**: Press Ctrl+C in the terminal

## How It Works (Execution Steps)

The agent follows this workflow:

### Step 1: Detect Plan Changes

Call: `node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/detect-plan-changes.js"`

Output: List of new and modified plans (unchanged plans are skipped)

### Step 2: Process Each Changed Plan

For each changed plan directory:

#### 1. Initialize Snapshot Environment
Call the script without flags to ensure `status.json` and empty templates exist:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/init-plan-snapshot.js" ".claude/plans/{plan-id}"
```

#### 2. Analyze & Populate Templates
Read `.claude/plans/{plan-id}/plan.md` and populate the following files. **CRITICAL: Maintain the existing JSON structure and data types.**
- `.claude/plans/{plan-id}/requirements.json`
- `.claude/plans/{plan-id}/tasks.json`
- `.claude/plans/{plan-id}/modules.json`

#### 3. Update Test Coverage
Call coverage reader:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/read-coverage.js"
```
Then update `tasks.json` with coverage data.

#### 4. Finalize Status & Stats
Call the script with `--complete` to calculate final completion rates and mark as done:
```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/init-plan-snapshot.js" ".claude/plans/{plan-id}" --complete
```

### Step 3: Launch Dashboard

Start dashboard server: `node "${CLAUDE_PLUGIN_ROOT}/skills/project-snapshot/scripts/dashboard-server.js"`

Open browser to `http://localhost:3847`

## Example Usage

```
User: /snapshot

Agent:
[Snapshot] Detecting plan changes...
[Snapshot] Found 2 plan(s) to update

[Snapshot] Processing: plan-auth
[Snapshot]   → Initialized templates
[Snapshot]   → Analyzed plan.md & populated JSON data
[Snapshot]   → Updated test coverage
[Snapshot]   → Finalized status (Progress: 85%)

[Dashboard] Starting server at http://localhost:3847
✅ Snapshot complete! Open http://localhost:3847
```

## Output Files (Per-Plan)

```
.claude/plans/{plan-id}/
├── requirements.json  # Requirements with status, priority, acceptance criteria
├── tasks.json         # Iterations and tasks with TDD info
├── modules.json       # Module completion rates and features
└── status.json        # Processing status and timestamps
```

## Data Structures

### requirements.json
```json
{
  "project_name": "My Project",
  "requirements": [{
    "requirement_id": "REQ-001",
    "title": "Feature Title",
    "priority": "high",
    "status": "in_progress",
    "description": "Details...",
    "acceptance_criteria": ["Criteria 1"]
  }]
}
```

### tasks.json
```json
{
  "project_name": "My Project",
  "current_iteration": "ITER-001",
  "iterations": [{
    "iteration_id": "ITER-001",
    "iteration_name": "Phase 1",
    "status": "in_progress",
    "tasks": [{
      "task_id": "TASK-001",
      "task_name": "Do something",
      "status": "completed",
      "tdd": {
        "test_cases": ["Should work"],
        "coverage_actual": 85
      }
    }]
  }]
}
```

## Performance Benefits

- **Faster Processing** - Only changed plans are re-analyzed
- **Lower Token Usage** - Stable plans reuse existing JSON
- **Instant Dashboard** - No regeneration needed for unchanged plans

## Related Skills

- `project-snapshot` - Complete snapshot system documentation
- `strategic-compact` - Context management strategies
