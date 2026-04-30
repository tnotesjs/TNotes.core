/**
 * .vitepress/tnotes/vitepress/config/index.ts
 *
 * VitePress 站点配置工厂函数
 *
 * 将所有共享配置封装在 tnotesjs/core 中，外围 config.mts 只需一行调用：
 *   import { defineNotesConfig } from './tnotes/vitepress/config'
 *   export default defineNotesConfig()
 */
import fs from 'fs'
import path from 'path'
import { defineConfig, type UserConfig } from 'vitepress'

import {
  getIgnoreList,
  getGithubPageUrl,
  getHeadConfig,
  getMarkdownConfig,
  getThemeConfig,
} from '../configs'
import { buildProgressPlugin } from '../plugins/buildProgressPlugin'
import { fileWatcherBridgePlugin } from '../plugins/fileWatcherBridgePlugin'
import { getNoteByConfigIdPlugin } from '../plugins/getNoteByConfigIdPlugin'
import { renameNotePlugin } from '../plugins/renameNotePlugin'
import { sidebarStructurePlugin } from '../plugins/sidebarStructurePlugin'
import { updateConfigPlugin } from '../plugins/updateConfigPlugin'

import type { TNotesConfig } from '../../types'

/**
 * 读取 .tnotes.json 配置文件
 */
function loadTNotesConfig(rootPath: string): TNotesConfig {
  const configPath = path.resolve(rootPath, '.tnotes.json')
  const configContent = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(configContent) as TNotesConfig
}

/**
 * 创建 VitePress 站点配置
 *
 * @param overrides - 可选的覆盖配置，会与默认配置合并
 * @returns VitePress 配置对象
 */
export function defineNotesConfig(overrides: UserConfig = {}) {
  const rootPath = process.cwd()
  const config = loadTNotesConfig(rootPath)
  const { repoName } = config

  const IGNORE_LIST = getIgnoreList(config)
  const GITHUB_PAGE_URL = getGithubPageUrl(config)

  const {
    transformPageData: overrideTransformPageData,
    vite: overrideVite,
    ...restOverrides
  } = overrides

  return defineConfig({
    appearance: 'dark',
    base: '/' + repoName + '/',
    cleanUrls: true,
    description: repoName,
    head: getHeadConfig(config, GITHUB_PAGE_URL),
    ignoreDeadLinks: true,
    lang: 'zh-Hans',
    lastUpdated: false,
    markdown: getMarkdownConfig(),
    sitemap: {
      hostname: GITHUB_PAGE_URL,
      lastmodDateOnly: false,
    },
    themeConfig: getThemeConfig(config),
    title: repoName,
    srcExclude: IGNORE_LIST,
    vite: {
      plugins: [
        buildProgressPlugin() as any,
        updateConfigPlugin() as any,
        renameNotePlugin() as any,
        sidebarStructurePlugin() as any,
        getNoteByConfigIdPlugin() as any,
        fileWatcherBridgePlugin() as any,
        ...(overrideVite?.plugins || []),
      ],
      server: {
        // 显式同时监听 IPv4 / IPv6，避免 Node 18+ 在 Windows 下偶发只绑定 ::1
        // 导致 Chrome 解析 localhost → 127.0.0.1 时连接被拒、页面一直 pending。
        // host: true,
        watch: {
          ignored: IGNORE_LIST,
        },
        ...overrideVite?.server,
      },
      css: {
        preprocessorOptions: {
          scss: {
            silenceDeprecations: ['legacy-js-api'],
          },
        },
        ...overrideVite?.css,
      },
      build: {
        chunkSizeWarningLimit: 1000,
        ...overrideVite?.build,
      },
      define: {
        __TNOTES_REPO_NAME__: JSON.stringify(config.repoName),
        __TNOTES_AUTHOR__: JSON.stringify(config.author),
        __TNOTES_IGNORE_DIRS__: JSON.stringify(config.ignore_dirs),
        __TNOTES_ROOT_ITEM__: JSON.stringify(config.root_item),
        ...overrideVite?.define,
      },
      resolve: {
        dedupe: ['vue', 'vitepress'],
        ...overrideVite?.resolve,
      },
      optimizeDeps: {
        include: [
          // VitePress 内部 CJS 依赖 —— 需要 Vite 预构建为 ESM
          'vitepress > @vscode/markdown-it-katex',
          'vitepress > @braintree/sanitize-url',
          'vitepress > dayjs',
          'vitepress > dayjs/plugin/utc',
          'vitepress > dayjs/plugin/localizedFormat',
        ],
        ...overrideVite?.optimizeDeps,
      },
    },
    transformPageData(pageData, ctx) {
      // 为笔记页面注入原始 Markdown 内容（用于一键复制功能）
      //
      // 这里的 rawContent 会被 VitePress 序列化进 SFC 的
      // `<script>export const __pageData = JSON.parse("...")</script>` 块。
      // 如果直接写入原文，原文中的 `<script>` / `</script>` 字面量会被两
      // 类规则误命中：
      //   1. HTML 解析器看到 `</script` 就提前闭合脚本块，触发
      //      "Invalid end tag"。
      //   2. VitePress 内部还会用
      //      `scriptClientRE = /<script\b[^>]*client\b[^>]*>([^]*?)<\/script>/`
      //      在整段 vueSrc 上扫一遍，匹配到原文里的 `<script src="/client.js">`
      //      之类开标签后会一路吞到真正的 `</script>`。
      //
      // 与其针对每条规则各自做转义（耦合 VitePress 内部实现细节），
      // 不如直接对原文做 base64 编码：base64 字符集仅 `[A-Za-z0-9+/=]`，
      // 不包含 `<` `>`，可彻底规避任何 HTML/正则误匹配。
      // 前端消费时使用 `atob` + `TextDecoder('utf-8')` 还原原文。
      if (/^notes\/\d{4}/.test(pageData.relativePath)) {
        const fullPath = path.resolve(rootPath, pageData.relativePath)
        try {
          const raw = fs.readFileSync(fullPath, 'utf-8')
          pageData.frontmatter.rawContent = Buffer.from(raw, 'utf-8').toString(
            'base64',
          )
        } catch {
          pageData.frontmatter.rawContent = null
        }
      }
      // 执行外部覆盖的 transformPageData（如有）
      if (typeof overrideTransformPageData === 'function') {
        return overrideTransformPageData(pageData, ctx)
      }
    },
    router: {
      prefetchLinks: false,
    },
    ...restOverrides,
  })
}
