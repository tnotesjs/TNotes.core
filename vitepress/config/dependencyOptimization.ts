export const DEFAULT_OPTIMIZE_DEPS_INCLUDE = [
  // VitePress 内部 CJS 依赖 —— 需要 Vite 预构建为 ESM
  'vitepress > @vscode/markdown-it-katex',
  'vitepress > @braintree/sanitize-url',
  'vitepress > dayjs',
  'vitepress > dayjs/plugin/utc',
  'vitepress > dayjs/plugin/localizedFormat',
  // Mermaid 11 的 ESM chunk 默认导入 CommonJS fastdom。pnpm 的严格
  // 依赖布局下 Vite 无法从知识库根目录自动发现这条嵌套依赖，开发
  // 模式会直接把 fastdom.js 当作 ESM 加载并导致整页白屏。
  '@tnotesjs/core > mermaid > fastdom',
] as const
