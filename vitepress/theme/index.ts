/**
 * theme/index.ts
 *
 * 自定义主题
 *
 * 提供两种使用方式：
 * 1. defineNotesTheme() 工厂函数（推荐）
 * 2. export default（向后兼容）
 *
 * doc:
 * v1 - https://vuejs.github.io/vitepress/v1/zh/guide/custom-theme
 * v2 - https://vitepress.dev/zh/guide/custom-theme
 */

import DefaultTheme from 'vitepress/theme'
import { BilibiliVideo, WordList, Mermaid, Mindmap, Footprints } from '@tnotesjs/ui'
import { initTnotesSearchIndexHmr } from '../client/localSearchIndexBridge'
import Discussions from '../components/Discussions/Discussions.vue'
import { useRenameOverlay } from '../components/Layout/composables/useRenameOverlay'
import { redirectAfterRename } from '../components/Layout/composables/useRenameRedirect'
import Layout from '../components/Layout/Layout.vue'
import NotesTable from '../components/NotesTable/NotesTable.vue'
import SidebarCard from '../components/SidebarCard/SidebarCard.vue'
import Tooltip from '../components/Tooltip/Tooltip.vue'


import type { Theme, EnhanceAppContext } from 'vitepress'
import '@tnotesjs/ui/styles/tokens.css'
import './styles/index.scss'

/**
 * 注册 TNotes 核心全局组件
 */
function registerCoreComponents(ctx: EnhanceAppContext) {
  const { app } = ctx
  app.component('BilibiliVideo', BilibiliVideo)
  // Legacy full tag until knowledge-base migration; short aliases B/E/N/F are removed.
  app.component('BilibiliOutsidePlayer', BilibiliVideo)
  app.component('WordList', WordList)
  app.component('EnWordList', WordList)
  app.component('Discussions', Discussions)
  app.component('Footprints', Footprints)
  app.component('SidebarCard', SidebarCard)
  app.component('Mindmap', Mindmap)
  app.component('MindmapPreview', Mindmap)
  app.component('Mermaid', Mermaid)
  app.component('NotesTable', NotesTable)
  app.component('Tooltip', Tooltip)
}

/**
 * 在 dev server 中监听文件夹直接重命名事件，
 * 当当前页面路径属于被重命名的文件夹时，自动跳转到新 URL。
 */
function registerRenameHmrListener() {
  if (typeof window === 'undefined') return
  if (typeof import.meta.hot === 'undefined' || !import.meta.hot) return

  const overlay = useRenameOverlay()
  let handling = false

  import.meta.hot.on(
    'tnotes:note-renamed',
    async (payload: {
      oldFolder?: string
      newFolder?: string
      noteIndex?: string
    }) => {
      if (handling) return
      if (!payload?.oldFolder || !payload?.newFolder) return

      const oldSegment = encodeURIComponent(payload.oldFolder)
      if (!window.location.pathname.includes(oldSegment)) return

      handling = true
      overlay.show({ message: '检测到文件夹重命名', tip: '正在跳转到新地址...' })

      try {
        await redirectAfterRename(
          `notes/${encodeURIComponent(payload.newFolder)}/README`,
        )
      } finally {
        handling = false
      }
    },
  )
}

function registerSearchIndexHmrListener() {
  initTnotesSearchIndexHmr()
}

/**
 * 覆盖选项
 */
interface NotesThemeOverrides {
  /** 覆盖 Layout 组件 */
  Layout?: Theme['Layout']
  /** 追加的 enhanceApp 逻辑（在核心组件注册之后调用） */
  enhanceApp?: Theme['enhanceApp']
}

/**
 * 创建 TNotes 主题配置
 *
 * @param overrides - 可选的覆盖选项
 * @returns VitePress 主题对象
 *
 * @example
 * // .vitepress/theme/index.ts
 * import { defineNotesTheme } from '../tnotes/vitepress/theme'
 * export default defineNotesTheme()
 */
export function defineNotesTheme(overrides: NotesThemeOverrides = {}): Theme {
  return {
    extends: DefaultTheme,
    Layout: overrides.Layout ?? Layout,
    enhanceApp(ctx) {
      registerCoreComponents(ctx)
      registerRenameHmrListener()
      registerSearchIndexHmrListener()
      overrides.enhanceApp?.(ctx)
    },
  }
}

/**
 * 默认导出（向后兼容旧版 re-export 方式）
 */
export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp(ctx: EnhanceAppContext) {
    registerCoreComponents(ctx)
    registerRenameHmrListener()
    registerSearchIndexHmrListener()
  },
} satisfies Theme
