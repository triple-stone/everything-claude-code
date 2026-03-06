#!/bin/bash
#
# Project Snapshot Deployment Script
#
# Deploys the project-snapshot skill from the local project to the global plugin directory.
#
# Usage:
#   ./deploy.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the global plugin root directory
GLOBAL_PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$HOME/.claude}"

# Local directories
LOCAL_SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_SCRIPTS_DIR="$LOCAL_SKILL_DIR/scripts"
LOCAL_SKILL_MD="$LOCAL_SKILL_DIR/SKILL.md"

# Global directories
GLOBAL_SKILL_DIR="$GLOBAL_PLUGIN_ROOT/skills/project-snapshot"
GLOBAL_SCRIPTS_DIR="$GLOBAL_SKILL_DIR/scripts"

echo -e "${YELLOW}=== Project Snapshot Deployment ===${NC}"
echo ""
echo "Local source: $LOCAL_SKILL_DIR"
echo "Global target: $GLOBAL_SKILL_DIR"
echo ""

# Check if global directory exists
if [ ! -d "$GLOBAL_SKILL_DIR" ]; then
  echo -e "${RED}Error: Global plugin directory not found: $GLOBAL_SKILL_DIR${NC}"
  echo "Please ensure CLAUDE_PLUGIN_ROOT is set correctly."
  exit 1
fi

# Create scripts directory if it doesn't exist
mkdir -p "$GLOBAL_SCRIPTS_DIR"

# Copy script files
echo -e "${YELLOW}Copying script files...${NC}"
for script in "$LOCAL_SCRIPTS_DIR"/*.js; do
  if [ -f "$script" ]; then
    script_name=$(basename "$script")
    echo "  - $script_name"
    cp "$script" "$GLOBAL_SCRIPTS_DIR/"
    chmod +x "$GLOBAL_SCRIPTS_DIR/$script_name"
  fi
done

# Copy SKILL.md
echo ""
echo -e "${YELLOW}Copying SKILL.md...${NC}"
if [ -f "$LOCAL_SKILL_MD" ]; then
  cp "$LOCAL_SKILL_MD" "$GLOBAL_SKILL_DIR/"
  echo "  - SKILL.md"
else
  echo -e "${RED}Warning: SKILL.md not found at $LOCAL_SKILL_MD${NC}"
fi

# Remove test-feedback.js if it exists in global
echo ""
echo -e "${YELLOW}Cleaning up old files...${NC}"
if [ -f "$GLOBAL_SCRIPTS_DIR/test-feedback.js" ]; then
  echo "  - Removing test-feedback.js"
  rm "$GLOBAL_SCRIPTS_DIR/test-feedback.js"
fi

# List deployed files
echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Deployed files:"
ls -lh "$GLOBAL_SCRIPTS_DIR" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo "SKILL.md:"
ls -lh "$GLOBAL_SKILL_DIR/SKILL.md" | awk '{print "  " $9 " (" $5 ")"}'
echo ""
echo -e "${GREEN}Global plugin updated successfully!${NC}"
