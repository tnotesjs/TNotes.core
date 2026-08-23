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
    'workspace/index': 'workspace/index.ts',
    'markdown/index': 'markdown/index.ts',
    'vitepress/config/index': 'vitepress/config/index.ts',
  },
  format: ['esm', 'cjs'],
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' }
  },
  target: 'node18',
  platform: 'node',
  splitting: true,
  clean: true,
  dts: true,
  outDir: 'dist',
  // 外部依赖不打包
  external: [
    'vitepress',
    'vue',
    'vite',
    // Node.js built-ins
    /^node:/,
  ],
  // shebang 不能通过 banner 加（splitting 模式下会给所有 chunk 加），
  // 改为构建后只给 CLI 入口补上
  async onSuccess() {
    const { readFileSync, writeFileSync } = await import('fs')
    const cliPath = 'dist/cli/index.js'
    const content = readFileSync(cliPath, 'utf-8')
    if (!content.startsWith('#!')) {
      writeFileSync(cliPath, '#!/usr/bin/env node\n' + content)
    }
  },
})
