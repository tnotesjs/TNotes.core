---
name: "Reusable Frontend Rules"
description: "Use when editing Vue, TypeScript, SCSS, or Vite frontend files. Covers reusable frontend rules for feature folders, shared layers, composables, barrel files, imports, comments, and validation."
applyTo:
  - "src/**/*.ts"
  - "src/**/*.vue"
  - "src/**/*.scss"
  - "vite.config.ts"
  - "eslint.config.mjs"
---
# 通用前端规则

这份规则应保持跨项目可复用，不写当前仓库独有的目录名、任务名或运行时特例。

- 优先保持 feature 内聚。只在跨 feature 复用已经成立时，才把逻辑提升到共享层。
- 不要把 utils 当作兜底目录。共享逻辑应按职责放到 components、composables、api、types、utils 等合适位置。
- 页面入口组件负责组装，不要把所有状态、交互和副作用堆进一个超大文件。
- 单个 composable 只管理一个明确子域，不为单次复用提前抽象。
- index.ts 只做导出入口，不直接承载实现、副作用或初始化逻辑。
- barrel 文件只导出稳定成员，不顺手暴露私有实现；无消费方的 re-export 应及时清理。
- 保持导入风格稳定，遵循仓库现有的 lint 和 import order 约束，不在同一目录中混用多套风格。
- 注释只解释约束、意图和运行时前提，不复述代码表面行为。
- 改动完成后，至少执行与改动范围匹配的类型检查或 lint，而不是只做静态推断。
- 如果本次改动制造了未使用导入、未使用变量或死成员，应一并清理。
