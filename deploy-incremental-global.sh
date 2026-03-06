#!/bin/bash
#
# Incremental Global Deployment
#
# Deploys git-changed files directly to global plugin directory.
# Handles both additions/updates AND deletions.
#

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

GLOBAL_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SOURCE_AGENTS_DIR="$SCRIPT_DIR/agents"
SOURCE_COMMANDS_DIR="$SCRIPT_DIR/commands"
SOURCE_SKILLS_DIR="$SCRIPT_DIR/skills"
SOURCE_HOOKS_DIR="$SCRIPT_DIR/hooks"
SOURCE_RULES_DIR="$SCRIPT_DIR/rules"

GLOBAL_AGENTS_DIR="$GLOBAL_PLUGIN_ROOT/agents"
GLOBAL_COMMANDS_DIR="$GLOBAL_PLUGIN_ROOT/commands"
GLOBAL_SKILLS_DIR="$GLOBAL_PLUGIN_ROOT/skills"
GLOBAL_HOOKS_DIR="$GLOBAL_PLUGIN_ROOT/hooks"
GLOBAL_RULES_DIR="$GLOBAL_PLUGIN_ROOT/rules"

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Incremental Global Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $GLOBAL_PLUGIN_ROOT"
echo ""

if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo -e "${RED}Error: Not in a git repository${NC}"
  exit 1
fi

mkdir -p "$GLOBAL_AGENTS_DIR"
mkdir -p "$GLOBAL_COMMANDS_DIR"
mkdir -p "$GLOBAL_SKILLS_DIR"
mkdir -p "$GLOBAL_HOOKS_DIR"
mkdir -p "$GLOBAL_RULES_DIR"

copy_file() {
  local src="$1"
  local dest="$2"
  local is_script="$3"

  if [ -f "$src" ]; then
    cp "$src" "$dest"
    if [ "$is_script" = "true" ]; then
      chmod +x "$dest"
    fi
    echo -e "  ${GREEN}+${NC} $(basename "$src")"
    return 0
  fi
  return 1
}

remove_file() {
  local dest="$1"
  local name="$2"

  if [ -L "$dest" ] || [ -f "$dest" ]; then
    rm "$dest"
    echo -e "  ${RED}-${NC} $name"
    return 0
  fi

  return 1
}

deploy_agents() {
  echo -e "${YELLOW}Processing agents...${NC}"
  local added=0
  local deleted=0

  local changed=$(git diff --name-status HEAD agents/ 2>/dev/null | grep '\.md$' || echo "")
  if [ -n "$changed" ]; then
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')

      if [ "$status" = "D" ]; then
        if remove_file "$GLOBAL_AGENTS_DIR/$(basename "$file")" "$(basename "$file")"; then
          ((deleted++)) || true
        fi
      else
        if copy_file "$SCRIPT_DIR/$file" "$GLOBAL_AGENTS_DIR/$(basename "$file")" "false"; then
          ((added++)) || true
        fi
      fi
    done <<< "$changed"
  fi

  echo -e "${GREEN}  Added: $added, Deleted: $deleted${NC}"
}

deploy_commands() {
  echo ""
  echo -e "${YELLOW}Processing commands...${NC}"
  local added=0
  local deleted=0

  local changed=$(git diff --name-status HEAD commands/ 2>/dev/null | grep '\.md$' || echo "")
  if [ -n "$changed" ]; then
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')

      if [ "$status" = "D" ]; then
        if remove_file "$GLOBAL_COMMANDS_DIR/$(basename "$file")" "$(basename "$file")"; then
          ((deleted++)) || true
        fi
      else
        if copy_file "$SCRIPT_DIR/$file" "$GLOBAL_COMMANDS_DIR/$(basename "$file")" "false"; then
          ((added++)) || true
        fi
      fi
    done <<< "$changed"
  fi

  echo -e "${GREEN}  Added: $added, Deleted: $deleted${NC}"
}

deploy_skills() {
  echo ""
  echo -e "${YELLOW}Processing skills...${NC}"
  local added=0
  local deleted=0

  local changed=$(git diff --name-status HEAD skills/ 2>/dev/null || echo "")
  if [ -n "$changed" ]; then
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')

      local skill_name=$(echo "$file" | sed 's|^skills/||' | cut -d'/' -f1)
      local target_dir="$GLOBAL_SKILLS_DIR/$skill_name"

      if [ "$status" = "D" ]; then
        local rel_path=$(echo "$file" | sed "s|^skills/$skill_name/||")

        if [ "$(basename "$file")" = "SKILL.md" ]; then
          if remove_file "$target_dir/SKILL.md" "$skill_name/SKILL.md"; then
            ((deleted++)) || true
          fi
        elif [[ "$file" == *"/scripts/"* ]]; then
          local script_name=$(basename "$file")
          if remove_file "$target_dir/scripts/$script_name" "$skill_name/scripts/$script_name"; then
            ((deleted++)) || true
          fi
        elif [[ "$file" == *"/dashboard/"* ]]; then
          local dash_name=$(basename "$file")
          if remove_file "$target_dir/dashboard/$dash_name" "$skill_name/dashboard/$dash_name"; then
            ((deleted++)) || true
          fi
        fi
      else
        if [ "$(basename "$file")" = "SKILL.md" ]; then
          mkdir -p "$target_dir"
          if copy_file "$SCRIPT_DIR/$file" "$target_dir/SKILL.md" "false"; then
            ((added++)) || true
          fi
        elif [[ "$file" == *"/scripts/"* ]]; then
          mkdir -p "$target_dir/scripts"
          local script_name=$(basename "$file")
          if copy_file "$SCRIPT_DIR/$file" "$target_dir/scripts/$script_name" "true"; then
            ((added++)) || true
          fi
        elif [[ "$file" == *"/dashboard/"* ]]; then
          mkdir -p "$target_dir/dashboard"
          local dash_name=$(basename "$file")
          if copy_file "$SCRIPT_DIR/$file" "$target_dir/dashboard/$dash_name" "false"; then
            ((added++)) || true
          fi
        fi
      fi
    done <<< "$changed"
  fi

  echo -e "${GREEN}  Added: $added, Deleted: $deleted${NC}"
}

deploy_hooks() {
  echo ""
  echo -e "${YELLOW}Processing hooks...${NC}"
  local added=0
  local deleted=0

  local changed=$(git diff --name-status HEAD hooks/ 2>/dev/null || echo "")
  if [ -n "$changed" ]; then
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')
      local file_name=$(basename "$file")

      if [ "$status" = "D" ]; then
        if remove_file "$GLOBAL_HOOKS_DIR/$file_name" "$file_name"; then
          ((deleted++)) || true
        fi
      else
        if copy_file "$SCRIPT_DIR/$file" "$GLOBAL_HOOKS_DIR/$file_name" "true"; then
          ((added++)) || true
        fi
      fi
    done <<< "$changed"
  fi

  # Process scripts/hooks directory (referenced by hooks.json)
  local scripts_changed=$(git diff --name-status HEAD scripts/hooks/ 2>/dev/null || echo "")
  if [ -n "$scripts_changed" ]; then
    mkdir -p "$GLOBAL_PLUGIN_ROOT/scripts/hooks"
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')
      local file_name=$(basename "$file")

      if [ "$status" = "D" ]; then
        if remove_file "$GLOBAL_PLUGIN_ROOT/scripts/hooks/$file_name" "scripts/hooks/$file_name"; then
          ((deleted++)) || true
        fi
      else
        if copy_file "$SCRIPT_DIR/$file" "$GLOBAL_PLUGIN_ROOT/scripts/hooks/$file_name" "true"; then
          ((added++)) || true
        fi
      fi
    done <<< "$scripts_changed"
  fi

  echo -e "${GREEN}  Added: $added, Deleted: $deleted${NC}"
}

deploy_rules() {
  echo ""
  echo -e "${YELLOW}Processing rules...${NC}"
  local added=0
  local deleted=0

  local changed=$(git diff --name-status HEAD rules/ 2>/dev/null | grep '\.md$' || echo "")
  if [ -n "$changed" ]; then
    while IFS= read -r line; do
      local status=$(echo "$line" | cut -c1)
      local file=$(echo "$line" | cut -c2- | sed 's/^[[:space:]]*//')

      if [ "$status" = "D" ]; then
        if remove_file "$GLOBAL_RULES_DIR/$(basename "$file")" "$(basename "$file")"; then
          ((deleted++)) || true
        fi
      else
        if copy_file "$SCRIPT_DIR/$file" "$GLOBAL_RULES_DIR/$(basename "$file")" "false"; then
          ((added++)) || true
        fi
      fi
    done <<< "$changed"
  fi

  echo -e "${GREEN}  Added: $added, Deleted: $deleted${NC}"
}

deploy_agents
deploy_commands
deploy_skills
deploy_hooks
deploy_rules

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Global plugin directory: $GLOBAL_PLUGIN_ROOT"
echo ""
echo "Files have been copied from project source."
echo "Changes to source files will require re-running this script."
echo ""
echo "To use the deployed plugin:"
echo "  1. Restart Claude Code"
echo "  2. Or reload the plugin in your current session"
echo ""
