#!/usr/bin/env node
/**
 * Task Collector (Enhanced with Iterations and TDD)
 *
 * Collects tasks from various sources:
 * - .claude/tasks.json (task definitions with TDD plans)
 * - Plan files (extracts tasks from implementation steps)
 * - Todo files (backward compatibility with old format)
 *
 * Groups tasks into iterations and includes TDD test plans.
 */

const fs = require('fs');
const path = require('path');
const { generateID } = require('./schema');

const DEFAULT_TASKS_FILE = '.claude/tasks.json';
const DEFAULT_TODOS_FILE = '.claude/todos.json';
const DEFAULT_PLANS_DIR = '.claude/plans';

/**
 * Load tasks from configuration file
 */
function loadTasksFromFile() {
  const tasks = [];
  const iterations = new Map();

  try {
    const filePath = path.join(process.cwd(), DEFAULT_TASKS_FILE);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      // Support both flat array and nested structure
      if (Array.isArray(data)) {
        return { tasks: data.map(t => normalizeTask(t)), iterations: [] };
      } else if (data.tasks && Array.isArray(data.tasks)) {
        const normalizedTasks = data.tasks.map(t => normalizeTask(t));

        // Extract iterations if present
        if (data.iterations && Array.isArray(data.iterations)) {
          data.iterations.forEach(iter => {
            iterations.set(iter.iteration_id, normalizeIteration(iter));
          });
        }

        return { tasks: normalizedTasks, iterations: Array.from(iterations.values()) };
      }
    }
  } catch (e) {
    // File doesn't exist or is invalid
  }

  return { tasks, iterations: [] };
}

/**
 * Extract tasks from plan files
 */
function extractTasksFromPlans() {
  const tasks = [];
  const iterations = new Map();
  const plansDir = path.join(process.cwd(), DEFAULT_PLANS_DIR);

  try {
    if (!fs.existsSync(plansDir)) {
      return { tasks, iterations: [] };
    }

    const planFiles = fs.readdirSync(plansDir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(plansDir, f))  // Add full path
      .sort()
      .reverse(); // Most recent first

    let iterationCounter = 0;

    for (const planFile of planFiles) {
      const content = fs.readFileSync(planFile, 'utf-8');
      const stats = fs.statSync(planFile);

      // Create iteration from plan
      const planName = extractPlanName(content);
      const iterationId = generateID('iteration');
      const iterationName = planName || path.basename(planFile, '.md');

      // Extract module from plan header
      const planModule = extractPlanModule(content);

      const iteration = {
        iteration_id: iterationId,
        iteration_name: iterationName,
        status: extractPlanStatus(content),
        start_date: formatDate(stats.mtime),
        end_date: null,
        related_requirements: [],
        related_modules: planModule ? [`MOD-${planModule.toUpperCase()}`] : extractModulesFromPlan(content),
        tasks: [],
        assumptions: extractAssumptionsFromPlan(content)
      };

      // Extract implementation steps as tasks
      const phases = extractPhases(content);
      let taskCounter = 1;

      phases.forEach(phase => {
        const phaseModule = extractModuleFromPhase(phase, content);
        const steps = phase.steps || [];

        steps.forEach(step => {
          // Priority: plan module > phase module > step module
          // (Plan declaration is more reliable than keyword guessing)
          const moduleName = planModule || phaseModule || extractModuleFromStep(step) || 'GENERIC';
          const task = {
            task_id: generateID('task', { module: moduleName }),
            task_name: extractStepName(step),
            description: extractStepDescription(step),
            status: 'todo',
            priority: extractStepPriority(step),
            module_id: 'MOD-' + moduleName.toUpperCase().replace(/\s+/g, '-'),
            assignee: null,
            risk_level: extractStepRisk(step),
            tags: extractTagsFromStep(step),
            tdd_plan: {
              test_file: null,
              test_cases: extractTestCases(step),
              coverage_target: 80,
              test_status: 'pending',
              coverage_actual: 0
            }
          };

          tasks.push(task);
          iteration.tasks.push(task);
        });
      });

      iterations.set(iterationId, iteration);
      iterationCounter++;
    }
  } catch (e) {
    console.error('Error extracting tasks from plans:', e);
  }

  return { tasks, iterations: Array.from(iterations.values()) };
}

/**
 * Load todos from old format (backward compatibility)
 */
function loadTodosFromOldFormat() {
  const tasks = [];

  try {
    if (fs.existsSync(DEFAULT_TODOS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DEFAULT_TODOS_FILE, 'utf-8'));

      const todos = Array.isArray(data) ? data : (data.todos || []);

      todos.forEach((todo, index) => {
        const task = {
          task_id: `TASK-TODO-${String(index + 1).padStart(3, '0')}`,
          task_name: todo.content || todo.text || todo.title || '未命名任务',
          description: todo.description || '',
          status: mapTodoStatus(todo.status || todo.state),
          priority: todo.priority || 'medium',
          module_id: 'MOD-GENERAL',
          assignee: null,
          risk_level: 'low',
          tags: [],
          tdd_plan: {
            test_file: null,
            test_cases: [],
            coverage_target: 0,
            test_status: 'pending',
            coverage_actual: 0
          }
        };

        tasks.push(task);
      });
    }
  } catch (e) {
    // Ignore errors
  }

  return tasks;
}

/**
 * Normalize task data
 */
function normalizeTask(task) {
  return {
    task_id: task.task_id || task.id || generateID('task', { module: 'GENERIC' }),
    task_name: task.task_name || task.name || task.title || '未命名任务',
    description: task.description || '',
    status: normalizeTaskStatus(task.status),
    priority: task.priority || 'medium',
    module_id: task.module_id || 'MOD-GENERAL',
    assignee: task.assignee || null,
    risk_level: task.risk_level || 'low',
    tags: task.tags || [],
    tdd_plan: task.tdd_plan || {
      test_file: null,
      test_cases: [],
      coverage_target: 80,
      test_status: 'pending',
      coverage_actual: 0
    }
  };
}

/**
 * Normalize iteration data
 */
function normalizeIteration(iteration) {
  return {
    iteration_id: iteration.iteration_id || iteration.id || generateID('iteration'),
    iteration_name: iteration.iteration_name || iteration.name || '未命名迭代',
    status: normalizeIterationStatus(iteration.status),
    start_date: iteration.start_date || null,
    end_date: iteration.end_date || null,
    related_requirements: iteration.related_requirements || [],
    related_modules: iteration.related_modules || [],
    tasks: (iteration.tasks || []).map(t => normalizeTask(t)),
    assumptions: iteration.assumptions || []
  };
}

/**
 * Extract plan name from content
 */
function extractPlanName(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Extract module from plan header
 */
function extractPlanModule(content) {
  // Look for module declaration in header
  const modulePatterns = [
    /\*\*模块\*\*:\s*MOD-(\w+)/i,
    /\*\*模块\*\*:\s*\((\w+)\)/i,
    /module:\s*MOD-(\w+)/i,
    /module:\s*\((\w+)\)/i
  ];

  for (const pattern of modulePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim().toLowerCase(); // Return lowercase keyword
    }
  }

  return null;
}

/**
 * Extract plan status
 */
function extractPlanStatus(content) {
  const statusMatch = content.match(/\*\*Status:\s*(\w+)\*\*/i);
  if (statusMatch) {
    const status = statusMatch[1].toLowerCase();
    if (status === 'confirmed') return 'in_progress';
    if (status === 'completed') return 'completed';
    return status;
  }

  // Default based on content
  if (content.includes('## 成功标准') || content.includes('## Success Criteria')) {
    return 'in_progress';
  }
  return 'pending';
}

/**
 * Extract phases from plan
 */
function extractPhases(content) {
  const phases = [];

  // Support both English and Chinese formats
  const phasePatterns = [
    /###\s+阶段\s+\d+[：:]\s*(.+?)(?=\n###\s+阶段|\n##|\n###\s+Phase|$)/gs,  // Chinese: 阶段 1：
    /###\s+Phase\s+\d+:\s*(.+?)(?=\n###\s+阶段|\n##|\n###\s+Phase|$)/gs,  // English: Phase 1:
    /###\s+阶段\s+\d+[：:]\s*\((.+?)\)(?=\n###\s+阶段|\n##|$)/gs,  // Chinese with parens: 阶段 1（优先级）
    /###\s+Phase\s+\d+:\s*\((.+?)\)(?=\n###\s+阶段|\n##|\n###\s+Phase|$)/gs  // English with parens: Phase 1: (Priority)
  ];

  for (const pattern of phasePatterns) {
    let match;
    pattern.lastIndex = 0; // Reset regex state

    while ((match = pattern.exec(content)) !== null) {
      const phaseContent = match[0];
      const steps = extractSteps(phaseContent);

      // Extract phase name without priority
      let phaseName = match[1].trim();
      // Remove priority suffix like "（优先级：高）" or "(Priority: High)"
      phaseName = phaseName.replace(/[（(]优先级[：:]\s*[^\）)]+[）)]/gi, '')
                           .replace(/[（(]priority[：:]\s*[^\）)]+[）)]/gi, '')
                           .trim();

      phases.push({
        name: phaseName,
        content: phaseContent,
        steps
      });
    }
  }

  return phases;
}

/**
 * Extract module from phase
 */
function extractModuleFromPhase(phase, fullContent) {
  const phaseText = phase.content || phase.name || '';

  // Look for module declaration in phase header (MOD-XXX format)
  const modulePatterns = [
    /(?:模块|module):\s*MOD-(\w+)/gi,
    /(?:模块|module):\s*\((\w+)\)/gi
  ];

  for (const pattern of modulePatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(phaseText);
    if (match) {
      return match[1].trim().toLowerCase();
    }
  }

  // Extract from phase name keywords
  return extractModuleFromText(phaseText);
}

/**
 * Extract module from text (generic keyword matching)
 */
function extractModuleFromText(text) {
  const moduleKeywords = [
    'auth', 'permission', 'user', 'login',
    'offline', 'sync', 'queue',
    'traffic', 'vehicle', 'driver',
    'health', 'emergency', 'hospital',
    'ui', 'component', 'form',
    'api', 'database', 'test'
  ];

  const lowerText = text.toLowerCase();
  for (const keyword of moduleKeywords) {
    if (lowerText.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

/**
 * Extract steps from phase content
 */
function extractSteps(phaseContent) {
  const steps = [];
  const lines = phaseContent.split('\n');
  let currentStep = null;

  for (const line of lines) {
    // Step starts with number (both **bold** and plain text formats)
    const stepMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*/) ||
                      line.match(/^\d+\.\s+(.+)$/);
    if (stepMatch) {
      if (currentStep) {
        steps.push(currentStep);
      }
      currentStep = {
        name: stepMatch[1].replace(/\*\*/g, '').trim(),
        content: [],
        action: '',
        dependencies: '',
        risk: ''
      };
      continue;
    }

    if (currentStep) {
      // Check for structured fields
      if (line.includes('动作：') || line.includes('Action:')) {
        currentStep.action = line.replace(/.*?动作：|Action:/, '').trim();
      } else if (line.includes('依赖：') || line.includes('Dependencies:')) {
        currentStep.dependencies = line.replace(/.*?依赖：|Dependencies:/, '').trim();
      } else if (line.includes('风险：') || line.includes('Risk:')) {
        currentStep.risk = line.replace(/.*?风险：|Risk:/, '').trim();
      } else if (line.match(/^\s*-\s+/)) {
        // Bullet points: append to action
        const bulletText = line.replace(/^\s*-\s*/, '').trim();
        currentStep.action += (currentStep.action ? '\n' : '') + bulletText;
      } else if (line.trim().length > 0 && !line.startsWith('###')) {
        // Other content lines
        currentStep.content.push(line.trim());
      }
    }
  }

  if (currentStep) {
    steps.push(currentStep);
  }

  return steps;
}

/**
 * Extract step name
 */
function extractStepName(step) {
  return step.name || '未命名任务';
}

/**
 * Extract step description
 */
function extractStepDescription(step) {
  const parts = [];

  // Add action as main description
  if (step.action) {
    parts.push(step.action);
  }

  // Add structured fields if present
  if (step.dependencies) {
    parts.push(`依赖: ${step.dependencies}`);
  }

  if (step.risk) {
    parts.push(`风险: ${step.risk}`);
  }

  // Add any additional content
  if (step.content && step.content.length > 0) {
    const contentText = step.content
      .filter(line => !line.match(/^\d+\./) && !line.startsWith('###'))
      .join('\n');
    if (contentText) {
      parts.push(contentText);
    }
  }

  return parts.filter(p => p).join('\n');
}

/**
 * Extract step priority
 */
function extractStepPriority(step) {
  const risk = (step.risk || '').toLowerCase();
  if (risk.includes('high') || risk.includes('高')) return 'high';
  if (risk.includes('critical') || risk.includes('紧急')) return 'critical';
  return 'medium';
}

/**
 * Extract step risk level
 */
function extractStepRisk(step) {
  const risk = (step.risk || '').toLowerCase();
  if (risk.includes('high') || risk.includes('中') || risk.includes('高')) return 'high';
  return 'low';
}

/**
 * Extract module from step (fallback when plan doesn't specify)
 */
function extractModuleFromStep(step) {
  const allText = [step.name, step.action, ...step.content].join(' ');
  return extractModuleFromText(allText);
}

/**
 * Extract tags from step
 */
function extractTagsFromStep(step) {
  const allText = [step.name, step.action].join(' ');
  const tags = [];

  if (allText.toLowerCase().includes('test')) tags.push('testing');
  if (allText.toLowerCase().includes('api')) tags.push('api');
  if (allText.toLowerCase().includes('ui')) tags.push('ui');
  if (allText.toLowerCase().includes('bug')) tags.push('bugfix');

  return tags;
}

/**
 * Extract test cases from step
 */
function extractTestCases(step) {
  const cases = [];
  const content = step.content.join('\n');

  // Look for test case indicators
  const testIndicators = [
    '应该',
    'should',
    '测试',
    'test',
    '验证'
  ];

  for (const line of content.split('\n')) {
    for (const indicator of testIndicators) {
      if (line.toLowerCase().includes(indicator) && line.trim().length > 0) {
        cases.push(line.trim());
        break;
      }
    }
  }

  return cases;
}

/**
 * Extract modules from plan
 */
function extractModulesFromPlan(content) {
  const modules = [];
  const moduleRegex = /(?:模块|module):\s*([^\n,]+)/gi;
  let match;

  while ((match = moduleRegex.exec(content)) !== null) {
    const moduleName = match[1].trim();
    const moduleId = 'MOD-' + moduleName.toUpperCase().replace(/\s+/g, '-');
    if (!modules.includes(moduleId)) {
      modules.push(moduleId);
    }
  }

  return modules;
}

/**
 * Extract assumptions from plan
 */
function extractAssumptionsFromPlan(content) {
  const assumptions = [];
  const lines = content.split('\n');
  let inAssumptionSection = false;

  for (const line of lines) {
    if (line.includes('## 假设') || line.includes('## Assumptions')) {
      inAssumptionSection = true;
      continue;
    }

    if (inAssumptionSection && line.trim().length > 0 && !line.startsWith('#')) {
      assumptions.push({
        assumption_id: generateID('assumption'),
        hypothesis: line.trim(),
        status: 'pending',
        validation_date: null
      });
    }
  }

  return assumptions;
}

/**
 * Map todo status to task status
 */
function mapTodoStatus(status) {
  const map = {
    'pending': 'todo',
    'todo': 'todo',
    'in_progress': 'in_progress',
    'doing': 'in_progress',
    'done': 'done',
    'completed': 'done',
    'blocked': 'blocked',
    'cancelled': 'cancelled'
  };

  return map[status] || 'todo';
}

/**
 * Normalize task status
 */
function normalizeTaskStatus(status) {
  const map = {
    'pending': 'todo',
    'todo': 'todo',
    'in_progress': 'in_progress',
    'doing': 'in_progress',
    'done': 'done',
    'completed': 'done',
    'blocked': 'blocked',
    'cancelled': 'cancelled'
  };

  return map[(status || 'todo').toLowerCase()] || 'todo';
}

/**
 * Normalize iteration status
 */
function normalizeIterationStatus(status) {
  const map = {
    'not_started': 'not_started',
    'pending': 'not_started',
    'in_progress': 'in_progress',
    'doing': 'in_progress',
    'done': 'completed',
    'completed': 'completed',
    'delayed': 'delayed',
    'has_issue': 'has_issue'
  };

  return map[(status || 'not_started').toLowerCase()] || 'not_started';
}

/**
 * Format date
 */
function formatDate(date) {
  if (!date) return null;
  return date.toISOString().split('T')[0];
}

/**
 * Main function: collect all tasks and iterations
 */
function collectTasks() {
  // Load from file (highest priority)
  const fileData = loadTasksFromFile();

  // Extract from plans
  const planData = extractTasksFromPlans();

  // Load old todos for backward compatibility
  const oldTodos = loadTodosFromOldFormat();

  // Merge: file tasks > plan tasks > old todos
  const allTasks = [
    ...fileData.tasks,
    ...planData.tasks,
    ...oldTodos
  ];

  // Merge iterations
  const allIterations = [
    ...fileData.iterations,
    ...planData.iterations
  ];

  return {
    tasks: allTasks,
    iterations: allIterations
  };
}

module.exports = {
  collectTasks,
  loadTasksFromFile,
  extractTasksFromPlans,
  loadTodosFromOldFormat,
  normalizeTask,
  normalizeIteration
};
