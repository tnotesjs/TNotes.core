# Changelog

本文件记录 @tnotesjs/core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

暂无待发布的变更。

## [0.1.11] - 2026-03-31

### Removed

- 移除 `sync` 命令（保留 `push` 和 `pull`）
- 移除所有 `--all` 批量操作逻辑（`pushAll`、`pullAll`、`syncAll`、`updateAll` 等）
- 移除 `sync-core` 命令及 `SyncCoreService`（submodule 时代遗留）
- 移除 `getTargetDirs`、`syncRepo` 工具函数
- 移除 `TNOTES_BASE_DIR`、`TNOTES_CORE_DIR`、`EN_WORDS_DIR` 常量

### Fixed

- 修复 `index.ts` 的 ts(7053) 类型错误（`CommandArgs` 索引签名）
- 修复 `tsup.config.ts` 的 ts(2339) 类型错误（`esbuildOptions` context 类型）
- 新增 `types/shims.d.ts`，修复 `.vue` 和 `.svg` 模块的 ts(2307) 类型声明缺失

## [0.1.9] - 2026-03-31

### Changed

- 架构迁移：从 Git Submodule 迁移为 NPM 包（`@tnotesjs/core`）
- `ConfigManager` 使用 `process.cwd()` 作为默认根路径（适配 NPM 模式）
- VitePress 配置新增 `resolve.dedupe: ['vue', 'vitepress']` 解决 pnpm link 下 Vue 实例重复问题
- VitePress 配置新增 `optimizeDeps.include` 处理 CJS 依赖（katex、dayjs、sanitize-url、mermaid）
- `sass-embedded`、`markdown-it-task-lists` 从 devDependencies 移至 dependencies
- `mermaid` 加入 dependencies

### Removed

- 移除 `GitManager` 中的 submodule 相关逻辑（~100 行）
- 宿主仓库依赖从 22 个精简为 4 个

## [1.0.0] - 2025-02-20

### Added

- 从 TNotes.introduction 中提取共享核心脚本，初始化为独立仓库
- **commands/** — CLI 命令体系（dev、build、preview、push、pull、update 等）
- **config/** — 配置管理（ConfigManager、默认配置、模板、常量）
- **core/** — 核心模块（GitManager、NoteManager、NoteIndexCache、ProcessManager、ReadmeGenerator、TocGenerator）
- **services/** — 服务层（file-watcher、git、note、readme、timestamp、vitepress）
- **types/** — TypeScript 类型定义（config、note）
- **utils/** — 工具函数（日志、文件操作、端口检测、Markdown 解析、校验等）
- **vitepress/** — VitePress 主题与插件（Layout、Discussions、EnWordList、Footprints、NotesTable、Mermaid、MarkMap 等组件）

[Unreleased]: https://github.com/tnotesjs/core/compare/v0.1.11...HEAD
[0.1.11]: https://github.com/tnotesjs/core/compare/v0.1.9...v0.1.11
[0.1.9]: https://github.com/tnotesjs/core/compare/v1.0.0...v0.1.9
[1.0.0]: https://github.com/tnotesjs/core/releases/tag/v1.0.0
