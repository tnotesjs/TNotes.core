# Changelog

本文件记录 @tnotesjs/core 的所有版本变更，格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- 接入 `@tnotesjs/ui@^0.1.0`：BilibiliVideo、WordList、Mermaid、Mindmap、NotesTable、Footprints 共享 Vue 组件与 `--tn-*` token。
- 新增 `scripts/migrate-vue-component-tags.mjs`，将历史 `<B>` / `<N>` / `<E>` / `<F>` 迁移为全名标签。
- Mindmap 预览改用 `@tnotesjs/ui` 的 `Mindmap` 与 `FocusBreadcrumbs`。

### Changed

- **Breaking**：移除短名 Vue 全局组件注册（`B` / `N` / `E` / `F`）；落盘仅支持 `BilibiliVideo`、`WordList`、`NotesTable` 等全名。
- **Breaking**：Footprints 改为 `::: footprints` 容器语法；旧 `<Footprints>` Vue 标签不再支持。
- VitePress theme 从 `@tnotesjs/ui` 注册内置组件，本地 VP adapter 仅保留 data loader / Layout enhancer。
- 依赖 `@tnotesjs/mindmap-core` 升级至 `^0.2.2`。

### Removed

- 删除 core 内重复的 EnWordList RightClickMenu、旧 Mindmap 预览实现等已迁入 `@tnotesjs/ui` 的代码。

## [0.7.0] - 2026-08-28

### Changed

- Workspace TOC 改为 files-first reconcile，移除 TocService。

## [0.6.0] - 2026-08-24

### Changed

- Mindmap 预览改用脑图、大纲、源码图标切换视图，工具栏与代码块一致，仅在悬停或键盘聚焦时显示。
- Mindmap 预览新增适应视口与全屏/退出全屏操作，全屏图标复用代码块资源。
- Mindmap 预览改为点击画布后才接管容器内的滚轮；点击外部或按 `Esc` 后恢复页面滚动。
- Mindmap Markdown 输入统一为 `mindmap [title] 2` 规范围栏；这是一次破坏性变更，旧笔记需先完成语法迁移。

### Fixed

- 修复进入主题后，画布聚焦根与左上角导航因非响应式 session 未同步刷新的问题。

### Removed

- 移除 `markmap` 围栏、`markmap {2}` 参数、H2～H6 自动转树和显式 `- root` 提升等旧输入兼容逻辑。
- 移除旧 `MarkMap` 全局组件别名，只保留 `MindmapPreview`。

## [0.4.2] - 2026-08-21

### Fixed

- 同时预构建 Mermaid 使用的 `fastdom-promised` 扩展，避免主入口修复后扩展入口继续触发 ESM 默认导入错误。

## [0.4.1] - 2026-08-21

### Fixed

- 修复 pnpm 严格依赖布局下 Mermaid 的 CommonJS `fastdom` 未被 Vite 预构建，导致 `tn:dev` 页面白屏的问题。

## [0.4.0] - 2026-08-21

### Added

- 新增基于 `@tnotesjs/mindmap-core` 的只读 Mindmap 预览，默认脑图视图，并提供大纲、规范化源码视图。
- 新增推荐的 `mindmap` Markdown 围栏；支持 `[title]`、`<<< file.md [title]` 和内容 H1 三种根主题标题来源，无标题时使用 `root`。
- 展开层级按“根节点 - 一级子节点 - 二级子节点”定义：`1` 显示到一级，`2` 显示到二级，最小值为 `1`。

### Changed

- 知识库内的脑图改为只读预览：保留平移、缩放、折叠、进入主题和链接跳转，禁用编辑、拖拽、删除、粘贴及格式修改。
- 脑图亮色/暗色主题实时跟随 VitePress 文章主题。
- 继续兼容旧 `markmap`、`markmap 2`、`markmap {2}`、外部文件引用及旧 H2～H6 数据，无需批量迁移旧笔记。

### Removed

- 移除旧 MarkMap 组件、样式以及 `markmap-*` / D3 运行时依赖。

## [0.3.0] - 2026-08-07

### Changed

#### Breaking — 配置时间戳移除

- `NoteConfig` 与 `root_item` 不再包含 `created_at` / `updated_at`；`root_item.days_since_birth` 同步移除。写入笔记配置时仅保留白名单字段，并在校验/写回时主动剥离废弃时间戳；根配置写回同样剥离。
- 移除 `TimestampService` 与 CLI 命令 `tn:fix-timestamps`；`tn:push` 简化为 `git add → commit → push`，不再 fix/amend 时间戳。
- 前端不再展示创建/最近更新时间（About 弹窗、SidebarCard、首页 git 时间戳 loader）。
- `tn:update-completed-count` 仍按近 12 个月从 TOC/README Git 历史回填，但不再依赖 `root_item.created_at`。

#### Changed — MarkMap

- 设置面板移除「笔记内 MarkMap」展开层级配置；默认初始展开层级固定为 **3**。仍可在代码块上指定层级（如 ` ```markmap 2 `），或在组件工具栏临时调整。

#### Added — 本地 IDE 打开

- 设置「本地 IDE 打开」支持选择 **VS Code** / **Cursor**（默认 VS Code）；分别使用 `vscode://file/...` 与 `cursor://file/...`。
- 首页 / 侧栏 / 文档工具栏的打开按钮图标与文案随所选 IDE 切换。

## [0.2.2] - 2026-06-28

### Fixed

- 修复 `0.2.1` npm 包仍缺少 `services/`、`utils/`、`config/`、`core/` 源码，导致宿主仓库 Vite 打包 `@tnotesjs/core` 的 `sidebar.data.ts` / Layout 组件时无法解析 `../../services/toc/service`、`../../../utils/tocNodeId` 等模块。`package.json` `files` 与 `.npmignore` 已对齐 vitepress 源码的实际依赖面。

## [0.2.1] - 2026-06-28

### Fixed

- 修复 `0.2.0` npm 包未包含 `dist/` 编译产物（`dist/cli/index.js`、`dist/vitepress/config/index.js`），导致宿主仓库 `pnpm tn:dev` 报 `ERR_MODULE_NOT_FOUND`。发版脚本与 `prepublishOnly` 现会在发布前校验 dist 产物。

## [0.2.0] - 2026-06-28

本版本为 **minor** 升级，核心变更是将知识库目录数据源从根 `README.md` 迁移至 **`TOC.md`**，并配套语雀式侧边栏交互、三栏文档布局与 CLI 脚手架。自 v0.1.x 升级的宿主仓库请阅读文末 **Migration** 小节。

### Added

#### 目录与 CLI（TOC.md 体系）

- 根目录 **`TOC.md`** 作为笔记层级与侧边栏的唯一数据源；`pnpm tn:update` 规范化 `TOC.md` 并生成 `sidebar.json`。
- 新增 **`TocService`**（`services/toc/`）与 **`utils/tocHelpers.ts`**：解析 canonical 格式、缩进树序列化、`tocLineIndex` 行号定位、从 TOC 生成 sidebar。
- 新增 **`utils/tocNodeId.ts`**：dev 模式下为拖拽 API 提供 `node_uuid`（`note:0001` / `folder:…`），不写入 `TOC.md`。
- 新增常量 **`ROOT_TOC_PATH`**。
- 新增过渡命令 **`init-toc`**（`pnpm tn:init-toc`）：从 v0.1.x 根 `README.md`（`<!-- endregion:toc -->` 之后）解析笔记分区，按 `##` 标题生成 folder 行、组内笔记缩进为子项，写入 `TOC.md` 并刷新 sidebar。**仅在 v0.2.x 提供，v0.3.x 移除。**
- 新增 **`utils/migrateReadmeToToc.ts`** 迁移解析器。
- **`sidebar.data.ts`**：加载前从 `TOC.md` 重建 `sidebar.json`；监听 `TOC.md` / `sidebar.json` 变更触发 HMR。

#### 侧边栏结构与拖拽

- 语雀式 Pointer 拖拽 v3：**`useSidebarDrag`**、**`sidebarDragLogic`**、**`sidebarHitTest`**；整行拖拽、水平缩进改层级、overlay 落点指示线、幽灵预览与乐观 UI。
- 落点持久化：`POST /__tnotes_sidebar_reorder`，`moveAfter` / `prependChild` + `node_uuid` / `target_uuid`（旧 `dragTocLineIndex` 仍作 fallback）。
- 纯目录行（无 link）：展开/折叠、「+」新建子笔记/子目录、作为拖拽源与落点；folder 重命名与级联删除（子树 TOC 行 + 磁盘笔记）。
- TOC 支持目录与笔记任意嵌套；Sidebar「+」可新建子目录。
- 侧边栏展开状态 v2 写入 localStorage（`note:` / `line:` 键），拖拽排序与 HMR 后不再全部折叠。

#### 文档布局

- 语雀式三栏：左目录（260–480px 可调）、中间正文、右页内目录（VitePress `VPDocAside`，300px 贴齐视口右侧）；左右栏不再受 1440px 居中壳偏移。
- **`useDocLayout`** / **`doc-layout.scss`**：正文区域页宽模式 **`wide`**（超宽，默认）与 **`standard`**（750px），由设置面板配置，存 localStorage。
- 视口宽度不足时自动降级：先隐藏右侧页内目录，仍不足则自动折叠左目录（不写 localStorage，与用户手动折叠独立）。

#### 子库脚手架

- 新增 CLI 命令 **`init-sub-repo`**（`pnpm tn:init-sub-repo`）：交互式初始化 `TNotes.{topic}` 子知识库；内置 **`templates/sub-repo/`** 模板（deploy workflow、VitePress 入口、VS Code snippets、静态资源等）。
- 生成 `.tnotes.json`、`package.json`、根 `README.md`、`TOC.md`、`index.md`、首篇笔记 `0001. TNotes.{topic}`，并自动规范化 TOC、生成 `sidebar.json`。
- 检测到已有 `.tnotes.json` 时打印绝对路径并退出；`templates/` 纳入 npm 发布包。

#### 开发体验与其他

- dev 模式 Local Search：笔记新增/删除后服务端 debounced 全量重建索引（file-watcher HTTP 桥 + **`localSearchReindexPlugin`**）；生产 `tn:build` 不受影响。
- 新增 **`utils/vscodePaths.ts`**：Sidebar 与文档页统一解析 VS Code 本地 README 路径。
- 首页 **`FolderTreeItems.vue`** / **`sidebarTreeHelpers.ts`**：嵌套文件夹视图，支持纯目录节点。
- **`ConfigManager.clearCache()`**：init 等场景下重新加载 `.tnotes.json`。
- 无 `.tnotes.json` 时 CLI 以默认配置启动（便于 `init-sub-repo` 在空目录执行）。

### Changed

#### Breaking — 目录与 update 流程

- **`TOC.md` canonical 格式**：目录行（无 checkbox）与笔记行（`- [x] 0001. 标题` 或 `- [ ] 0001` 简写，**无 markdown link**）分离；根级可为目录或笔记，笔记可作为父节点挂子项。
- **`pnpm tn:update` 不再维护根目录 `README.md` 中的笔记目录区**；改为规范化 `TOC.md` 并生成 `sidebar.json`（单篇笔记 README 内 `region:toc` 不变）。
- 完成笔记数量统计（`update` / `update-completed-count`）改从 **`TOC.md`** 解析；Git 历史回填时对 TOC 引入前的月份仍可读 `README.md`。
- `normalize` 不再将「含子项的父笔记」自动拆成「目录 + 重复笔记行」。
- 文件监听、重命名、note-config 增量更新均写入 **`TOC.md`**，不再改根 README 笔记行。
- 旧 TOC link 格式（`- [x] [0001. 标题](/notes/…)`）只读兼容一个版本周期；请执行 `pnpm tn:update` 规范化。

#### Breaking — 侧边栏行为

- Sidebar 新建/删除/排序直接读写 **`TOC.md`**；移除独立的「重命名目录 / 删除目录」菜单，改为 TOC 条目级重命名与级联删除。
- **`sidebarMaxDepth` 默认值 `3` → `0`（不限制嵌套层级）**；仅当在 `.tnotes.json` 显式设置 `> 0` 时启用 UI / 写入 / 拖拽深度校验。

#### 侧边栏拖拽交互（非 API breaking，体验重写）

- 中间落点仅同级排序；末行 after 显示多级导轨，支持左拖 outdent。
- inside 落点插入目标子层级**开头**（非末尾）；从文件夹外拖入、父行 after / tail 左导轨等语雀式落点语义对齐。
- 被拖项从列表隐藏（仅保留幽灵）；落点 overlay 绘制 + 命中迟滞，减少闪烁与跳动。

#### 设置面板与首页

- 新增 **「正文区域」** 页宽配置；移除 **「目录风格」**（紧凑/默认/宽松）密度选项。
- MarkMap：**分支主题**选择器移除，改由站点暗色模式驱动；保留 **「笔记内 MarkMap」** 初始展开层级。
- **`SidebarCard`** 移除首页思维导图视图，保留文件夹视图与搜索视图。

#### 组件与样式

- 新增笔记 README 正文模板集中到 **`config/templates.ts`**（`getNewNoteReadmeBody()`）。
- **Footprints**：朋友圈式图片网格（1 / 2 / 2×2 / 3 列），CSS Grid + `:deep()` 修复 Markdown `p`/`a` 包裹导致的纵向堆叠；`onContentUpdated` 后重新统计图片数。
- **MarkMap**：折叠区块 HMR 后重新挂载 toolbar；与 `markmap-dark` / 站点暗色同步。
- **Swiper**：`.swiper-container` 上下 margin 改为 `0`，与代码块/tab 更紧凑。
- 移除 `base.scss` 对代码块外层 `margin: 0 !important` 的覆盖，恢复 VitePress 相邻代码块默认间距。
- 删除笔记 API 返回 `redirectUrl` / `redirectNoteIndex`，按 TOC 顺序回退导航。

### Removed

- 设置面板 **「显示代码块行号」**、**「代码块内容自动换行」** 及对应 localStorage / `html` class 逻辑；正文代码块回退 VitePress 原生行号与布局（构建级 `lineNumbers: true` 不变）。
- 设置面板侧边栏 **目录风格**（`SIDEBAR_DENSITY_KEY`）。
- 设置面板 MarkMap **分支主题** UI（`MARKMAP_THEME_KEY`）。
- 首页思维导图视图（**`MindMapView.vue`**）及 **`icon__mindmap.svg`**。
- 根 README 笔记目录区的自动同步（`ReadmeService.updateAllReadmes` 默认 `updateHome: false`）。

### Fixed

- 文档页 / Sidebar「在 VS Code 中打开」路径 **`notes` 目录重复拼接**（`vscodePaths.ts`）。
- Sidebar 与 **`TOC.md` 不同步**：`sidebar.data.ts` 加载前重建 `sidebar.json`，TOC 变更触发 HMR。
- **`sidebarMaxDepth: 3`** 时第 3 层纯目录被 `depth < maxDepth - 1` 误截断。
- 首页文件夹视图：纯目录节点显示标题，不再空白或缺层。
- 删除当前浏览中的笔记：按 TOC 顺序回退上一篇（首项回退 `/`），展开父链并高亮；父笔记同时有 `link` 与子项时展开逻辑正确。
- Sidebar 高度：`.VPSidebar` 使用 `top + calc(100vh - nav)`，移除 `#VPSidebarNav` 多余嵌套滚动。
- 拖拽边界：外拖入折叠文件夹、紧邻同级拖入上一文件夹、tail/after 导轨语义、预览跳动等。
- dev 下笔记增删后 Local Search 服务端索引重建（浏览器侧见 Known limitations）。
- Footprints 图片布局异常（容器被撑高、无法三列网格）。

### Known limitations

- dev 下笔记新增或删除后，顶栏 Local Search **不会在浏览器内热更新**；需 **刷新页面（F5）** 后再 Ctrl+K 搜索，结果才与磁盘一致。根因：VitePress 内置搜索组件对虚拟索引模块的客户端缓存，暂无法在不 fork 组件的前提下可靠 HMR 同步。
- **`init-toc` 为过渡命令**，仅 v0.2.x 提供，v0.3.x 将移除。
- 旧 TOC link 行格式只读兼容一个版本周期，请尽快 `pnpm tn:update` 规范化。

### Migration（0.1.x → 0.2.0，TNotes.xxx 宿主仓库）

1. **升级依赖**
   ```bash
   pnpm add @tnotesjs/core@^0.2.0
   pnpm install
   ```
2. **补充 scripts**（若缺失）
   ```json
   "tn:init-toc": "tnotes --init-toc"
   ```
3. **一次性生成 `TOC.md`**（已有 v0.1.x 笔记目录的仓库）
   ```bash
   pnpm tn:init-toc
   ```
   要求根 `README.md` 含 `<!-- endregion:toc -->` 及下方笔记列表；`##` 分区变为 folder，组内笔记缩进为子项。
4. **规范化并刷新产物**
   ```bash
   pnpm tn:update
   ```
   输出 canonical `TOC.md`、`sidebar.json`、各笔记 README，以及当月 `completed_notes_count`。
5. **提交** `TOC.md`、`sidebar.json`、`.tnotes.json`（统计字段）等变更；根 `README.md` 中的笔记目录区可手动精简（`update` 不再维护）。
6. **配置检查**：若仍需深度限制，在 `.tnotes.json` 显式保留 `sidebarMaxDepth: 3`（默认已改为 `0` 不限制）。
7. **使用习惯**：目录编辑优先改 `TOC.md` 或使用 Sidebar UI；`tn:dev` 下搜笔记前需刷新页面；设置中重新确认 **正文区域** 页宽（默认超宽）。
8. **可选**：`pnpm tn:update-completed-count` 回填近 12 个月统计（TOC 引入前的月份仍读 Git 中的 `README.md`）。
9. **新建子库**：使用 `pnpm tn:init-sub-repo`，无需手动复制模板。

| 领域                               | v0.1.x                                  | v0.2.0                          |
| ---------------------------------- | --------------------------------------- | ------------------------------- |
| 目录数据源                         | 根 `README.md` `endregion:toc` 之后     | **`TOC.md`**                    |
| `tn:update` 维护根 README 笔记列表 | 是                                      | **否**                          |
| TOC 笔记行格式                     | 带 link 的 markdown 列表                | **checkbox + 编号，无 link**    |
| `sidebarMaxDepth` 默认             | `3`                                     | **`0`（不限）**                 |
| 首页 SidebarCard                   | 文件夹 + 思维导图                       | **文件夹 + 搜索**               |
| 设置面板                           | 代码块行号/换行、目录风格、MarkMap 主题 | **正文页宽** + MarkMap 展开层级 |

## [0.1.28] - 2026-06-02

### Fixed

- 修复 `updateRootItem()` 在月初无 deploy 时 `completed_notes_count` 缺失中间月份的问题，
  现在会自动补齐从最后已有月份到当前月份之间的所有缺口。

## [0.1.27] - 2026-05-31

### Fixed

- 修复 Mermaid 流程图三个渲染问题：
  - 文本截断：VitePress 全局 `line-height` 穿透 SVG foreignObject 导致
  - 容器高度固定：移除 `max-height: 600px` 与 `overflow: auto`，改为自适应
  - 拖拽不可用：全屏模式改用 CSS translate 实现自由平移 + 滚轮缩放
- 按钮组交互改为与 code block 的 `.tn-code-actions` 一致（全屏/复制按钮、hover 显隐、复制反馈）

## [0.1.26] - 2026-05-29

### Fixed

- 修复宿主仓库升级到 `@tnotesjs/core@0.1.25` 后，VitePress 在加载 `vitepress/components/tnotes-config.data.ts` 时无法解析 `../../config/defaultConfig` 的问题：现在发版包会包含该运行时依赖文件。

## [0.1.25] - 2026-05-29

### Fixed

- 修复 `pnpm tn:dev` 冷启动时侧边栏偶发显示错误、需手动删除 `.vitepress/cache` 才能恢复的问题：`DevCommand` 现在会在启动 VitePress 服务前重新生成 `sidebar.json`，消除 data loader 读到过期数据的启动窗口。

## [0.1.24] - 2026-05-08

### Fixed

- 修复宽屏布局下侧边栏没有与站点标题列对齐的问题。
- 修复隐藏侧边栏时顶部导航底部分割线左侧不连续的问题。
- 修复首页仍显示侧边栏拖拽把手的问题。
- 修复侧边栏折叠状态影响首页布局的问题。

## [0.1.23] - 2026-05-08

### Changed

- 调整正文标题（h1-h6）的上下边距为统一值 `1rem`。
- 移除正文代码块外层容器的上下边距（`margin: 0px`），使其与相邻元素贴合更紧密。

## [0.1.22] - 2026-05-04

### Changed

- 将 VitePress 组件内的 CSS Modules 样式迁移为组件内 scoped SCSS，并按组件拆分共享样式。
- 升级 `globals` 与 `typescript-eslint` 开发依赖到低风险兼容版本。

### Removed

- 移除核心主题与默认配置中的 ARIA 相关标记和 `SocialLink.ariaLabel` 配置字段。
- 移除未直接使用的 `@typescript-eslint/parser` 开发依赖。

## [0.1.21] - 2026-05-04

### Changed

- 调整正文代码块外层间距，仅移除左右 margin，保留上下间距，避免代码块与前后内容贴得过紧。

### Fixed

- 修复单行代码块因复制提示伪元素撑高容器而出现纵向滚动条的问题。

## [0.1.20] - 2026-05-04

### Fixed

- 修复笔记正文头部 TOC 锚点点击后被导航栏遮挡的问题，为标题添加 scroll-margin-top 偏移。

## [0.1.19] - 2026-05-03

### Changed

- 移除 VitePress 正文目录和 H2 折叠内容的高度过渡动画，展开态不再限制内容高度，避免长笔记内容被截断。

## [0.1.18] - 2026-04-30

### Changed

- 代码块右上角操作区改为统一自定义按钮组，复制和全屏入口使用一致的图标、间距与反馈样式，并兼容普通代码块和 code-group 代码块。

### Fixed

- 修复 VitePress 内置代码复制按钮与自定义全屏按钮重叠，以及复制成功提示遮挡全屏按钮的问题。

## [0.1.17] - 2026-04-30

### Added

- 新增侧边栏边缘拖拽控件，支持在 260px 至 480px 范围内调整宽度并本地持久化。
- 新增侧边栏边缘显示/隐藏按钮，支持 hover 显示、隐藏态常驻显示、平台化快捷键提示，以及 `Ctrl/Cmd + Opt/Alt + ,` 快捷键切换侧边栏。

### Changed

- 侧边栏显示/隐藏和宽度抽取为共享布局状态，统一同步正文工具区按钮、侧边栏边缘按钮、`hide-sidebar` class 和相关布局宽度变量。
- 移除设置面板中的内容区宽度配置与 `--tn-content-width` 固定宽度变量，正文容器改为随侧边栏当前宽度和隐藏状态自适应可用空间。
- 调整正文二级标题与折叠章节样式：缩小 H2 间距、移除 H2 顶部分隔线、将 H2 折叠按钮移至标题右侧，并优化折叠图标显隐和折叠态边框。

### Fixed

- 修复 VitePress 默认 `content-container` 最大宽度仍固定为 688px，导致侧边栏折叠或调整宽度后正文可用宽度不变化的问题。
- 修复隐藏侧边栏时布局宽度变量和横向 padding 仍保留展开状态，导致折叠后侧边栏未完全收起的问题。
- 修复新版侧边栏目录行添加图标后，聚焦当前笔记时无法读取父级目录标题，导致折叠目录无法自动展开的问题。
- 修复侧边栏边缘控件的 scoped 全局选择器误命中 `html.content-fullscreen`，导致内容全屏模式下整页不可见的问题。
- 修复内容全屏模式下本地导航栏仍可能占位显示的问题。

## [0.1.16] - 2026-04-30

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

[Unreleased]: https://github.com/tnotesjs/core/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/tnotesjs/core/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/tnotesjs/core/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/tnotesjs/core/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/tnotesjs/core/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/tnotesjs/core/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/tnotesjs/core/compare/v0.2.2...v0.3.0
[0.1.28]: https://github.com/tnotesjs/core/compare/v0.1.27...v0.1.28
[0.1.27]: https://github.com/tnotesjs/core/compare/v0.1.26...v0.1.27
[0.1.26]: https://github.com/tnotesjs/core/compare/v0.1.25...v0.1.26
[0.1.25]: https://github.com/tnotesjs/core/compare/v0.1.24...v0.1.25
[0.1.24]: https://github.com/tnotesjs/core/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/tnotesjs/core/compare/v0.1.22...v0.1.23
[0.1.19]: https://github.com/tnotesjs/core/compare/v0.1.18...v0.1.19
[0.1.18]: https://github.com/tnotesjs/core/compare/v0.1.17...v0.1.18
[0.1.17]: https://github.com/tnotesjs/core/compare/v0.1.16...v0.1.17
[0.1.16]: https://github.com/tnotesjs/core/compare/v0.1.15...v0.1.16
[0.0.6]: https://github.com/tnotesjs/core/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/tnotesjs/core/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/tnotesjs/core/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/tnotesjs/core/compare/v0.0.2...v0.0.3
[0.0.1]: https://github.com/tnotesjs/core/releases/tag/v0.0.1
