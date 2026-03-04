#!/usr/bin/env node
/**
 * Project Snapshot Dashboard
 *
 * Generates a visual HTML dashboard from project snapshots.
 * Features:
 * - Modern dark design (gradient background, glass cards)
 * - Iterations with collapsible task lists
 * - TDD information (test cases, coverage, status)
 * - Requirements and modules overview
 *
 * Usage:
 *   node dashboard.js --mode static --output snapshot.html
 *   node dashboard.js --mode web
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const DEFAULT_SNAPSHOT_DIR = '.claude/snapshots';
const DEFAULT_PORT = 3847;

function getConfig() {
  return {
    snapshotDir: DEFAULT_SNAPSHOT_DIR
  };
}

function getSnapshots() {
  const config = getConfig();
  const snapshotDir = path.resolve(config.snapshotDir);
  const snapshots = [];

  try {
    const files = fs.readdirSync(snapshotDir)
      .filter(f => f.endsWith('.json') && f.startsWith('snap-'))
      .map(f => ({
        name: f,
        path: path.join(snapshotDir, f),
        mtime: fs.statSync(path.join(snapshotDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files.slice(0, 30)) {
      try {
        const data = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
        snapshots.push(data);
      } catch (e) {
        // Skip invalid files
      }
    }
  } catch (e) {
    console.error('[Dashboard] No snapshots found');
  }

  return snapshots;
}

function generateDashboardHtml(snapshots) {
  const latest = snapshots[0] || {};
  const projectName = latest.project_name || 'Unknown Project';

  // Inject real snapshot data
  const dataScript = `
        window.snapshotData = ${JSON.stringify(latest)};

        // Initial render
        renderUI(window.snapshotData);
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>项目快照可视化 - ${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        body {
            background: linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%);
            min-height: 100vh;
        }
        .glass-card {
            background: rgba(39, 39, 42, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(63, 63, 70, 0.3);
        }
        .animate-spin {
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="text-zinc-100 antialiased p-4 lg:p-8">
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <header class="mb-8 flex items-center justify-between">
            <div>
                <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">项目快照可视化</h1>
                <p class="text-sm text-zinc-500 mt-1" id="project-info">${projectName}</p>
            </div>
            <div class="flex items-center gap-4">
                <div class="px-4 py-2 bg-zinc-900/80 rounded-lg border border-zinc-800">
                    <p class="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">最后更新</p>
                    <p class="text-sm font-mono text-emerald-400" id="last-updated">${latest.timestamp ? new Date(latest.timestamp).toLocaleString('zh-CN') : '--:--:--'}</p>
                </div>
            </div>
        </header>

        <!-- Top Metrics -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10" id="top-metrics"></div>

        <!-- Main Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Left Column -->
            <div class="lg:col-span-8 space-y-6">
                <!-- Iterations -->
                <div class="glass-card rounded-2xl p-6">
                    <div class="flex items-center justify-between mb-6">
                        <h2 class="text-lg font-bold flex items-center gap-2">
                            <i data-lucide="git-merge" class="text-blue-400"></i> 迭代管理
                        </h2>
                        <span class="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded" id="iteration-count">0 迭代</span>
                    </div>
                    <div class="space-y-3" id="iteration-list"></div>
                </div>

                <!-- Modules -->
                <div class="glass-card rounded-2xl p-6">
                    <h2 class="text-lg font-bold flex items-center gap-2 mb-6">
                        <i data-lucide="layers" class="text-emerald-400"></i> 模块状态
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4" id="module-grid"></div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="lg:col-span-4 space-y-6">
                <!-- TDD Overview -->
                <div class="glass-card rounded-2xl p-6 bg-purple-500/5 border-purple-500/20">
                    <h2 class="text-lg font-bold flex items-center gap-2 mb-4 text-purple-400">
                        <i data-lucide="flask-conical"></i> TDD 总览
                    </h2>
                    <div class="space-y-3" id="tdd-overview"></div>
                </div>

                <!-- Requirements -->
                <div class="glass-card rounded-2xl p-6">
                    <h2 class="text-lg font-bold flex items-center gap-2 mb-6">
                        <i data-lucide="list-todo" class="text-purple-400"></i> 需求列表
                    </h2>
                    <div class="space-y-3" id="requirement-list"></div>
                </div>

                <!-- Git Info -->
                <div class="glass-card rounded-2xl p-6 bg-blue-500/5 border-blue-500/20">
                    <h2 class="text-lg font-bold flex items-center gap-2 mb-4 text-blue-400">
                        <i data-lucide="git-branch"></i> Git 状态
                    </h2>
                    <div class="space-y-2 text-sm" id="git-info"></div>
                </div>

                <!-- Languages -->
                <div class="glass-card rounded-2xl p-6 bg-emerald-500/5 border-emerald-500/20">
                    <h2 class="text-lg font-bold flex items-center gap-2 mb-4 text-emerald-400">
                        <i data-lucide="code-2"></i> 语言统计
                    </h2>
                    <div class="space-y-2 text-sm" id="language-stats"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const statusConfig = {
            'completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '已完成' },
            'done': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '已完成' },
            'in_progress': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '进行中' },
            'todo': { bg: 'bg-zinc-800', text: 'text-zinc-400', label: '待处理' },
            'not_started': { bg: 'bg-zinc-800', text: 'text-zinc-400', label: '未开始' },
            'delayed': { bg: 'bg-red-500/10', text: 'text-red-400', label: '延期' },
            'critical': { bg: 'bg-red-500', text: 'text-white', label: '紧急' },
            'confirmed': { bg: 'bg-blue-500/10', text: 'text-blue-400', label: '已确认' },
            'pending': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: '待定' },
            'optimized': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: '完美' },
            'has_issue': { bg: 'bg-red-500/10', text: 'text-red-400', label: '有问题' }
        };

        const priorityLabels = {
            'critical': '紧急',
            'high': '高',
            'medium': '中',
            'low': '低'
        };

        function getStatusBadge(status) {
            const key = status ? status.toLowerCase() : 'pending';
            const cfg = statusConfig[key] || { bg: 'bg-zinc-800', text: 'text-zinc-400', label: status || '未知' };
            return \`<span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider \${cfg.bg} \${cfg.text}">\${cfg.label}</span>\`;
        }

        let collapsedIterations = new Set();

        function toggleIteration(iterationId) {
            if (collapsedIterations.has(iterationId)) {
                collapsedIterations.delete(iterationId);
            } else {
                collapsedIterations.add(iterationId);
            }
            if(window.lastData) renderUI(window.lastData);
        }

        function toggleTaskTDD(taskId) {
            const tddDiv = document.getElementById(\`tdd-\${taskId}\`);
            const icon = document.getElementById(\`icon-\${taskId}\`);

            if (tddDiv) {
                if (tddDiv.classList.contains('hidden')) {
                    tddDiv.classList.remove('hidden');
                    if (icon) icon.style.transform = 'rotate(180deg)';
                } else {
                    tddDiv.classList.add('hidden');
                    if (icon) icon.style.transform = 'rotate(0deg)';
                }
            }
        }

        function renderUI(data) {
            window.lastData = data;

            // Update header
            document.getElementById('last-updated').textContent = new Date(data.timestamp).toLocaleString('zh-CN');
            document.getElementById('project-info').textContent = \`\${data.project_name} • \${data.snapshot_id}\`;

            // Top metrics
            const totalTasks = (data.iterations || []).reduce((sum, iter) => sum + (iter.tasks?.length || 0), 0) || 0;
            const completedTasks = (data.iterations || []).reduce((sum, iter) => {
                return sum + (iter.tasks || []).filter(t => t.status === 'done' || t.status === 'completed').length;
            }, 0) || 0;

            document.getElementById('top-metrics').innerHTML = \`
                \${renderMetricCard('迭代周期', data.iterations?.length || 0, 'milestone', 'text-blue-400')}
                \${renderMetricCard('任务总数', totalTasks, 'check-circle', 'text-emerald-400')}
                \${renderMetricCard('已完成', completedTasks, 'check-square', 'text-green-400')}
                \${renderMetricCard('进度', totalTasks > 0 ? Math.round(completedTasks/totalTasks*100) + '%' : '0%', 'percent', 'text-purple-400')}
            \`;

            // Iterations
            document.getElementById('iteration-count').textContent = \`\${data.iterations?.length || 0} 迭代\`;
            document.getElementById('iteration-list').innerHTML = (data.iterations || []).map(iter => {
                const taskList = iter.tasks || [];
                const completedTasks = taskList.filter(t => t.status === 'done' || t.status === 'completed').length;
                const progress = taskList.length > 0 ? (completedTasks / taskList.length * 100).toFixed(0) : 0;
                const isCurrent = iter.iteration_id === data.current_iteration;
                const isCollapsed = !isCurrent && collapsedIterations.has(iter.iteration_id);

                return \`
                    <div class="bg-zinc-900/40 rounded-xl border \${isCurrent ? 'border-blue-500/30 bg-blue-500/5' : 'border-zinc-800/50'} overflow-hidden">
                        <div class="p-4 border-b border-zinc-800/50 cursor-pointer hover:bg-zinc-800/30 transition-colors" onclick="toggleIteration('\${iter.iteration_id}')">
                            <div class="flex items-center justify-between mb-2">
                                <div class="flex items-center gap-3">
                                    \${isCurrent ? '<span class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded font-medium">当前</span>' : ''}
                                    <i data-lucide="\${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4 text-zinc-500 transition-transform"></i>
                                    <h3 class="font-bold text-base text-zinc-200">\${iter.iteration_name}</h3>
                                </div>
                                \${getStatusBadge(iter.status)}
                            </div>
                            <div class="flex items-center gap-4 text-xs text-zinc-500">
                                <span><i data-lucide="calendar" class="w-3 h-3 inline mr-1"></i>\${iter.start_date || '-'} ~ \${iter.end_date || '-'}</span>
                                <span><i data-lucide="list-todo" class="w-3 h-3 inline mr-1"></i>\${taskList.length} 个任务</span>
                            </div>
                        </div>
                        <div class="\${isCollapsed ? 'hidden' : ''}">
                            <div class="px-4 py-3 bg-zinc-900/20">
                                <div class="flex items-center justify-between text-xs mb-1">
                                    <span class="text-zinc-400">任务进度</span>
                                    <span class="text-zinc-300">\${completedTasks}/\${taskList.length} 已完成 (\${progress}%)</span>
                                </div>
                                <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                    <div class="bg-gradient-to-r from-blue-500 to-emerald-500 h-full transition-all duration-500" style="width: \${progress}%"></div>
                                </div>
                            </div>
                            <div class="p-4 space-y-2">
                                \${taskList.length > 0 ? taskList.map(task => {
                                    const tdd = task.tdd_plan || {};
                                    const hasTDD = tdd.test_cases && tdd.test_cases.length > 0;
                                    const coverage = tdd.coverage_actual || 0;
                                    const targetCoverage = tdd.coverage_target || 80;

                                    return \`
                                    <div class="bg-zinc-900/40 rounded-lg border border-zinc-800/30 overflow-hidden">
                                        <div class="p-3 cursor-pointer hover:bg-zinc-800/30 transition-colors" onclick="toggleTaskTDD('\${task.task_id}')">
                                            <div class="flex items-center justify-between">
                                                <div class="flex items-center gap-3">
                                                    <div class="w-1.5 h-6 rounded-full \${task.status === 'done' || task.status === 'completed' ? 'bg-emerald-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-zinc-600'}"></div>
                                                    <div>
                                                        <p class="font-medium text-sm text-zinc-200">\${task.task_name}</p>
                                                        <div class="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                                                            <span class="font-mono">\${task.task_id}</span>
                                                            \${task.priority ? \`<span class="px-1.5 py-0.5 rounded \${task.priority === 'high' || task.priority === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-700/50 text-zinc-400'}">\${priorityLabels[task.priority] || task.priority}</span>\` : ''}
                                                            \${hasTDD ? \`<span class="text-blue-400"><i data-lucide="flask-conical" class="w-3 h-3 inline"></i> \${tdd.test_cases.length} 测试</span>\` : ''}
                                                            \${hasTDD ? \`<span class="text-purple-400"><i data-lucide="target" class="w-3 h-3 inline"></i> \${targetCoverage}%</span>\` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="flex items-center gap-2">
                                                    \${getStatusBadge(task.status)}
                                                    \${hasTDD ? \`<i data-lucide="chevron-down" id="icon-\${task.task_id}" class="w-4 h-4 text-zinc-500 transition-transform"></i>\` : ''}
                                                </div>
                                            </div>
                                        </div>
                                        \${hasTDD ? \`
                                        <div id="tdd-\${task.task_id}" class="hidden border-t border-zinc-800/50">
                                            <div class="p-3 bg-zinc-900/60 space-y-3">
                                                \${tdd.test_file ? \`
                                                <div class="flex items-center gap-2 text-xs">
                                                    <i data-lucide="file-code" class="w-3 h-3 text-blue-400"></i>
                                                    <span class="text-zinc-400">测试文件:</span>
                                                    <code class="px-2 py-0.5 bg-zinc-800 rounded text-blue-300">\${tdd.test_file}</code>
                                                </div>
                                                \` : ''}

                                                <div>
                                                    <div class="flex items-center justify-between text-xs mb-1">
                                                        <span class="text-zinc-400">覆盖率</span>
                                                        <span class="text-zinc-300">\${coverage}% / \${targetCoverage}%</span>
                                                    </div>
                                                    <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                                        <div class="h-full \${coverage >= targetCoverage ? 'bg-emerald-500' : 'bg-yellow-500'}" style="width: \${coverage}%"></div>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p class="text-xs text-zinc-400 mb-2 flex items-center gap-1">
                                                        <i data-lucide="check-square" class="w-3 h-3"></i>
                                                        测试用例 (\${tdd.test_cases.length})
                                                    </p>
                                                    <div class="space-y-1">
                                                        \${tdd.test_cases.map(tc => \`
                                                        <div class="flex items-start gap-2 text-xs p-2 bg-zinc-800/50 rounded">
                                                            <span class="text-emerald-400 mt-0.5">✓</span>
                                                            <span class="text-zinc-300">\${tc}</span>
                                                        </div>
                                                        \`).join('')}
                                                    </div>
                                                </div>

                                                <div class="flex items-center justify-between pt-2 border-t border-zinc-800">
                                                    <span class="text-xs text-zinc-500">状态</span>
                                                    \${tdd.test_status === 'passed' ? '<span class="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded">PASSED</span>' :
                                                      tdd.test_status === 'failed' ? '<span class="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded">FAILED</span>' :
                                                      '<span class="px-2 py-0.5 bg-yellow-500/10 text-yellow-400 text-[10px] font-bold rounded">PENDING</span>'}
                                                </div>
                                            </div>
                                        </div>
                                        \` : ''}
                                    </div>
                                \`;
                                }).join('') : '<p class="text-sm text-zinc-500 text-center py-4">暂无任务</p>'}
                            </div>
                        </div>
                    </div>
                \`;
            }).join('');

            // TDD Overview
            const allTasks = (data.iterations || []).flatMap(iter => iter.tasks || []);
            const tasksWithTDD = allTasks.filter(t => t.tdd_plan && t.tdd_plan.test_cases && t.tdd_plan.test_cases.length > 0);
            const totalTestCases = tasksWithTDD.reduce((sum, t) => sum + (t.tdd_plan.test_cases?.length || 0), 0);
            const avgCoverage = tasksWithTDD.length > 0 ?
                tasksWithTDD.reduce((sum, t) => sum + (t.tdd_plan.coverage_actual || 0), 0) / tasksWithTDD.length : 0;
            const passedTests = tasksWithTDD.filter(t => t.tdd_plan.test_status === 'passed').length;
            const pendingTests = tasksWithTDD.filter(t => t.tdd_plan.test_status === 'pending').length;

            document.getElementById('tdd-overview').innerHTML = \`
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="flask-conical" class="w-4 h-4 text-purple-400"></i>
                        <span class="text-sm text-zinc-400">任务总数</span>
                    </div>
                    <span class="text-lg font-bold">\${allTasks.length}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="check-square" class="w-4 h-4 text-emerald-400"></i>
                        <span class="text-sm text-zinc-400">含 TDD</span>
                    </div>
                    <span class="text-lg font-bold">\${tasksWithTDD.length}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="list" class="w-4 h-4 text-blue-400"></i>
                        <span class="text-sm text-zinc-400">测试用例</span>
                    </div>
                    <span class="text-lg font-bold">\${totalTestCases}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="target" class="w-4 h-4 text-yellow-400"></i>
                        <span class="text-sm text-zinc-400">平均覆盖率</span>
                    </div>
                    <span class="text-lg font-bold">\${avgCoverage.toFixed(0)}%</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
                        <span class="text-sm text-zinc-400">通过</span>
                    </div>
                    <span class="text-lg font-bold text-emerald-400">\${passedTests}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-zinc-900/40 rounded-lg">
                    <div class="flex items-center gap-2">
                        <i data-lucide="clock" class="w-4 h-4 text-yellow-400"></i>
                        <span class="text-sm text-zinc-400">待测试</span>
                    </div>
                    <span class="text-lg font-bold text-yellow-400">\${pendingTests}</span>
                </div>
            \`;

            // Modules
            document.getElementById('module-grid').innerHTML = (data.modules && data.modules.length > 0 ? data.modules : [{
                module_id: 'MOD-DEMO',
                module_name: '示例模块',
                status: 'in_progress',
                completion_rate: 0.65
            }]).map(m => \`
                <div class="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                    <div class="flex justify-between items-start mb-3">
                        <p class="font-bold text-sm text-zinc-200">\${m.module_name}</p>
                        \${getStatusBadge(m.status)}
                    </div>
                    <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-blue-500 h-full" style="width: \${(m.completion_rate || 0)*100}%"></div>
                    </div>
                    <p class="text-[10px] text-zinc-500 mt-2 font-mono uppercase">\${((m.completion_rate || 0)*100).toFixed(0)}% 完成</p>
                </div>
            \`).join('');

            // Requirements
            document.getElementById('requirement-list').innerHTML = (data.requirements && data.requirements.length > 0 ? data.requirements : [{
                req_id: 'REQ-001',
                req_name: '示例需求',
                priority: 'high',
                status: 'pending'
            }]).map(req => \`
                <div class="p-3 bg-zinc-900/40 rounded-lg border border-zinc-800/50">
                    <div class="flex items-center justify-between mb-2">
                        <p class="font-medium text-sm text-zinc-200">\${req.req_name}</p>
                        \${req.priority ? \`<span class="px-1.5 py-0.5 rounded text-[10px] \${req.priority === 'high' || req.priority === 'critical' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-700/50 text-zinc-400'}">\${priorityLabels[req.priority] || req.priority}</span>\` : ''}
                    </div>
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-zinc-500 font-mono">\${req.req_id}</span>
                        \${getStatusBadge(req.status)}
                    </div>
                </div>
            \`).join('');

            // Git Info
            document.getElementById('git-info').innerHTML = \`
                <div class="flex justify-between"><span class="text-zinc-500">分支</span><span class="text-zinc-200 font-mono">\${data.git?.branch || '-'}</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">提交</span><span class="text-zinc-200 font-mono">\${data.git?.commit || '-'}</span></div>
                <div class="flex justify-between"><span class="text-zinc-500">状态</span><span class="\${data.git?.dirty ? 'text-yellow-400' : 'text-emerald-400'}">\${data.git?.status || '-'}</span></div>
            \`;

            // Languages
            const languages = data.languages || {};
            const languageEntries = Object.entries(languages).sort((a, b) => b[1].files - a[1].files);
            const totalFiles = languageEntries.reduce((sum, [, data]) => sum + data.files, 0);

            document.getElementById('language-stats').innerHTML = languageEntries.length > 0
                ? languageEntries.map(([lang, stats]) => {
                    const percentage = totalFiles > 0 ? (stats.files / totalFiles * 100).toFixed(1) : 0;
                    return \`
                        <div class="space-y-1">
                            <div class="flex justify-between items-center">
                                <span class="text-zinc-300">\${lang}</span>
                                <span class="text-zinc-500 text-xs">\${stats.files} 文件 (\${percentage}%)</span>
                            </div>
                            <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-emerald-500 h-full" style="width: \${percentage}%"></div>
                            </div>
                        </div>
                    \`;
                }).join('')
                : '<p class="text-zinc-500 text-center">暂无数据</p>';

            // Re-init icons
            lucide.createIcons();
        }

        function renderMetricCard(label, value, icon, iconColor) {
            return \`
                <div class="glass-card rounded-2xl p-5 flex items-center gap-5">
                    <div class="p-3 bg-zinc-900 rounded-xl">
                        <i data-lucide="\${icon}" class="w-6 h-6 \${iconColor}"></i>
                    </div>
                    <div>
                        <p class="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">\${label}</p>
                        <p class="text-2xl font-bold text-white">\${value}</p>
                    </div>
                </div>
            \`;
        }

        ${dataScript}
    </script>
</body>
</html>
`;
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'static';
  const outputFlag = args.includes('--output');
  const outputFile = outputFlag ? args[args.indexOf('--output') + 1] : 'snapshot.html';

  if (mode === 'static') {
    const snapshots = getSnapshots();
    const html = generateDashboardHtml(snapshots);

    fs.writeFileSync(outputFile, html, 'utf-8');
    console.log(`[Dashboard] Generated dashboard HTML: ${outputFile}`);
    console.log(`[Dashboard] Included ${snapshots.length} snapshot(s)`);
  } else if (mode === 'web') {
    console.log('[Dashboard] Web mode not yet implemented');
  }
}

module.exports = { generateDashboardHtml, getSnapshots };
