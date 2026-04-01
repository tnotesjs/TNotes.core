# Changelog

本文件记录 @tnotesjs/core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

暂无待发布的变更。

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

[Unreleased]: https://github.com/tnotesjs/core/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/tnotesjs/core/releases/tag/v0.0.1
