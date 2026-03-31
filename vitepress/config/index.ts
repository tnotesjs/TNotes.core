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
import type { TNotesConfig } from '../../types'
import {
  getIgnoreList,
  getGithubPageUrl,
  getHeadConfig,
  getMarkdownConfig,
  getThemeConfig,
} from '../configs'
import { updateConfigPlugin } from '../plugins/updateConfigPlugin'
import { renameNotePlugin } from '../plugins/renameNotePlugin'
import { getNoteByConfigIdPlugin } from '../plugins/getNoteByConfigIdPlugin'
import { buildProgressPlugin } from '../plugins/buildProgressPlugin'

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
        getNoteByConfigIdPlugin() as any,
        ...(overrideVite?.plugins || []),
      ],
      server: {
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
      if (/^notes\/\d{4}/.test(pageData.relativePath)) {
        const fullPath = path.resolve(rootPath, pageData.relativePath)
        try {
          pageData.frontmatter.rawContent = fs.readFileSync(fullPath, 'utf-8')
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
