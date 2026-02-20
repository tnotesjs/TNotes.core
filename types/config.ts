/**
 * .vitepress/tnotes/types/config.ts
 *
 * 配置相关类型定义
 */

/**
 * 知识库的 .tnotes.json 配置文件类型
 */
export interface TNotesConfig {
  id?: string
  author: string
  ignore_dirs: string[]
  repoName: string
  keywords: string[]
  socialLinks: SocialLink[]
  menuItems: MenuItem[]
  sidebarShowNoteId: boolean
  port?: number
  packageManager?: 'pnpm' | 'npm' | 'yarn'
  root_item: RootItem
}

/**
 * 图标配置
 */
interface IconConfig {
  svg?: string
  src?: string
}

/**
 * 社交链接类型
 */
interface SocialLink {
  ariaLabel?: string
  icon: string | IconConfig
  link: string
}

/**
 * 菜单项类型
 */
interface MenuItem {
  text: string
  link: string
}

/**
 * 根项目配置
 */
interface RootItem {
  icon?: IconConfig
  title: string
  completed_notes_count: Record<string, number>
  details: string
  link: string
  created_at: number
  updated_at: number
  days_since_birth: number
}
