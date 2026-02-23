/**
 * .vitepress/tnotes/theme/index.ts
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

import type { Theme, EnhanceAppContext } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import BilibiliOutsidePlayer from '../components/BilibiliOutsidePlayer/BilibiliOutsidePlayer.vue'
import Discussions from '../components/Discussions/Discussions.vue'
import EnWordList from '../components/EnWordList/EnWordList.vue'
import Footprints from '../components/Footprints/Footprints.vue'
import Layout from '../components/Layout/Layout.vue'
import LoadingPage from '../components/LoadingPage/LoadingPage.vue'
import MarkMap from '../components/MarkMap/MarkMap.vue'
import Mermaid from '../components/Mermaid/Mermaid.vue'
import NotesTable from '../components/NotesTable/NotesTable.vue'
import Settings from '../components/Settings/Settings.vue'
import SidebarCard from '../components/SidebarCard/SidebarCard.vue'
import Tooltip from '../components/Tooltip/Tooltip.vue'
import './styles/index.scss'

/**
 * 注册 TNotes 核心全局组件
 */
function registerCoreComponents(ctx: EnhanceAppContext) {
  const { app } = ctx
  app.component('BilibiliOutsidePlayer', BilibiliOutsidePlayer)
  app.component('B', BilibiliOutsidePlayer)
  app.component('Discussions', Discussions)
  app.component('EnWordList', EnWordList)
  app.component('E', EnWordList)
  app.component('Footprints', Footprints)
  app.component('F', Footprints)
  app.component('LoadingPage', LoadingPage)
  app.component('Settings', Settings)
  app.component('S', Settings)
  app.component('SidebarCard', SidebarCard)
  app.component('MarkMap', MarkMap)
  app.component('Mermaid', Mermaid)
  app.component('NotesTable', NotesTable)
  app.component('N', NotesTable)
  app.component('Tooltip', Tooltip)
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
  },
} satisfies Theme
