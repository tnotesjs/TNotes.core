# TNotes.core

TNotes 知识库系统的核心共享脚本，通过 Git Submodule 被所有 [TNotes.xxx](https://github.com/orgs/tnotesjs/repositories) 知识库引用。

## 简介

TNotes.core 包含了 TNotes 知识库系统的 CLI 命令、VitePress 主题/插件、服务层、工具函数等核心代码。各 TNotes.xxx 仓库不再各自拷贝脚本，而是统一以 Git Submodule 的形式引用本仓库，挂载到 `.vitepress/tnotes/` 路径下。

## 目录结构

```
TNotes.core/
├── commands/           # CLI 命令（dev、build、push、update 等）
├── config/             # 配置管理（ConfigManager、默认配置、模板）
├── core/               # 核心模块（GitManager、NoteManager、ReadmeGenerator 等）
├── services/           # 服务层（file-watcher、git、note、readme、vitepress 等）
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数（日志、文件操作、Markdown 解析、校验等）
├── vitepress/          # VitePress 主题、组件、插件、样式
│   ├── components/     # 自定义 Vue 组件
│   ├── configs/        # VitePress 配置
│   ├── plugins/        # VitePress 插件
│   └── theme/          # 主题入口与样式
└── index.ts            # 入口文件
```

## 使用方式

### 在现有 TNotes.xxx 仓库中添加

```bash
# 1. 删除旧的脚本目录
rm -rf .vitepress/tnotes

# 2. 添加 submodule
git submodule add https://github.com/tnotesjs/TNotes.core.git .vitepress/tnotes

# 3. 提交变更
git add .gitmodules .vitepress/tnotes
git commit -m "chore: migrate to TNotes.core submodule"
```

### 克隆含 submodule 的仓库

```bash
# 方式一：克隆时一并拉取
git clone --recurse-submodules https://github.com/tnotesjs/TNotes.xxx.git

# 方式二：克隆后手动初始化
git clone https://github.com/tnotesjs/TNotes.xxx.git
cd TNotes.xxx
git submodule update --init
```

### 更新 submodule 到最新版本

```bash
cd .vitepress/tnotes
git pull origin main
cd ../..
git add .vitepress/tnotes
git commit -m "chore: update TNotes.core"
```

## 开发工作流

你可以在任意 TNotes.xxx 仓库中直接编辑 `.vitepress/tnotes/` 下的文件，改动会即时生效（VitePress HMR）。编辑完成后：

```bash
# 1. 在 submodule 内提交并推送
cd .vitepress/tnotes
git add -A && git commit -m "feat: your change" && git push

# 2. 回到父仓库，更新 submodule 指针
cd ../..
git add .vitepress/tnotes && git commit -m "chore: update TNotes.core"
```

其它 TNotes.xxx 仓库要同步这次改动：

```bash
cd .vitepress/tnotes && git pull origin main && cd ../..
git add .vitepress/tnotes && git commit -m "chore: update TNotes.core"
```

## CI/CD

各仓库的 GitHub Actions 部署工作流（`deploy.yml`）需要在 checkout 步骤中启用 submodule 拉取：

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
    submodules: true
```

## 版本管理

- 版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)
- 变更记录见 [CHANGELOG.md](./CHANGELOG.md)
- 每个版本通过 Git Tag 标记（如 `v1.0.0`）

## 许可证

MIT
