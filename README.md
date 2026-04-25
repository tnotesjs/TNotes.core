# @tnotesjs/core

TNotes 知识库系统的核心框架，以 NPM 包形式发布，被所有
[TNotes.xxx](https://github.com/orgs/tnotesjs/repositories) 知识库引用。

## 简介

`@tnotesjs/core` 包含了 TNotes 知识库系统的 CLI 命令、VitePress
配置/主题、服务层、工具函数等核心代码。各 TNotes.xxx 仓库通过
`npm install @tnotesjs/core` 安装即可使用。

## 目录结构

```text
@tnotesjs/core
├── commands/           # CLI 命令（dev、build、push、update 等）
├── config/             # 配置管理（ConfigManager、默认配置、模板）
├── core/               # 核心模块（GitManager、NoteManager、ReadmeGenerator 等）
├── services/           # 服务层（file-watcher、git、note、readme、vitepress 等）
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数（日志、文件操作、Markdown 解析、校验等）
├── vitepress/          # VitePress 主题、组件、插件、样式
│   ├── components/     # 自定义 Vue 组件
│   ├── config/         # VitePress 配置（defineNotesConfig）
│   ├── plugins/        # VitePress 插件
│   └── theme/          # 主题入口与样式
├── index.ts            # CLI 入口
└── src/index.ts        # 公共 API 导出
```

## 安装

```bash
# 安装核心包
pnpm add @tnotesjs/core

# 安装 peerDependencies
pnpm add -D vite vitepress vue
```

## 使用方式

### VitePress 配置

```ts
// .vitepress/config.mts
import { defineNotesConfig } from '@tnotesjs/core/vitepress/config'
export default defineNotesConfig()
```

### VitePress 主题

```ts
// .vitepress/theme/index.ts
export { default } from '@tnotesjs/core/vitepress/theme'
```

### CLI 命令

在 `package.json` 中配置脚本：

```json
{
  "scripts": {
    "tn:dev": "tnotes --dev",
    "tn:build": "tnotes --build",
    "tn:preview": "tnotes --preview",
    "tn:update": "tnotes --update",
    "tn:push": "tnotes --push",
    "tn:pull": "tnotes --pull",
    "tn:create-notes": "tnotes --create-notes",
    "tn:fix-timestamps": "tnotes --fix-timestamps",
    "tn:help": "tnotes --help"
  }
}
```

## 版本管理

- 版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)
- 变更记录见 [CHANGELOG.md](./CHANGELOG.md)
- 发布：`npm publish --access public`
- 每个版本通过 Git Tag 标记（如 `v1.0.0`）

## 许可证

MIT
