#!/usr/bin/env node
/**
 * Data Structure Schema
 *
 * Defines the unified data structure for:
 * - Requirements (需求)
 * - Modules (模块)
 * - Iterations (迭代)
 * - Tasks (任务)
 * - TDD Plans (测试计划)
 */

const fs = require('fs');
const path = require('path');

/**
 * Requirement Schema
 * 用户需求
 */
const RequirementSchema = {
  req_id: "REQ-{number}",           // 需求ID
  req_name: "string",                // 需求名称
  description: "string",             // 详细描述
  priority: "critical|high|medium|low",  // 优先级
  status: "pending|confirmed|in_progress|completed|cancelled",
  related_modules: ["MOD-001"],      // 关联的模块
  created_at: "ISO 8601",            // 创建时间
  updated_at: "ISO 8601"             // 更新时间
};

/**
 * Module Schema
 * 功能模块
 */
const ModuleSchema = {
  module_id: "MOD-{name}",           // 模块ID
  module_name: "string",             // 模块名称
  status: "pending|confirmed|in_progress|optimized|has_issue",
  completion_rate: 0.0,              // 完成度 (0-1)
  owner: "string",                   // 负责人
  last_update: "ISO 8601",           // 最后更新
  notes: "string",                   // 备注

  // 关联关系
  related_requirements: ["REQ-001"],
  related_tasks: ["TASK-001"],
  related_iterations: ["ITER-001"],

  // 问题追踪（仅当 status === 'has_issue' 时）
  issue_description: "string"        // 问题描述
};

/**
 * Task Schema with TDD
 * 任务（包含测试计划）
 */
const TaskSchema = {
  task_id: "TASK-{module}-{number}", // 任务ID
  task_name: "string",               // 任务名称
  description: "string",             // 详细描述
  status: "todo|in_progress|done|blocked|cancelled",
  priority: "critical|high|medium|low",
  module_id: "MOD-001",              // 所属模块
  assignee: "string",                // 负责人
  risk_level: "high|low",            // 风险等级
  tags: ["tag1", "tag2"],            // 标签

  // TDD 计划
  tdd_plan: {
    test_file: "path/to/test.spec.ts",
    test_cases: [
      "应该实现功能X",
      "应该处理边界情况Y",
      "应该抛出错误Z"
    ],
    coverage_target: 80,             // 覆盖率目标 (百分比)
    test_status: "pending|passed|failed",
    coverage_actual: 0               // 实际覆盖率
  }
};

/**
 * Iteration Schema
 * 迭代周期
 */
const IterationSchema = {
  iteration_id: "ITER-{number}",     // 迭代ID
  iteration_name: "string",          // 迭代名称
  status: "not_started|in_progress|completed|delayed|has_issue",
  start_date: "YYYY-MM-DD",          // 开始日期
  end_date: "YYYY-MM-DD",            // 结束日期

  // 关联关系
  related_requirements: ["REQ-001"],
  related_modules: ["MOD-001"],

  // 任务列表
  tasks: [TaskSchema],

  // 假设验证
  assumptions: [
    {
      assumption_id: "ASSUM-{number}",
      hypothesis: "string",          // 假设描述
      status: "pending|validated|invalidated",
      validation_date: "ISO 8601"
    }
  ]
};

/**
 * Project Snapshot Schema (Complete)
 * 完整的项目快照结构
 */
const ProjectSnapshotSchema = {
  // 元数据
  project_name: "string",
  snapshot_id: "snap-{timestamp}",
  timestamp: "ISO 8601",

  // Git 信息
  git: {
    branch: "string",
    commit: "string",
    status: "clean|dirty",
    dirty: true
  },

  // 需求列表
  requirements: [RequirementSchema],

  // 模块列表
  modules: [ModuleSchema],

  // 迭代列表
  iterations: [IterationSchema],

  // 当前迭代
  current_iteration: "ITER-001",

  // 依赖信息
  dependencies: {
    production: {},
    dev: {},
    packageManager: "npm|pnpm|yarn|bun"
  },

  // 健康指标
  health: {
    tests: {
      passed: 0,
      failed: 0,
      total: 0
    },
    lint: {
      passed: false,
      errors: 0
    }
  },

  // 语言统计
  languages: {
    "TypeScript": { files: 50, lines: 5000 }
  }
};

/**
 * Generate IDs
 * ID 生成器
 */
function generateID(type, context = {}) {
  const counters = loadCounters();
  counters[type] = (counters[type] || 0) + 1;
  saveCounters(counters);

  const prefix = {
    requirement: 'REQ',
    module: 'MOD',
    task: 'TASK',
    iteration: 'ITER',
    assumption: 'ASSUM'
  }[type];

  if (type === 'task' && context.module) {
    return `${prefix}-${context.module}-${String(counters[type]).padStart(2, '0')}`;
  }

  return `${prefix}-${String(counters[type]).padStart(3, '0')}`;
}

/**
 * Load counters from file
 */
function loadCounters() {
  try {
    const filePath = path.join(process.cwd(), '.claude', 'counters.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    // Ignore
  }
  return {};
}

/**
 * Save counters to file
 */
function saveCounters(counters) {
  try {
    const dir = path.join(process.cwd(), '.claude');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, 'counters.json');
    fs.writeFileSync(filePath, JSON.stringify(counters, null, 2));
  } catch (e) {
    // Ignore
  }
}

/**
 * Validate data against schema
 */
function validateSchema(data, schemaName) {
  const schemas = {
    Requirement: RequirementSchema,
    Module: ModuleSchema,
    Task: TaskSchema,
    Iteration: IterationSchema
  };

  const schema = schemas[schemaName];
  if (!schema) {
    throw new Error(`Unknown schema: ${schemaName}`);
  }

  // Basic validation (can be extended with a validation library)
  const errors = [];

  // Add validation logic here

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  RequirementSchema,
  ModuleSchema,
  TaskSchema,
  IterationSchema,
  ProjectSnapshotSchema,
  generateID,
  validateSchema
};
