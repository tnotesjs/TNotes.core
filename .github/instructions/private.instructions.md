---
name: "TNotes Core Private Rules"
description: "Use when working in @tnotesjs/core source, CLI commands, services, config, utilities, package exports, or VitePress theme/config code. Covers project-specific boundaries, package contracts, build constraints, and validation commands."
applyTo:
  - "index.ts"
  - "src/**"
  - "commands/**"
  - "config/**"
  - "core/**"
  - "services/**"
  - "types/**"
  - "utils/**"
  - "vitepress/**"
  - "scripts/**"
  - "package.json"
  - "tsup.config.ts"
  - "tsconfig.build.json"
  - "CHANGELOG.md"
---
# TNotes Core 私有规则

这些规则只描述 `@tnotesjs/core` 当前仓库独有的约束，不重复通用工作流或通用前端规则。

- 这是供各 `TNotes.xxx` 知识库消费的核心 npm 包。修改配置、类型、导出、CLI 参数或生成产物结构时，要优先考虑宿主仓库升级后是否需要改代码适配。
- 源码为 TypeScript + ESM，运行目标是 Node.js 18+。不要引入 CommonJS 专属写法，也不要让需要被 Node 直接加载的入口依赖浏览器环境。
- `tsup` 只预编译 CLI 入口、公共 API 入口和 VitePress config 入口；`vitepress/theme`、组件、插件和样式以源码形式发布给宿主仓库的 Vite 处理。
- `vite`、`vitepress`、`vue` 必须保持在 `peerDependencies`，不要移动到 `dependencies`。新增依赖前确认它是否真的属于核心包运行时依赖，避免把宿主侧可选能力变成强耦合。
- `src/index.ts` 和 `package.json` 的 `exports` 是公共 API 边界。不要顺手导出内部实现；新增公开能力时同步检查类型导出、构建入口和消费路径。
- CLI 命令放在 `commands/<domain>/`，命令名和注册逻辑集中在 `commands/registry.ts` 与相关模型类型中。新增或改名命令时，同步检查帮助信息、参数解析和 README 中的脚本示例。
- `core/` 放跨服务复用的管理器和生成器，`services/` 放面向具体工作流的服务编排，`utils/` 放低耦合工具函数。不要把带副作用的业务流程塞进通用工具层。
- `config/` 与 `types/` 代表宿主仓库可感知的配置契约。调整默认配置、模板或类型字段时，要同时检查 `ConfigManager`、默认模板、文档示例和相关服务读取逻辑。
- `vitepress/**` 代码会在宿主 VitePress 环境中运行。Vue 组件和 composable 需要兼顾 SSR，浏览器 API 应放在生命周期或显式环境判断之后。
- 涉及 Markdown、README、目录、时间戳、笔记索引等生成逻辑时，优先复用已有解析器和 helper，避免用脆弱的字符串拼接改写结构化内容。
- 用户可见行为、配置契约、CLI 行为或发布包内容发生变化时，先写入 `CHANGELOG.md` 的 `[Unreleased]`；版本号仍由 `pnpm release ...` 脚本维护。
- TypeScript 或 Vue 改动至少运行 `pnpm build:check`；涉及 VitePress 组件类型时优先运行 `pnpm exec vue-tsc -p tsconfig.build.json --noEmit`；涉及代码风格或导入顺序时运行 `pnpm lint`。
