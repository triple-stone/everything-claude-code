#!/usr/bin/env node
/**
 * Requirement Parser
 *
 * Parses requirements from various sources:
 * - .claude/requirements.json (requirement definitions)
 * - Plan files (extracts requirements from "## 需求" or "## Requirements" sections)
 * - User stories and feature requests
 */

const fs = require('fs');
const path = require('path');
const { generateID } = require('./schema');

const DEFAULT_REQUIREMENTS_FILE = '.claude/requirements.json';
const DEFAULT_PLANS_DIR = '.claude/plans';

/**
 * Load requirements from configuration file
 */
function loadRequirementsFromFile() {
  const requirements = [];

  try {
    const filePath = path.join(process.cwd(), DEFAULT_REQUIREMENTS_FILE);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      if (Array.isArray(data)) {
        return data.map(r => normalizeRequirement(r));
      } else if (data.requirements && Array.isArray(data.requirements)) {
        return data.requirements.map(r => normalizeRequirement(r));
      }
    }
  } catch (e) {
    // File doesn't exist or is invalid
  }

  return requirements;
}

/**
 * Extract requirements from plan files
 */
function extractRequirementsFromPlans() {
  const requirements = [];
  const plansDir = path.join(process.cwd(), DEFAULT_PLANS_DIR);

  try {
    if (!fs.existsSync(plansDir)) {
      return [];
    }

    const planFiles = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse();

    for (const planFile of planFiles) {
      const content = fs.readFileSync(planFile, 'utf-8');
      const stats = fs.statSync(planFile);

      // Extract requirements section
      const reqs = parseRequirementsSection(content);

      reqs.forEach(req => {
        // Add metadata if not present
        if (!req.created_at) {
          req.created_at = stats.mtime.toISOString();
        }
        if (!req.updated_at) {
          req.updated_at = stats.mtime.toISOString();
        }

        requirements.push(req);
      });
    }
  } catch (e) {
    // Ignore errors
  }

  return requirements;
}

/**
 * Parse requirements section from plan content
 */
function parseRequirementsSection(content) {
  const requirements = [];

  // Look for requirements section
  const reqSectionMatch = content.match(/##\s+(需求|Requirements)\s*\n([\s\S]+?)(?=\n##\s|\n#|$)/i);

  if (!reqSectionMatch) {
    // Try to extract from overview
    return extractRequirementsFromOverview(content);
  }

  const reqContent = reqSectionMatch[2];
  const lines = reqContent.split('\n').filter(l => l.trim().length > 0);

  for (const line of lines) {
    // Parse list items
    const match = line.match(/^[-*]\s+(.+)/);
    if (match) {
      const reqText = match[1].trim();

      requirements.push({
        req_id: generateID('requirement'),
        req_name: extractRequirementName(reqText),
        description: reqText,
        priority: inferPriority(reqText),
        status: 'pending',
        related_modules: extractModulesFromText(reqText),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  return requirements;
}

/**
 * Extract requirements from overview if no explicit requirements section
 */
function extractRequirementsFromOverview(content) {
  const requirements = [];

  // Extract from overview
  const overviewMatch = content.match(/##\s+(概述|Overview)\s*\n([\s\S]+?)(?=\n##\s|\n#|$)/i);

  if (!overviewMatch) {
    return [];
  }

  const overviewText = overviewMatch[2];

  // Look for key phrases that indicate requirements
  const requirementPatterns = [
    /需要实现([^。\n]+)/g,
    /实现([^。\n]+)功能/g,
    /添加([^。\n]+)支持/g,
    /用户可以([^。\n]+)/g
  ];

  for (const pattern of requirementPatterns) {
    let match;
    while ((match = pattern.exec(overviewText)) !== null) {
      const reqText = match[1].trim();

      requirements.push({
        req_id: generateID('requirement'),
        req_name: extractRequirementName(reqText),
        description: `实现: ${reqText}`,
        priority: 'medium',
        status: 'pending',
        related_modules: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
  }

  return requirements;
}

/**
 * Extract requirement name from text
 */
function extractRequirementName(text) {
  // Remove common prefixes
  const cleanText = text
    .replace(/^(需要|实现|添加|支持)/, '')
    .replace(/功能$/, '')
    .trim();

  // Truncate if too long
  if (cleanText.length > 50) {
    return cleanText.substring(0, 47) + '...';
  }

  return cleanText || '未命名需求';
}

/**
 * Infer priority from text
 */
function inferPriority(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('紧急') || lowerText.includes('critical') ||
      lowerText.includes('必须') || lowerText.includes('必须')) {
    return 'critical';
  }

  if (lowerText.includes('重要') || lowerText.includes('important') ||
      lowerText.includes('高优先级')) {
    return 'high';
  }

  if (lowerText.includes('可选') || lowerText.includes('optional') ||
      lowerText.includes('低优先级')) {
    return 'low';
  }

  return 'medium';
}

/**
 * Extract modules from text
 */
function extractModulesFromText(text) {
  const modules = [];
  const moduleKeywords = {
    '认证': 'MOD-AUTH',
    '权限': 'MOD-PERMISSION',
    '用户': 'MOD-USER',
    '登录': 'MOD-AUTH',
    '离线': 'MOD-OFFLINE',
    '同步': 'MOD-OFFLINE',
    '队列': 'MOD-OFFLINE',
    '交通': 'MOD-TRAFFIC',
    '车辆': 'MOD-TRAFFIC',
    '司机': 'MOD-TRAFFIC',
    '卫健': 'MOD-HEALTH',
    '救护': 'MOD-HEALTH',
    '转运': 'MOD-HEALTH',
    '个人': 'MOD-PERSONAL',
    '设置': 'MOD-PERSONAL'
  };

  for (const [keyword, moduleId] of Object.entries(moduleKeywords)) {
    if (text.includes(keyword)) {
      if (!modules.includes(moduleId)) {
        modules.push(moduleId);
      }
    }
  }

  return modules;
}

/**
 * Normalize requirement data
 */
function normalizeRequirement(req) {
  return {
    req_id: req.req_id || req.id || generateID('requirement'),
    req_name: req.req_name || req.name || req.title || '未命名需求',
    description: req.description || req.desc || '',
    priority: req.priority || 'medium',
    status: normalizeRequirementStatus(req.status),
    related_modules: req.related_modules || [],
    created_at: req.created_at || new Date().toISOString(),
    updated_at: req.updated_at || new Date().toISOString()
  };
}

/**
 * Normalize requirement status
 */
function normalizeRequirementStatus(status) {
  const map = {
    'pending': 'pending',
    'todo': 'pending',
    'confirmed': 'confirmed',
    'in_progress': 'in_progress',
    'doing': 'in_progress',
    'done': 'completed',
    'completed': 'completed',
    'cancelled': 'cancelled'
  };

  return map[(status || 'pending').toLowerCase()] || 'pending';
}

/**
 * Link requirements to modules
 */
function linkRequirementsToModules(requirements, modules) {
  const moduleMap = new Map(modules.map(m => [m.module_id, m]));

  requirements.forEach(req => {
    // Auto-link based on description
    if (req.related_modules.length === 0) {
      req.related_modules = extractModulesFromText(req.description);
    }

    // Validate module IDs
    req.related_modules = req.related_modules.filter(mid => moduleMap.has(mid));
  });

  return requirements;
}

/**
 * Calculate requirement statistics
 */
function calculateRequirementStats(requirements) {
  const total = requirements.length;
  const pending = requirements.filter(r => r.status === 'pending').length;
  const confirmed = requirements.filter(r => r.status === 'confirmed').length;
  const inProgress = requirements.filter(r => r.status === 'in_progress').length;
  const completed = requirements.filter(r => r.status === 'completed').length;

  const priorityBreakdown = {
    critical: requirements.filter(r => r.priority === 'critical').length,
    high: requirements.filter(r => r.priority === 'high').length,
    medium: requirements.filter(r => r.priority === 'medium').length,
    low: requirements.filter(r => r.priority === 'low').length
  };

  return {
    total,
    pending,
    confirmed,
    inProgress,
    completed,
    priorityBreakdown,
    completionRate: total > 0 ? (completed / total * 100).toFixed(1) : 0
  };
}

/**
 * Main function: collect all requirements
 */
function collectRequirements() {
  // Load from file
  const fileRequirements = loadRequirementsFromFile();

  // Extract from plans
  const planRequirements = extractRequirementsFromPlans();

  // Merge (file requirements take priority)
  const allRequirements = [...fileRequirements];

  // Add plan requirements (avoid duplicates by name)
  planRequirements.forEach(planReq => {
    const exists = allRequirements.some(r => r.req_name === planReq.req_name);
    if (!exists) {
      allRequirements.push(planReq);
    }
  });

  return allRequirements;
}

module.exports = {
  collectRequirements,
  loadRequirementsFromFile,
  extractRequirementsFromPlans,
  parseRequirementsSection,
  linkRequirementsToModules,
  calculateRequirementStats,
  normalizeRequirement
};
