# @tnotesjs/core 开发规范

## 项目概述

- 包名：`@tnotesjs/core`
- 定位：TNotes.xxx 子知识库的核心依赖（CLI、配置、服务、VitePress 主题/组件）
- 构建工具：tsup（ESM，target node18）
- 包管理器：pnpm

### 发版流程

必须使用发版脚本，禁止手动修改版本号：

```bash
pnpm release patch   # 日常发版
pnpm release minor   # 不兼容变更
pnpm release 0.0.2   # 指定版本号
```

脚本会自动执行：工作区检查 → CHANGELOG 检查 → 类型检查 → 构建 → 更新版本号 → 更新 CHANGELOG → commit + tag → 确认后 push + publish。

发版前必须在 `CHANGELOG.md` 的 `[Unreleased]` 下写入变更内容，否则脚本会拒绝执行。

### 版本号策略

当前处于 `0.x.y` 阶段（API 不稳定期）：

- **patch**：日常提交（bug 修复、优化、新功能混合），消费端无需改代码适配
- **minor**：消费端（TNotes.xxx）需要修改代码才能适配的变更（接口变更、配置格式变更等）
- **major**：API 稳定后正式发布，或重大架构变更

简化判断标准：这次改动发布后，TNotes.xxx 那边 `pnpm i` 完能不能直接跑？能 → patch，不能 → minor。

### CHANGELOG 规范

- 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)
- 分类使用：Added、Changed、Fixed、Removed
- 所有变更先写到 `[Unreleased]`，发版脚本会自动转为正式版本条目

### 本地开发

```bash
pnpm dev              # tsup --watch 监听模式构建
pnpm build            # 单次构建
pnpm build:check      # tsc 类型检查
```

宿主仓库本地调试：在宿主仓库中执行 `pnpm link ../core`。
恢复线上包：`pnpm unlink @tnotesjs/core && pnpm install`。

### 代码规范

- 源码使用 TypeScript，ESM 格式（`"type": "module"`）
- VitePress 主题和组件以源码形式发布（由宿主仓库的 Vite 处理），不经过 tsup 构建
- CLI 入口和 VitePress config 经过 tsup 预编译
- `vite`、`vitepress`、`vue` 为 peerDependencies，不要加入 dependencies

### 提交信息

- `feat: xxx` — 新功能
- `fix: xxx` — 修复
- `refactor: xxx` — 重构
- `docs: xxx` — 文档
- `release: vX.Y.Z` — 发版（由脚本自动生成）

## 指令分层

- 通用协作规则：见 [instructions/workflow-common.instructions.md](./instructions/workflow-common.instructions.md)
- 通用前端规则：见 [instructions/frontend-common.instructions.md](./instructions/frontend-common.instructions.md)
- 项目私有规则：见 [instructions/private.instructions.md](./instructions/private.instructions.md)
- 定制文件治理规则：见 [instructions/governance-private.instructions.md](./instructions/governance-private.instructions.md)

注意：链接文档适合承载详细说明，但不能假设代理一定会沿链接自动递归读取。真正必须命中的规则，应该直接写在本文件或对应的 .instructions.md 中。

## 常用验证命令

- pnpm exec vue-tsc -p tsconfig.build.json --noEmit
- pnpm lint
