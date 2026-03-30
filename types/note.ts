/**
 * .vitepress/tnotes/types/note.ts
 *
 * 笔记相关类型定义
 */

/**
 * 笔记的 .tnotes.json 配置类型
 */
export interface NoteConfig {
  id: string
  bilibili: string[]
  tnotes: string[]
  yuque: string[]
  done: boolean
  category?: string
  enableDiscussions: boolean
  description?: string // 笔记简介(一句话描述)
  created_at: number
  updated_at: number
}

/**
 * 笔记信息
 */
export interface NoteInfo {
  index: string
  path: string
  dirName: string
  readmePath: string
  configPath: string
  config?: NoteConfig
}
