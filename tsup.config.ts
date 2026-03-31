import { defineConfig } from 'tsup'

/**
 * tsup 构建配置
 *
 * CLI 和 VitePress Config 需要预编译为 JS（Node.js 运行时加载）。
 * VitePress Theme 和组件以源码形式发布（由 Vite 在宿主仓库中处理）。
 */
export default defineConfig({
  entry: {
    'cli/index': 'index.ts',
    index: 'src/index.ts',
    'vitepress/config/index': 'vitepress/config/index.ts',
  },
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  splitting: true,
  clean: true,
  dts: false,
  outDir: 'dist',
  // 外部依赖不打包
  external: [
    'vitepress',
    'vue',
    'vite',
    // Node.js built-ins
    /^node:/,
  ],
  banner: {
    // CLI 入口添加 shebang
    js: '#!/usr/bin/env node',
  },
  esbuildOptions(options, context) {
    // 只给 CLI 入口加 shebang，其他入口不加
    const entryPoints = (context as Record<string, unknown>).entryPoints
    const entryStr = entryPoints?.toString() ?? ''
    if (
      !entryStr.includes('index.ts') ||
      entryStr.includes('src/index.ts') ||
      entryStr.includes('vitepress/config')
    ) {
      options.banner = { js: '' }
    }
  },
})
