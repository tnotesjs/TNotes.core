# Changelog

本文件记录 @tnotesjs/core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 新增语雀风格自定义侧边栏：基于根 README/sidebar data 渲染目录树，并支持 README 目录入口、当前笔记聚焦和笔记编号切换。
- 新增开发态侧边栏结构操作：目录重命名/删除、目录内新增单篇或多篇笔记、笔记重命名/删除、笔记上下新增，以及笔记/同级目录拖拽排序。
- 新增 `sidebarStructurePlugin`，并扩展 README/Note 服务能力，用于在 dev server 中同步修改根 README、笔记目录和 sidebar 数据。
- 设置面板新增侧边栏本地配置：目录风格（紧凑/默认/宽松）和已完成/未完成笔记前缀（默认 `✅`/`⏰`，允许留空）。

### Changed

- 重构设置面板为更简洁的行式布局，并将配置说明收敛为悬停提示。
- 侧边栏目录项和笔记项改为行式交互，hover 时显示折叠菜单，减少默认占位和标题挤压。
- about 面板支持由侧边栏打开指定笔记，标题、状态、描述和外部链接会跟随当前弹窗目标切换。
- 侧边栏笔记状态展示改为基于本地前缀配置渲染，不再直接透传 sidebar 数据中的状态 emoji。
- 调整自定义侧边栏外壳与默认 sidebar 占位策略，保留 VitePress sidebar 插槽渲染并隐藏默认空组。

### Fixed

- 修复 README 目录入口在带 `site.base` 的 `/TNotes.xxx/README` 路由下不会高亮的问题。
- 修复移除默认 sidebar 条目后，自定义侧边栏外壳不渲染的问题。
- 修复侧边栏笔记项缩进过浅、目录箭头展开状态未旋转、操作菜单点击后不自动关闭，以及拖拽落点提示不明显的问题。
- 修复新建笔记后 note index cache 未同步，导致后续侧边栏结构操作可能读取旧笔记列表的问题。

## [0.1.15] - 2026-04-25

### Changed

- 设置入口由侧边栏工具区迁移至 VPNav 最右侧（通过 `nav-bar-content-after` 插槽渲染 `NavBarSettingsTrigger`），点击仍调用统一的 `useSettingsDialog().open()`。
- `NavBarSettingsTrigger` 改用统一图标资源 `icon__setting.svg` 渲染设置按钮。
- 侧边栏顶部目录管理按钮重新分组：左侧「折叠按钮 + 『目录』文案」，右侧「定位按钮 + 索引切换按钮」。

## [0.1.14] - 2026-04-25

### Fixed

- 发布修复：`0.1.0` ~ `0.1.13` 的版本号在 npm registry 上均已被历史 unpublish 占用形成 tombstone，无法复用。本次直接跳到 `0.1.14` 发布相同内容，本版本相对 `0.1.1` 没有任何代码改动。

## [0.1.1] - 2026-04-25

### Fixed

- 发布修复：`0.1.0` 在 npm registry 上因历史 unpublish 形成 tombstone 无法重新发布，改用 `0.1.1` 发布同样的内容。本版本相对 `0.1.0` 没有任何代码改动。

## [0.1.0] - 2026-04-25

### Added

- 设置面板改为全局 dialog 形式：新增 `vitepress/components/Settings/composables/useSettingsDialog.ts`（模块级 `reactive` 单例 store）与 `vitepress/components/Settings/SettingsDialog.vue`（`<ClientOnly>` + `<Teleport to="body">` 容器，支持「全屏 / 还原」切换、点击遮罩或按 Esc 关闭），由 `Layout.vue` 全局挂载。
- 侧边栏顶部新增 ⚙️ 设置入口按钮（位于 `SidebarNavBefore` 工具区），点击直接打开设置 dialog，无需再走整页路由。

### Changed

- `defaultConfig.ts` 移除菜单项 `{ text: '⚙️ Settings', link: '/Settings' }`：设置不再依赖 VitePress 路由。
- `SidebarCard.vue` 中两处「未配置本地知识库」的 `confirm` 跳转改为调用 `useSettingsDialog().open()`，不再 `router.go(\`${REPO_NAME}/Settings\`)`。
- 设置 dialog 打开期间，捕获阶段拦截 `Ctrl/Cmd+K` 与 `Esc`，避免与 VitePress 本地搜索弹窗叠加冲突。

### Migration（重要，本次为 minor 升级原因）

宿主仓库（TNotes.xxx）升级到本版本后需要手动清理：

1. 从 `.tnotes.json` 的 `menuItems` 中删除 `{ text: '⚙️ Settings', link: '/Settings' }`，否则顶部导航会留下指向不存在 `/Settings` 路由的 404 链接。
2. 可安全删除根目录的 `Settings.md`（`<S />` 组件已不再需要通过单独路由承载）；`<S />` / `<Settings />` 全局组件仍然保留，存量内容不会立刻失效。

## [0.0.9] - 2026-04-25

### Added

- 新增 `pnpm typecheck` 脚本（`vue-tsc --noEmit -p tsconfig.build.json`），覆盖 `.ts` 与 `.vue` 全量类型检查。

### Changed

- 重命名笔记不再依赖宿主仓库的 `loading.md` 中转页：后端 `/__tnotes_rename_note` 直接在响应中返回 `newUrl`，前端通过统一的 `useRenameRedirect` 工具显示遮罩并整页跳转。宿主仓库可以删除 `loading.md`。
- 文件系统直接重命名笔记目录（在编辑器或资源管理器中改名）时，dev server 会通过 Vite WS 推送 `tnotes:note-renamed` 事件，前端检测到当前页面位于被重命名的文件夹下时会自动跳转到新 URL，与「关于面板保存标题」体验一致。
- `LoadingPage` 组件改造为纯遮罩组件（`<Teleport to="body">`），由全局 `useRenameOverlay` store 控制显隐，不再注册为全局组件，也不再承担路由 / 自动跳转职责。

### Fixed

- 修复重命名标题后偶发跳回首页：旧实现的 `/loading` 页在请求 `/__tnotes_get_note` 时未拼接 `site.base`，导致 404 后落入「未找到笔记」分支并跳回 README。新方案直接复用后端返回的 URL，避免该路径。
- 修复直接通过文件系统重命名笔记目录后，目录内 `README.md` 的一级标题未同步更新；现在 `FolderChangeHandler.handleTitleOnlyRename` 会按 `0000. 标题` 推导新标题并重写 H1（与 `RenameNoteCommand` 行为一致）。
- 修复直接通过文件系统重命名笔记目录后，浏览器地址栏未跳转到新 URL：file-watcher 与 Vite dev server 跑在不同进程，单例无法共享导致原 WS 推送从未生效。改用 HTTP IPC：file-watcher 完成重命名后通过 Node 原生 `http.request` 调 vite dev server 暴露的 `/__tnotes_broadcast_rename` 接口（避开 Windows 上 Node 18.x undici fetch 偶发的 `TypeError: fetch failed`），并依次尝试 `127.0.0.1` 与 `::1` 兼容 vite 默认只绑 IPv6 `localhost` 的情况；vite 端 `fileWatcherBridgePlugin` 收到后 `ws.send` 广播 `tnotes:note-renamed`，中间件路径校验同时接受 base 前缀与无前缀。
- 修复直接通过文件系统重命名「当前所在页」目录后地址栏未更新：Vite chokidar 会同时触发 `full-reload`，与我们的 `setTimeout + location.replace` 形成竞态，full-reload 以旧 URL 抢先重载。改为先用 `history.replaceState` 同步把地址栏切到新 URL，再 `location.replace`，确保无论谁先 reload 都落在新页面。
- 修复 `FileWatcherService` 字段在 `vue-tsc` strict 模式下报「属性未初始化」：这些字段在构造函数调用的 `init()` 中赋值，TS 无法推断跨方法初始化，改为使用 definite assignment assertion (`!:`)。

## [0.0.8] - 2026-04-25

### Added

- 新增 GitHub Actions CI，按 pnpm 安装依赖后依次运行 lint、TypeScript 检查、Vue 类型检查和构建。
- 新增 markdownlint 配置，适配 Keep a Changelog 中跨版本重复的 Added、Changed、Fixed 小标题。

### Changed

- 完善 ESLint flat config：补齐 JavaScript、TypeScript、Vue recommended 规则，并保留符合当前项目源码风格的覆盖规则。
- 将 `pnpm lint` 调整为 `eslint . --max-warnings=0`，要求 lint 在本地和 CI 中以 0 warning / 0 error 通过。
- 为 README 目录结构代码块补充语言标识，并折行超长段落以满足 markdownlint 规则。

## [0.0.7] - 2026-04-25

### Changed

- 一键复制功能注入 `frontmatter.rawContent` 时改为 base64(UTF-8) 编码，前端 `atob` + `TextDecoder` 解码后再写入剪贴板。彻底规避 VitePress 在生成 vueSrc 时多重正则（HTML 解析 `</script>`、`scriptClientRE` 等）对原文中 `<script>` 字面量的误匹配，对 VitePress 内部实现细节零依赖。前端消费点：`vitepress/components/Layout/DocBeforeControls.vue`

## [0.0.6] - 2026-04-24

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

[Unreleased]: https://github.com/tnotesjs/core/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/tnotesjs/core/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/tnotesjs/core/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/tnotesjs/core/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/tnotesjs/core/compare/v0.0.2...v0.0.3
[0.0.1]: https://github.com/tnotesjs/core/releases/tag/v0.0.1
