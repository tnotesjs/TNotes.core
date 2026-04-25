---
name: "Workflow Common Rules"
description: "Use when implementing, debugging, refactoring, or reviewing code changes. Covers clarifying assumptions, preferring simple solutions, keeping diffs small, cleaning only your own change fallout, and validating before finishing."
applyTo:
  - "src/**"
  - "build/**"
  - ".github/**"
  - "vite.config.ts"
  - "eslint.config.mjs"
  - "package.json"
---
# 通用协作规则

这份规则不依赖当前仓库结构，可直接复制到其它前端或 TypeScript 项目中使用。

- 先澄清假设，再开始实现；如果需求边界不清，先说明分歧点，不要静默猜测。
- 优先选择最小可行方案，不为单次复用提前抽象，不引入未被要求的配置项或扩展点。
- 只改和当前任务直接相关的内容，不顺手调整邻近代码、注释、格式或目录结构。
- 如果本次修改制造了未使用导入、未使用变量、无调用方函数等后果，应一并清理。
- 不要把“顺手清理历史遗留”伪装成当前任务的一部分。
- 多步骤任务先拆出可验证的小目标，完成后至少做一轮与改动范围匹配的验证。
- 如果无法完成验证，要明确说明缺失了什么验证以及原因。
