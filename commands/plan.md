---
description: Restate requirements, assess risks, and create step-by-step implementation plan. WAIT for user CONFIRM before touching any code.
---

# Plan Command

This command invokes the **planner** agent to create a comprehensive implementation plan before writing any code.

## What This Command Does

1. **Restate Requirements** - Clarify what needs to be built
2. **Identify Risks** - Surface potential issues and blockers
3. **Create Step Plan** - Break down implementation into phases
4. **Wait for Confirmation** - MUST receive user approval before proceeding

## When to Use

Use `/plan` when:
- Starting a new feature
- Making significant architectural changes
- Working on complex refactoring
- Multiple files/components will be affected
- Requirements are unclear or ambiguous

## How It Works

The planner agent will follow the **Requirements → Modules → Iterations → TDD** process:

1. **Requirements Analysis** - Break down into REQ-001, REQ-002, etc. with priorities
2. **Module Analysis** - Identify existing modules (MOD-XXX) and their completion status
3. **Iteration Planning** - Group tasks into ITER-001, ITER-002 with timelines
4. **TDD Planning** - Define test cases for each TASK-XXX-01 before implementation
5. **Present the plan** and WAIT for your explicit confirmation

### Phase 1: Requirements Analysis

Break down the work into **REQ-XXX** items:
- Extract functional and non-functional requirements
- Assign priorities (critical/high/medium/low)
- Define acceptance criteria for each requirement
- Link requirements to implementation tasks

Example:
```
REQ-001: User login with email and password
- Priority: high
- Status: pending
- Acceptance Criteria:
  * Login form accepts email and password
  * System validates credentials
  * Successful login returns JWT token
```

### Phase 2: Module Analysis

Identify existing (**MOD-XXX**) and new modules:
- Assess current module status (pending/in_progress/completed/has_issue)
- Calculate completion rates
- Map modules to requirements and tasks
- Identify module dependencies

Example:
```
MOD-AUTH: Authentication Module
- Current Status: needs_refactor
- Completion: 40%
- Related Tasks: TASK-AUTH-01, TASK-AUTH-02
```

### Phase 3: Iteration Planning

Group tasks into **ITER-XXX** phases:
- Define timeline for each iteration
- Assign priorities and risks
- Link iterations to requirements
- Ensure logical task dependencies

Example:
```
ITER-001: Core Authentication (2026-03-05 ~ 2026-03-07)
- Related Requirements: REQ-001, REQ-002
- Tasks: TASK-AUTH-01, TASK-AUTH-02, TASK-AUTH-03
```

### Phase 4: TDD Planning

For each **TASK-XXX-01**, define:
- Test file path
- Specific test cases
- Coverage target (e.g., 85%)
- Manual testing approach (if applicable)

Example:
```
TASK-AUTH-01: Create login API endpoint
- Test File: tests/auth/login.test.js
- Test Cases:
  * Should reject invalid email format
  * Should reject wrong password
  * Should return JWT token on success
  * Should handle concurrent login attempts
- Coverage Target: 85%
```

## Confirmation Flow

### Step 1: User confirms plan content
User says: "确认"

Agent: "计划已确认。准备开始执行吗？请说'开始'。"

### Step 2: User requests modifications (optional)
User says: "修改: [具体修改建议]"

Agent: Updates plan based on feedback, then asks for confirmation again.

### Step 3: User confirms execution
User says: "开始"

### Step 4: Agent saves plan and starts implementation
Agent:
- Creates directory: `.claude/plans/plan-YYYYMMDD-description/`
- Saves plan.md to that directory (now includes TDD details)
- Creates TodoWrite with all tasks
- Starts first task

### Alternative: User cancels
User says: "取消"

Agent: Aborts planning process.

## File Structure

Plans are saved in a directory structure:

```
.claude/plans/plan-YYYYMMDD-description/
├── plan.md              # The full plan document
├── status.json          # Processing status and metadata
├── requirements.json    # Extracted requirements (LLM generates on snapshot)
├── tasks.json          # Extracted tasks (LLM generates on snapshot)
└── modules.json        # Extracted modules (LLM generates on snapshot)
```

## Example Usage

```
User: /plan Add user authentication with JWT tokens

Agent (planner):
# 实施计划：用户认证与 JWT Token

## 需求分析 (Requirements)

### REQ-001: 用户登录功能
- 描述: 用户可以使用邮箱和密码登录系统
- 优先级: high
- 状态: pending
- 验收标准:
  * 登录表单接受邮箱和密码
  * 系统验证凭据
  * 成功登录返回 JWT token

### REQ-002: JWT Token 生成
- 描述: 系统生成并验证 JSON Web Tokens
- 优先级: high
- 状态: pending
- 验收标准:
  * Token 包含用户 ID 和过期时间
  * Token 使用 HS256 算法签名
  - Token 有效期为 24 小时

## 模块分析 (Module Analysis)

### MOD-AUTH: 认证模块
- 当前状态: pending
- 完成度: 0%
- 相关任务: TASK-AUTH-01, TASK-AUTH-02

### MOD-JWT: JWT 服务模块
- 当前状态: pending
- 完成度: 0%
- 相关任务: TASK-AUTH-03

## 迭代规划 (Iterations)

### ITER-001: 核心认证功能 (2026-03-05 ~ 2026-03-07)

#### 任务列表:

**TASK-AUTH-01: 创建登录 API**
- 描述: 实现 POST /api/auth/login 端点
- 模块: MOD-AUTH
- 优先级: high
- 风险: low

**TDD 计划:**
- 测试文件: tests/auth/login.test.js
- 测试用例:
  * 应该拒绝无效的邮箱格式
  * 应该拒绝错误的密码
  * 应该在成功时返回 JWT token
  * 应该处理并发登录请求
- 覆盖率目标: 85%

**TASK-AUTH-02: 实现密码哈希**
- 描述: 使用 bcrypt 对用户密码进行哈希
- 模块: MOD-AUTH
- 优先级: high
- 风险: medium

**TDD 计划:**
- 测试文件: tests/auth/hash.test.js
- 测试用例:
  * 应该使用 salt 进行哈希
  * 相同密码产生不同哈希
  * 应该正确验证密码
- 覆盖率目标: 90%

**TASK-AUTH-03: JWT Token 生成**
- 描述: 实现签发和验证 JWT token
- 模块: MOD-JWT
- 优先级: high
- 风险: medium

**TDD 计划:**
- 测试文件: tests/auth/jwt.test.js
- 测试用例:
  * 应该生成包含用户 ID 的 token
  * 应该验证有效的 token
  * 应该拒绝过期的 token
  * 应该拒绝无效签名
- 覆盖率目标: 85%

## 成功标准 (Success Criteria)

- REQ-001: 用户可以登录并获取 token
- REQ-002: JWT token 正确生成和验证
- MOD-AUTH: 模块完成度 100%
- 所有 ITER-001 任务完成
- 测试覆盖率 >= 85%

WAITING FOR CONFIRMATION: 确认此计划？（确认/修改/取消）

---

User: 确认

Agent: 计划已确认。准备开始执行吗？请说'开始'或'执行'。

---

User: 开始

Agent:
[Plan] Creating directory: .claude/plans/plan-20260305-auth/
[Plan] Saving plan.md...
[Plan] Creating TodoWrite with 3 tasks...
[Plan] Starting task: TASK-AUTH-01
```

## Risk Assessment

The planner identifies potential risks:

- **Technical Risks** - Complex integrations, performance concerns
- **Timeline Risks** - Blocked dependencies, uncertain estimates
- **Scope Risks** - Requirements may evolve or expand

For each risk, provide mitigation strategies.

## Success Criteria

Define measurable completion goals:

- All requirements implemented
- Module completion rates
- Test coverage thresholds
- Performance benchmarks
- Documentation completeness

## Complexity Assessment

Estimate implementation effort:

- **LOW**: 1-4 hours
- **MEDIUM**: 4-12 hours
- **HIGH**: 12-24 hours
- **CRITICAL**: 24+ hours

Breakdown by:
- Backend development
- Frontend development
- Testing and validation
- Documentation

## Auto-Save

Plans are saved to `.claude/plans/plan-YYYYMMDD-description/` when user says "开始"

The saved plan includes:
- `plan.md` - Full plan document

## Important Notes

**CRITICAL**: The planner agent follows a TWO-STEP process:

1. **Confirmation Stage**: User says "确认" → Plan content is confirmed
2. **Execution Stage**: User says "开始" → Agent saves plan, creates todos, and starts coding

**Common mistake**: Agent might save plan or create todo list on "确认" - this is WRONG
- "确认" means user confirms the plan content is correct
- "开始" means save the plan and start implementation

**Auto-Save**: Plan is saved to `.claude/plans/plan-YYYYMMDD-description/` directory only when user says "开始" or "执行", for tracking in project snapshots.

If you want changes, respond with:
- "修改: [具体修改建议]"
- "换种方式: [替代方案]"
- "跳过阶段2，先做阶段3"

## Integration with Other Commands

After planning:
- Use `/tdd` to implement with test-driven development
- Use `/snapshot` to visualize progress and update dashboard
- Use `/code-review` to review completed implementation
- Use `/build-fix` if build errors occur

## Related Agents

This command invokes the `planner` agent located at:
`~/.claude/agents/planner.md`
