/**
 * vitepress/components/sidebar.data.ts
 */

import fs from 'node:fs'
import path from 'node:path'

import { ROOT_DIR_PATH } from '../../config/constants'
import { createWorkspace } from '../../workspace'

const rootPath = ROOT_DIR_PATH
const sidebarFilePath = path.resolve(rootPath, 'sidebar.json')
const tocFilePath = path.resolve(rootPath, 'TOC.md')

const workspace = createWorkspace({ rootPath })

/**
 * VitePress Data Loader for Sidebar
 * 以 TOC.md 为唯一数据源，加载前用 Workspace 对齐（files→TOC）重建 sidebar.json，
 * 并监听 TOC/sidebar 变化做 HMR
 */

interface SidebarItem {
  text: string
  link: string
}

interface SidebarGroup {
  text: string
  link?: string
  collapsed?: boolean
  items?: SidebarItem[]
}

interface SidebarConfig {
  '/notes/': SidebarGroup[]
}

export default {
  watch: [sidebarFilePath, tocFilePath],

  async load(): Promise<SidebarConfig> {
    try {
      await workspace.toc.reconcileFromFiles()

      const fileContent = fs.readFileSync(sidebarFilePath, 'utf-8')
      const sidebarArray = JSON.parse(fileContent) as SidebarGroup[]

      const sidebarData: SidebarConfig = {
        '/notes/': sidebarArray,
      }

      console.log('[sidebar.data.ts] Sidebar loaded from TOC.md')

      return sidebarData
    } catch (error) {
      console.error('❌ [sidebar.data.ts] Failed to load sidebar.json:', error)

      return {
        '/notes/': [],
      }
    }
  },
}
