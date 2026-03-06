#!/bin/bash
#
# Global Initialization Deployment
#
# Full deployment: copies ALL source files to global plugin directory.
# Use this for initial setup or complete reset.
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
echo -e "${BLUE}  Global Initialization Deployment${NC}"
echo -e "${BLUE}======================================${NC}"
echo ""
echo "Source: $SCRIPT_DIR"
echo "Target: $GLOBAL_PLUGIN_ROOT"
echo ""

mkdir -p "$GLOBAL_PLUGIN_ROOT"

deploy_agents() {
  echo -e "${YELLOW}Deploying agents...${NC}"
  mkdir -p "$GLOBAL_AGENTS_DIR"
  rm -f "$GLOBAL_AGENTS_DIR"/*.md 2>/dev/null || true
  local count=0
  for agent in "$SOURCE_AGENTS_DIR"/*.md; do
    if [ -f "$agent" ]; then
      cp "$agent" "$GLOBAL_AGENTS_DIR/"
      echo "  + $(basename "$agent")"
      ((count++)) || true
    fi
  done
  echo -e "${GREEN}  Deployed $count agent(s)${NC}"
}

deploy_commands() {
  echo ""
  echo -e "${YELLOW}Deploying commands...${NC}"
  mkdir -p "$GLOBAL_COMMANDS_DIR"
  rm -f "$GLOBAL_COMMANDS_DIR"/*.md 2>/dev/null || true
  local count=0
  for cmd in "$SOURCE_COMMANDS_DIR"/*.md; do
    if [ -f "$cmd" ]; then
      cp "$cmd" "$GLOBAL_COMMANDS_DIR/"
      echo "  + $(basename "$cmd")"
      ((count++)) || true
    fi
  done
  echo -e "${GREEN}  Deployed $count command(s)${NC}"
}

deploy_skills() {
  echo ""
  echo -e "${YELLOW}Deploying skills...${NC}"
  rm -rf "$GLOBAL_SKILLS_DIR" 2>/dev/null || true
  mkdir -p "$GLOBAL_SKILLS_DIR"
  local count=0
  for skill_dir in "$SOURCE_SKILLS_DIR"/*; do
    if [ -d "$skill_dir" ]; then
      local skill_name=$(basename "$skill_dir")
      local target_dir="$GLOBAL_SKILLS_DIR/$skill_name"
      mkdir -p "$target_dir"

      if [ -f "$skill_dir/SKILL.md" ]; then
        cp "$skill_dir/SKILL.md" "$target_dir/"
        echo "  + $skill_name/SKILL.md"
        ((count++)) || true
      fi

      if [ -d "$skill_dir/scripts" ]; then
        mkdir -p "$target_dir/scripts"
        for script in "$skill_dir/scripts"/*; do
          if [ -f "$script" ]; then
            local script_name=$(basename "$script")
            cp "$script" "$target_dir/scripts/"
            chmod +x "$target_dir/scripts/$script_name"
            echo "    + scripts/$script_name"
            ((count++)) || true
          fi
        done
      fi

      if [ -d "$skill_dir/dashboard" ]; then
        mkdir -p "$target_dir/dashboard"
        for dashboard_file in "$skill_dir/dashboard"/*; do
          if [ -f "$dashboard_file" ]; then
            cp "$dashboard_file" "$target_dir/dashboard/"
            echo "    + dashboard/$(basename "$dashboard_file")"
            ((count++)) || true
          fi
        done
      fi
    fi
  done
  echo -e "${GREEN}  Deployed $count skill file(s)${NC}"
}

deploy_hooks() {
  echo ""
  echo -e "${YELLOW}Deploying hooks...${NC}"
  mkdir -p "$GLOBAL_HOOKS_DIR"
  rm -f "$GLOBAL_HOOKS_DIR"/* 2>/dev/null || true
  local count=0

  if [ -f "$SOURCE_HOOKS_DIR/hooks.json" ]; then
    cp "$SOURCE_HOOKS_DIR/hooks.json" "$GLOBAL_HOOKS_DIR/"
    echo "  + hooks.json"
    ((count++)) || true
  fi

  for hook_script in "$SOURCE_HOOKS_DIR"/*.sh "$SOURCE_HOOKS_DIR"/*.js "$SOURCE_HOOKS_DIR"/*.py; do
    if [ -f "$hook_script" ]; then
      local hook_name=$(basename "$hook_script")
      cp "$hook_script" "$GLOBAL_HOOKS_DIR/"
      chmod +x "$GLOBAL_HOOKS_DIR/$hook_name"
      echo "  + $hook_name"
      ((count++)) || true
    fi
  done

  # Deploy scripts/hooks directory (referenced by hooks.json)
  if [ -d "$SCRIPT_DIR/scripts/hooks" ]; then
    mkdir -p "$GLOBAL_PLUGIN_ROOT/scripts/hooks"
    for hook_script in "$SCRIPT_DIR/scripts/hooks"/*.js; do
      if [ -f "$hook_script" ]; then
        cp "$hook_script" "$GLOBAL_PLUGIN_ROOT/scripts/hooks/"
        echo "    + scripts/hooks/$(basename "$hook_script")"
        ((count++)) || true
      fi
    done
  fi

  echo -e "${GREEN}  Deployed $count hook file(s)${NC}"
}

deploy_rules() {
  echo ""
  echo -e "${YELLOW}Deploying rules...${NC}"
  rm -rf "$GLOBAL_RULES_DIR" 2>/dev/null || true
  mkdir -p "$GLOBAL_RULES_DIR"
  local count=0

  # Use find to handle subdirectories recursively
  while IFS= read -r rule; do
    if [ -f "$rule" ]; then
      # Get relative path from rules directory
      local rel_path="${rule#$SOURCE_RULES_DIR/}"
      local target_path="$GLOBAL_RULES_DIR/$rel_path"

      # Create target directory if needed
      local target_dir=$(dirname "$target_path")
      mkdir -p "$target_dir"

      cp "$rule" "$target_path"
      echo "  + $rel_path"
      ((count++)) || true
    fi
  done < <(find "$SOURCE_RULES_DIR" -name "*.md" -type f)

  echo -e "${GREEN}  Deployed $count rule(s)${NC}"
}

deploy_agents
deploy_commands
deploy_skills
deploy_hooks
deploy_rules

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Global Initialization Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Global plugin directory: $GLOBAL_PLUGIN_ROOT"
echo ""
echo "To use the deployed plugin:"
echo "  1. Restart Claude Code"
echo "  2. Or reload the plugin in your current session"
echo ""
