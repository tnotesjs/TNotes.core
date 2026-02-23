/**
 * .vitepress/tnotes/vitepress/config/index.ts
 *
 * VitePress 站点配置工厂函数
 *
 * 将所有共享配置封装在 TNotes.core 中，外围 config.mts 只需一行调用：
 *   import { defineNotesConfig } from './tnotes/vitepress/config'
 *   export default defineNotesConfig()
 */
import fs from 'fs'
import path from 'path'
import { defineConfig, type UserConfig } from 'vitepress'
import { repoName } from '../../../../.tnotes.json'
import {
  IGNORE_LIST,
  GITHUB_PAGE_URL,
  getHeadConfig,
  getMarkdownConfig,
  getThemeConfig,
} from '../configs'
import { updateConfigPlugin } from '../plugins/updateConfigPlugin'
import { renameNotePlugin } from '../plugins/renameNotePlugin'
import { getNoteByConfigIdPlugin } from '../plugins/getNoteByConfigIdPlugin'
import { buildProgressPlugin } from '../plugins/buildProgressPlugin'

/**
 * 创建 VitePress 站点配置
 *
 * @param overrides - 可选的覆盖配置，会与默认配置合并
 * @returns VitePress 配置对象
 */
export function defineNotesConfig(overrides: UserConfig = {}) {
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
    head: getHeadConfig(),
    ignoreDeadLinks: true,
    lang: 'zh-Hans',
    lastUpdated: false,
    markdown: getMarkdownConfig(),
    sitemap: {
      hostname: GITHUB_PAGE_URL,
      lastmodDateOnly: false,
    },
    themeConfig: getThemeConfig(),
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
    },
    transformPageData(pageData, ctx) {
      // 为笔记页面注入原始 Markdown 内容（用于一键复制功能）
      if (/^notes\/\d{4}/.test(pageData.relativePath)) {
        const fullPath = path.resolve(__dirname, '../../../../', pageData.relativePath)
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
