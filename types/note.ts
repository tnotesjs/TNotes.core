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
 * 笔记数量统计结果
 */
export interface NoteCountResult {
  /** 去重前的笔记目录总数 */
  total: number
  /** 去重后的笔记数量（唯一编号数量） */
  unique: number
  /** 存在编号冲突的笔记列表 */
  conflicts: Array<{ index: string; dirNames: string[] }>
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
