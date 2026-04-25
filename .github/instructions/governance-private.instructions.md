---
name: "Customization Governance Rules"
description: "Use when creating, renaming, or reorganizing Copilot customization files under .github. Covers instruction layering, naming conventions, portability, and when to use copilot-instructions.md versus .instructions.md."
applyTo:
  - ".github/copilot-instructions.md"
  - ".github/instructions/**"
---
# 定制文件治理规则

- 项目级总入口只保留一个：`.github/copilot-instructions.md`。
- 总入口只放所有任务都成立的硬规则，不堆长篇背景说明。
- 细分规则统一放在 `.github/instructions/*.instructions.md` 中，用 `description` 和 `applyTo` 控制加载范围。
- 文件命名统一使用 `<topic>-<scope>.instructions.md`。
- `common` 表示可跨项目复制的规则；`private` 表示当前仓库特有规则。
- 通用规则不要写死项目名、目录名、运行时特例；私有规则不要重复通用规则已经覆盖的内容。
- 如果某份规则本质上是“希望代理遵守的行为”，优先写成真正的 `.instructions.md`，不要只保留为普通 markdown 说明文档。
- 如果某类规则只对部分目录或部分文件生效，继续拆分新的单一职责 instruction 文件，而不是继续堆回总入口。
- 当前仓库的命名分层以 `workflow-common`、`frontend-common`、`private`、`governance-private` 为基准，后续新增文件沿用这一模式。
