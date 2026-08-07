# CONTEXT

## 文档布局

- 根目录的 CONTEXT.md 是项目主域词汇表。
- 架构决策统一记录到 docs/adr/。

## 系统目标

@tnotesjs/core 是 TNotes.xxx 知识库体系的共享核心包。

它负责提供：

- CLI 命令入口与流程编排。
- 配置读取、默认值与模板。
- 笔记、README、目录、索引等核心处理能力。
- 带副作用的服务层能力，例如文件监听、Git、VitePress 相关服务。
- 对外发布的 VitePress 配置、主题、组件与插件源码。

## 关键术语

- TNotes.xxx 仓库：消费 @tnotesjs/core 的宿主知识库仓库。
- 核心包：当前仓库发布出的 npm 包 @tnotesjs/core。
- CLI 命令：由 commands/ 暴露的用户可执行入口，例如 dev、build、update、push。
- 配置：由 config/ 负责读取、合成、校验的配置数据与模板。
- 核心模块：core/ 下对领域对象进行管理、生成、缓存和编排的稳定抽象。
- 服务层：services/ 下带副作用、面向流程执行的服务封装。
- 文件监听：围绕文件系统事件的检测、调度、去抖、重命名识别与全局更新协调。
- VitePress 运行层：vitepress/ 下对外提供的配置、主题、组件、插件与前端数据文件。
- README 生成：根据笔记结构与统计信息生成 README 内容的能力（单篇笔记 README；根目录 README 目录区已废弃）。
- TOC.md：知识库根目录的目录数据源，纯缩进列表表达笔记层级，驱动 sidebar.json 生成。
- TOC 生成：根据内容结构生成目录信息的能力（单篇笔记 README 内 region:toc；与根目录 TOC.md 不同）。
- Note：notes/ 下的一篇笔记，表现为一个以 4 位编号开头的目录，至少包含 README.md，并通常带有 .tnotes.json。
- NoteIndex：笔记目录名前 4 位数字构成的本地编号，用于排序、目录定位与 README 链接同步。
- NoteConfig：单篇笔记的 .tnotes.json 配置，描述该笔记的稳定元数据，例如 id、done、category、外部资源链接等（不再包含创建/更新时间）。
- Config ID：NoteConfig.id，对应跨知识库唯一的 UUID，用于稳定标识一篇笔记，不等于 NoteIndex。
- TNotesConfig：仓库根目录 .tnotes.json 的配置对象，描述整个知识库站点与发布层的配置，而不是单篇笔记配置（root_item 不再包含创建/更新时间与 days_since_birth）。
- NotesConfig 不是当前仓库的稳定类型名：若讨论单篇笔记配置，应使用 NoteConfig；若讨论根配置，应使用 TNotesConfig；若讨论前端聚合后的笔记配置数据，应明确写 notesConfig.data。
- NoteManager：面向文件系统扫描与校验的低层笔记管理抽象，负责发现、验证、读取和修复笔记数据。
- NoteIndexCache：面向 dev/watch 场景的内存索引，维护 noteIndex 与 configId 到笔记配置的快速映射。
- NoteService：面向业务操作的笔记服务，封装创建、删除、查询和缓存协同，而不是直接负责全量扫描。
- ReadmeGenerator：直接改写 README 文本内容的生成器，负责单篇笔记 README 与首页 README 的具体内容更新。
- TocGenerator：专注 TOC 区域生成与标题编号更新的生成器，不负责全局 README 编排。
- ReadmeService：围绕单篇笔记 README 更新流程的高层服务；全量 update 时协调笔记 README 更新，目录同步委托 TocService。
- TocService：围绕根目录 TOC.md 的解析、规范化、CRUD 与 sidebar.json 再生成服务。
- InitTocCommand / init-toc：v0.1.x → v0.2.x 过渡命令，从根 README.md 的 `<!-- endregion:toc -->` 之后解析笔记分区并生成 TOC.md；**v0.2.x 存在，计划在 v0.3.x 移除**
- Update 命令：面向当前工作区的一次性全量维护流程，会修正笔记标题、更新各笔记 README、规范化 TOC.md，并刷新当前月份的 root_item 统计。
- UpdateCompletedCount 命令：面向历史统计的一次性维护流程，会基于 Git 历史回填最近 12 个月的 completed_notes_count。
- GlobalUpdateCoordinator：文件监听流程中的增量全局更新协调器，负责将局部配置变化传播到 TOC.md 与 sidebar。
- defineNotesConfig：对外导出的 VitePress 站点配置工厂函数，用于把共享配置、插件与约定打包给宿主仓库。
- VitePress config：vitepress/config/ 与 vitepress/configs/ 组成的站点配置层，负责生成 VitePress UserConfig 与主题配置。
- VitePress theme：vitepress/theme/ 暴露的主题入口，负责注册核心组件、布局与 dev-time rename HMR 行为。
- VitePress components：vitepress/components/ 下的前端组件与 data loader，是主题运行时消费的 UI 与数据层。
- VitePress plugins：vitepress/plugins/ 下挂到 Vite 或 VitePress 的插件扩展点，用于把宿主文件系统、开发流程与站点行为接起来。
- Local Search（dev）：顶栏 VitePress 本地搜索；笔记新增/删除后服务端会重建索引，但浏览器需**刷新页面**后再搜索才看到最新结果（见 CHANGELOG Known limitations）。
- DocAside / 正文目录区：VitePress 默认右侧栏（`VPDocAside`），从当前页 h2/h3 生成页内 outline；与左侧 CustomSidebar（TOC.md 树）及笔记内 `region:toc` 三者职责分离。
- ContentWidthMode：正文区域页宽模式，`wide`（超宽显示，默认）或 `standard`（标准 750px）；存 localStorage，由设置面板配置。

## 模块地图

- commands/：CLI 命令定义与高层流程入口。
- config/：配置管理、默认值、模板与常量。
- core/：NoteManager、ReadmeGenerator、TocGenerator 等核心能力。
- services/：文件监听、Git、note、readme、toc、vitepress 等服务实现。
- utils/：日志、文件、Markdown、参数解析、校验等通用工具。
- vitepress/：发布给消费端的前端能力与运行时源码。
- src/index.ts：公共 API 导出入口。
- index.ts：CLI 入口。

## 稳定关系

- NoteManager 负责扫描与校验磁盘上的笔记；NoteIndexCache 负责在内存中加速查找；NoteService 负责在业务操作中选择并协调这两者。
- ReadmeService 负责单篇笔记 README 更新流程编排；TocService 负责根目录 TOC.md 与 sidebar；InitTocCommand 仅用于 v0.2.x 升级迁移；ReadmeGenerator 负责具体文本改写；TocGenerator 负责单篇笔记内 TOC 与标题编号生成。
- Update 命令处理“当前状态同步”；UpdateCompletedCount 命令处理“历史统计回填”；FileWatcherService 与 GlobalUpdateCoordinator 处理 dev 阶段的增量同步（TOC.md + sidebar）。
- defineNotesConfig 负责产出站点配置与插件装配；theme/index.ts 负责运行时主题与全局组件；components/ 负责界面与前端数据消费；plugins/ 负责开发期与构建期扩展点。
- TNotesConfig 作用于整个知识库仓库；NoteConfig 作用于单篇笔记；两者的作用域与生命周期不同，不应混用。

## 使用规则

- 这里记录的是稳定领域语言，不记录临时实现细节。
- 新出现且会跨模块复用的术语，应优先写进这里，再进入代码命名。
- 当已有术语含义发生变化时，更新 CONTEXT.md 与代码应视为同一批变更。

## 当前待补充的词汇空缺

- ConfigManager 与 defineNotesConfig 在“配置读取”职责上的边界。
- Git service、GitManager、Push/Pull 命令之间的职责边界。
- VitePress data loader（如 notesConfig.data、tnotes-config.data）与运行时组件之间的稳定契约。
