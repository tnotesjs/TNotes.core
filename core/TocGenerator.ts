/**
 * .vitepress/tnotes/core/TocGenerator.ts
 *
 * 目录生成器 - 负责生成各种目录（TOC）
 */
import { EOL } from '../config/constants'
import {
  generateToc as generateTocUtil,
  createAddNumberToTitle,
} from '../utils'

import type { NoteConfig } from '../types'

// URL 常量
const BILIBILI_VIDEO_BASE_URL = 'https://www.bilibili.com/video/'
const TNOTES_YUQUE_BASE_URL = 'https://www.yuque.com/tdahuyou/tnotes.yuque/'

// 目录开始和结束标记
const NOTES_TOC_START_TAG = '<!-- region:toc -->'
const NOTES_TOC_END_TAG = '<!-- endregion:toc -->'

/**
 * 目录生成器类
 */
export class TocGenerator {
  /**
   * 更新笔记目录
   * @param noteIndex - 笔记索引
   * @param lines - 笔记内容行数组
   * @param noteConfig - 笔记配置
   * @param repoName - 仓库名称
   */
  updateNoteToc(
    noteIndex: string,
    lines: string[],
    noteConfig: NoteConfig,
    repoName: string,
  ): void {
    let startLineIdx = -1,
      endLineIdx = -1
    lines.forEach((line, idx) => {
      if (line.startsWith(NOTES_TOC_START_TAG)) startLineIdx = idx
      if (line.startsWith(NOTES_TOC_END_TAG)) endLineIdx = idx
    })
    if (startLineIdx === -1 || endLineIdx === -1) return

    const titles: string[] = []
    const numberedHeaders = ['## ', '### '] // 2~3 级标题需要编号
    const unnumberedHeaders = ['#### ', '##### ', '###### '] // 4~6 级标题不需要编号
    const addNumberToTitle = createAddNumberToTitle()

    // 代码块检测状态
    let inCodeBlock = false
    let inHtmlComment = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 检测代码块边界（``` 或 ~~~）
      if (line.trim().startsWith('```') || line.trim().startsWith('~~~')) {
        inCodeBlock = !inCodeBlock
        continue
      }

      // 检测 HTML 注释边界
      if (line.trim().startsWith('<!--')) {
        inHtmlComment = true
      }
      if (line.trim().includes('-->')) {
        inHtmlComment = false
        continue
      }

      // 跳过代码块和 HTML 注释内的内容
      if (inCodeBlock || inHtmlComment) {
        continue
      }

      // 检查是否是需要编号的标题（2~3 级）
      const isNumberedHeader = numberedHeaders.some((header) =>
        line.startsWith(header),
      )
      // 检查是否是不需要编号的标题（4~6 级）
      const isUnnumberedHeader = unnumberedHeaders.some((header) =>
        line.startsWith(header),
      )

      if (isNumberedHeader) {
        const [numberedTitle] = addNumberToTitle(line)
        titles.push(numberedTitle)
        lines[i] = numberedTitle // 更新原行内容（添加编号）
      } else if (isUnnumberedHeader) {
        // 移除可能存在的旧编号
        const match = line.match(/^(#+)\s*(\d+(\.\d+)*\.\s*)?(.*)/)
        if (match) {
          const headerSymbol = match[1]
          const plainTitle = match[4]
          const cleanTitle = `${headerSymbol} ${plainTitle}`
          titles.push(cleanTitle)
          lines[i] = cleanTitle // 更新原行内容（移除编号）
        } else {
          titles.push(line)
        }
      }
    }

    const toc = generateTocUtil(titles)
    const bilibiliTOCItems: string[] = []
    const tnotesTOCItems: string[] = []
    const yuqueTOCItems: string[] = []

    if (noteConfig) {
      if (noteConfig.bilibili.length > 0) {
        noteConfig.bilibili.forEach((bvid, i) => {
          bilibiliTOCItems.push(
            `  - [bilibili.${repoName}.${noteIndex}.${i + 1}](${
              BILIBILI_VIDEO_BASE_URL + bvid
            })`,
          )
        })
      }
      if (noteConfig.tnotes && noteConfig.tnotes.length > 0) {
        // 生成相关知识库标题和链接列表
        tnotesTOCItems.push(
          `- [📒 TNotes（相关知识库）](https://tnotesjs.github.io/TNotes/)`,
        )
        noteConfig.tnotes.forEach((repoName) => {
          tnotesTOCItems.push(
            `  - [TNotes.${repoName}](https://tnotesjs.github.io/TNotes.${repoName}/)`,
          )
        })
      }
      if (noteConfig.yuque.length > 0) {
        noteConfig.yuque.forEach((slug) => {
          yuqueTOCItems.push(
            `  - [TNotes.yuque.${repoName.replace(
              'TNotes.',
              '',
            )}.${noteIndex}](${TNOTES_YUQUE_BASE_URL + slug})`,
          )
        })
      }
    }

    const insertTocItems: string[] = []
    const hasExternalResources =
      bilibiliTOCItems.length > 0 ||
      tnotesTOCItems.length > 0 ||
      yuqueTOCItems.length > 0

    if (hasExternalResources) {
      insertTocItems.push('::: details 📚 相关资源', '')

      if (bilibiliTOCItems.length > 0) {
        insertTocItems.push(
          `- [📺 bilibili（笔记视频资源）](https://space.bilibili.com/407241004)`,
          ...bilibiliTOCItems,
        )
      }

      if (tnotesTOCItems.length > 0) {
        insertTocItems.push(...tnotesTOCItems)
      }

      if (yuqueTOCItems.length > 0) {
        insertTocItems.push(
          `- [📂 TNotes.yuque（笔记附件资源）](${TNOTES_YUQUE_BASE_URL})`,
          ...yuqueTOCItems,
        )
      }

      insertTocItems.push('', ':::', '')
    }

    lines.splice(
      startLineIdx + 1,
      endLineIdx - startLineIdx - 1,
      '',
      ...insertTocItems,
      ...toc.replace(new RegExp(`^${EOL}`), '').split(EOL),
    )
  }

  /**
   * 更新首页目录
   * @param lines - 首页内容行数组
   * @param titles - 标题数组
  * @param _titlesNotesCount - 每个标题下的笔记数量
   */
  updateHomeToc(
    lines: string[],
    titles: string[],
    _titlesNotesCount: number[],
  ): void {
    let startLineIdx = -1,
      endLineIdx = -1
    lines.forEach((line, idx) => {
      if (line.startsWith(NOTES_TOC_START_TAG)) startLineIdx = idx
      if (line.startsWith(NOTES_TOC_END_TAG)) endLineIdx = idx
    })
    if (startLineIdx === -1 || endLineIdx === -1) return

    const toc = generateTocUtil(titles)

    lines.splice(
      startLineIdx + 1,
      endLineIdx - startLineIdx - 1,
      ...toc.split(EOL),
    )
  }
}
