/**
 * .vitepress/config/markdown.config.ts
 *
 * Markdown 配置
 */

import fs from 'fs'
import markdownItContainer from 'markdown-it-container'
import mila from 'markdown-it-link-attributes'
import markdownItTaskLists from 'markdown-it-task-lists'
import path from 'path'

import { generateAnchor } from '../../utils'
import {
  normalizeMindmapMarkdown,
  parseMindmapFence,
  parseMindmapReference,
} from '../components/MindmapPreview/markdown'

import type MarkdownIt from 'markdown-it'
import type { MarkdownOptions } from 'vitepress'

/**
 * 辅助函数：HTML 转义
 */
function esc(s = '') {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]!)
  )
}

/**
 * 简化的 Mermaid 处理函数
 */
const simpleMermaidMarkdown = (md: MarkdownIt) => {
  const fence = md.renderer.rules.fence
    ? md.renderer.rules.fence.bind(md.renderer.rules)
    : () => ''

  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]

    // 检查是否为 mermaid 代码块
    if (token.info.trim() === 'mermaid') {
      try {
        const key = `mermaid-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`
        const content = token.content
        return `<Mermaid id="${key}" graph="${encodeURIComponent(content)}" />`
      } catch (err) {
        return `<pre>${err}</pre>`
      }
    }

    // 允许使用 mmd 标记显示 Mermaid 代码本身
    if (token.info.trim() === 'mmd') {
      tokens[index].info = 'mermaid'
    }

    return fence(tokens, index, options, env, slf)
  }
}

/** Canonical `mindmap` fence. */
function configureMindmapFence(md: MarkdownIt) {
  const fence = md.renderer.rules.fence
    ? md.renderer.rules.fence.bind(md.renderer.rules)
    : () => ''

  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]
    const info = token.info.trim()
    const fenceOptions = parseMindmapFence(info)
    if (!fenceOptions) return fence(tokens, index, options, env, slf)
    let content = token.content
    const firstNonEmptyLine = content.split('\n').find((line) => line.trim()) ?? ''
    const reference = parseMindmapReference(firstNonEmptyLine)

    if (reference) {
      const possibleRel = env?.relativePath || env?.path || env?.filePath || env?.file || ''
      const refFullPath = path.isAbsolute(reference.path)
        ? reference.path
        : path.resolve(process.cwd(), possibleRel ? path.dirname(possibleRel) : '', reference.path)
      try {
        content = fs.readFileSync(refFullPath, 'utf8')
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        content = `- Failed to load referenced file: ${reference.path}\n  - Error: ${message}`
      }
    }

    content = normalizeMindmapMarkdown(content, {
      title: fenceOptions.title || reference?.title,
    })
    const props = [
      `content="${encodeURIComponent(content.trim())}"`,
      fenceOptions.initialExpandLevel === undefined
        ? ''
        : `:initialExpandLevel="${fenceOptions.initialExpandLevel}"`,
    ].filter(Boolean).join(' ')
    return `<MindmapPreview ${props}></MindmapPreview>\n`
  }
}

/**
 * Swiper 容器配置
 */
function configureSwiperContainer(md: MarkdownIt) {
  let __tn_swiper_uid = 0

  interface TN_RULES_STACK_ITEM {
    image: any
    pOpen: any
    pClose: any
  }
  let __tn_rules_stack: Array<TN_RULES_STACK_ITEM> = []

  // 每个文档渲染前重置计数器
  md.core.ruler.before('block', 'tn_swiper_reset_uid', () => {
    __tn_swiper_uid = 0
    __tn_rules_stack = []
    return true
  })

  md.use(markdownItContainer, 'swiper', {
    render: (tokens: any[], idx: number) => {
      if (tokens[idx].nesting === 1) {
        // 进容器：保存原规则 & 局部覆盖
        __tn_rules_stack.push({
          image: md.renderer.rules.image,
          pOpen: md.renderer.rules.paragraph_open,
          pClose: md.renderer.rules.paragraph_close,
        })

        md.renderer.rules.paragraph_open = () => ''
        md.renderer.rules.paragraph_close = () => ''
        md.renderer.rules.image = (tokens: any[], i: number) => {
          const token: any = tokens[i]
          const src = token.attrGet('src') || ''
          const alt = token.content || ''
          const title = alt && alt.trim() ? alt : 'img'
          return `<div class="swiper-slide" data-title="${esc(
            title
          )}"><img src="${esc(src)}" alt="${esc(alt)}"></div>`
        }

        const id = `tn-swiper-${++__tn_swiper_uid}`
        return `
<div class="tn-swiper" data-swiper-id="${id}">
  <div class="tn-swiper-tabs"></div>
  <div class="swiper-container">
    <div class="swiper-wrapper">
`
      } else {
        // 出容器：恢复原规则并收尾
        const prev: TN_RULES_STACK_ITEM = __tn_rules_stack.pop() || {
          image: null,
          pOpen: null,
          pClose: null,
        }
        md.renderer.rules.image = prev.image
        md.renderer.rules.paragraph_open = prev.pOpen
        md.renderer.rules.paragraph_close = prev.pClose

        return `
    </div>
    <!-- 下一页按钮 -->
    <!-- <div class="swiper-button-next"></div> -->
    <!-- 上一页按钮 -->
    <!-- <div class="swiper-button-prev"></div> -->
    <!-- 分页导航 -->
    <!-- <div class="swiper-pagination"></div> -->
  </div>
</div>
`
      }
    },
  })
}

/**
 * Markdown 配置
 */
export function getMarkdownConfig(): MarkdownOptions {
  const markdown: MarkdownOptions = {
    lineNumbers: true,
    math: true,
    config(md) {
      // 添加前置规则保存原始内容
      md.core.ruler.before('normalize', 'save-source', (state) => {
        state.env.source = state.src
        return true
      })

      // 添加 Mermaid 支持
      simpleMermaidMarkdown(md)

      // 添加规范的 Mindmap 围栏支持
      configureMindmapFence(md)

      // 添加任务列表支持
      md.use(markdownItTaskLists)

      // 添加链接属性支持
      md.use(mila, {
        attrs: {
          target: '_self',
          rel: 'noopener',
        },
      })

      // 添加 Swiper 支持
      configureSwiperContainer(md)
    },
    anchor: {
      slugify: generateAnchor,
    },
    image: {
      lazyLoading: true,
    },
  }

  return markdown
}
