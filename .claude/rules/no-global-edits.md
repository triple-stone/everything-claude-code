# 禁止直接修改全局配置

## 规则

**禁止直接修改 `~/.claude/` 目录下的任何文件**

## 正确流程

1. **在 ECC 项目中修改**
   - 所有修改先在 `/home/triplestone/code/github/everything-claude-code/` 中进行
   - 测试验证修改正确

2. **部署到全局**
   - 使用 `cp` 命令从 ECC 项目复制到 `~/.claude/`
   - 例如：`cp skills/project-snapshot/scripts/task-collector.js ~/.claude/skills/project-snapshot/scripts/task-collector.js`

3. **验证部署**
   - 对比文件确保部署成功
   - 在实际项目中测试

## 原因

- ECC 项目是源代码仓库，需要版本控制
- 全局配置是部署目标，应该通过复制部署
- 避免直接修改导致源代码和部署不一致
- 便于追踪变更历史和回滚

## 受影响的文件

- `~/.claude/agents/`
- `~/.claude/skills/`
- `~/.claude/commands/`
- `~/.claude/rules/`
- `~/.claude/hooks.json`
- `~/.claude/settings.json`

## 违反此规则的后果

- 源代码和部署不一致
- 无法追踪修改历史
- 难以回滚和恢复
- 困惑哪个是最新版本
