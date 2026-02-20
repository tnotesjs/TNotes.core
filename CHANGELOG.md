# Changelog

本文件记录 TNotes.core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

暂无待发布的变更。

## [1.0.0] - 2025-02-20

### Added

- 从 TNotes.introduction 中提取共享核心脚本，初始化 TNotes.core 仓库
- **commands/** — CLI 命令体系
  - `dev` 启动开发服务器
  - `build` / `preview` 构建与预览
  - `pull` / `push` / `sync` Git 操作
  - `create-note` / `rename-note` / `update-note-config` 笔记管理
  - `fix-timestamps` / `sync-scripts` 维护工具
  - `update` / `update-completed-count` 更新知识库
  - `help` 帮助信息
- **config/** — 配置管理（ConfigManager、默认配置、模板、常量）
- **core/** — 核心模块（GitManager、NoteManager、NoteIndexCache、ProcessManager、ReadmeGenerator、TocGenerator）
- **services/** — 服务层
  - `file-watcher` 文件变更监听（含 rename 检测、事件调度、全局更新协调）
  - `git` / `note` / `readme` / `sync-scripts` / `timestamp` / `vitepress` 各功能服务
- **types/** — TypeScript 类型定义（config、note）
- **utils/** — 工具函数（日志、文件操作、端口检测、Markdown 解析、校验等）
- **vitepress/** — VitePress 主题与插件
  - 自定义组件：Layout、AboutPanel、Discussions、EnWordList、Footprints、NotesTable、Mermaid、MarkMap、ImagePreview、BilibiliOutsidePlayer 等
  - 主题样式（SCSS）
  - 构建插件（buildProgress、renameNote、updateConfig、getNoteByConfigId）
  - Markdown / Head / Theme 配置

[Unreleased]: https://github.com/tnotesjs/TNotes.core/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tnotesjs/TNotes.core/releases/tag/v1.0.0
