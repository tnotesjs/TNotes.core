# Changelog

本文件记录 @tnotesjs/core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Fixed

- 修复年度笔记页注入原始 Markdown 内容时，正文中的 `</script>` 字面量会提前闭合注入脚本块，导致页面解析报 `Invalid end tag`；现在会在注入前安全转义该片段，原文展示与复制行为不受影响

## [0.0.5] - 2026-04-06

### Fixed

- 修复构建进度插件在 Rollup `closeBundle` 阶段误打印"构建成功"导致 `VitepressService` 误判构建结果：SSR 渲染 OOM 时进程仍报告成功，造成部署不完整产物（GitHub Pages 404）
- 修复 `VitepressService.build()` 中 `buildSucceeded` 标志绕过进程退出码检测的问题：现在仅依赖退出码 `code === 0` 判定构建成功

### Changed

- `buildProgressPlugin` 的 `closeBundle` 阶段日志从"✅ 构建成功"改为"🔨 Rollup 打包完成 → ⏳ VitePress 正在渲染页面..."，准确反映构建阶段

## [0.0.4] - 2026-04-01

### Fixed

- 修复底部翻页组件（DocFooter）不跟随侧边栏笔记编号显示/隐藏设置的问题

## [0.0.3] - 2026-04-01

### Fixed

- 修复大型知识库构建时 Node.js OOM 导致构建失败：为子进程设置 `--max-old-space-size=4096`，且构建产物已生成时忽略 OOM 退出码
- 修复构建进度条时间分布严重不均匀：按实际 transform/chunk 耗时比例分配权重，增加停滞填充计时器平滑 VitePress 页面渲染阶段的进度空窗期
- 修复构建进度条输出拦截函数的 TypeScript 类型错误（callback 参数 `Error` → `Error | null`）

## [0.0.2] - 2026-04-01

### Added

- 新增 `.github/copilot-instructions.md`，明确 core 的发版流程、版本策略和本地开发约定

### Fixed

- 修复 Windows 下通过笔记关于面板重命名笔记时可能出现的 `EPERM`：重命名前临时关闭文件监听，完成后自动恢复
- 修复 `build:check` 和发版脚本默认调用 `tsc --noEmit` 时未指定 `tsconfig.build.json` 导致的类型检查失败

## [0.0.1] - 2026-04-01

### Added

- 从 TNotes.introduction 中提取共享核心逻辑，发布为独立 NPM 包（`@tnotesjs/core`）
- CLI 命令体系：dev、build、preview、push、pull、update、create-notes 等
- 配置管理：ConfigManager、默认配置、模板、常量
- 核心模块：GitManager、NoteManager、NoteIndexCache、ProcessManager、ReadmeGenerator、TocGenerator
- 服务层：file-watcher、git、note、readme、timestamp、vitepress
- VitePress 主题与组件：Layout、Discussions、EnWordList、Footprints、NotesTable、Mermaid、MarkMap 等
- TypeScript 类型定义、工具函数库
- `tn:push` 流程：`git add → commit → fix-timestamps → amend → push`，时间戳精确等于 commit 时间
- `TimestampService.fixAllTimestamps()` 批量构建时间戳 Map，支持万级笔记规模
- `tsup` 构建配置，`onSuccess` 钩子为 CLI 入口注入 shebang
- 发版脚本 `scripts/release.mjs`，规范化发布流程

[Unreleased]: https://github.com/tnotesjs/core/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/tnotesjs/core/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/tnotesjs/core/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/tnotesjs/core/compare/v0.0.2...v0.0.3
[0.0.1]: https://github.com/tnotesjs/core/releases/tag/v0.0.1
