/**
 * .vitepress/config/markdown.config.ts
 *
 * Markdown 配置
 */

import { highlightCodeSync } from '@tnotesjs/ui/code'
import {
  parseFootprintsDatetime,
  parseFootprintsSource,
} from '@tnotesjs/ui/footprints-parse'
import markdownItContainer from 'markdown-it-container'
import mila from 'markdown-it-link-attributes'
import markdownItTaskLists from 'markdown-it-task-lists'

import { generateAnchor } from '../../utils'
import {
  normalizeMindmapMarkdown,
  parseMindmapFence,
} from '../components/MindmapPreview/markdown'

// Pure helper only — do not import `@tnotesjs/ui` root from Node config
// (package entry is .ts; Node cannot strip types under node_modules).

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
      })[ch]!,
  )
}

const bindJson = (value: unknown) =>
  `JSON.parse(decodeURIComponent('${encodeURIComponent(JSON.stringify(value)).replace(/'/g, '%27')}'))`

/** Replace VitePress's code DOM while retaining its parser/snippet pipeline. */
function configureSharedCodeBlocks(md: MarkdownIt) {
  const previousFence = md.renderer.rules.fence
  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]
    if ((token as typeof token & { src?: unknown }).src) {
      previousFence?.(tokens, index, options, env, slf)
    }
    const html = highlightCodeSync(token.content, token.info)
    const block = `<CodeBlock :code="${bindJson(token.content)}" :info="${bindJson(token.info)}" :highlighted-html="${bindJson(html)}" />`
    return token.meta?.tnCodeGroupIndex === undefined
      ? `${block}\n`
      : `<div class="tn-code-group__panel" role="tabpanel">${block}</div>\n`
  }
  const open = 'container_code-group_open'
  const close = 'container_code-group_close'
  md.renderer.rules[open] = (tokens, index) => {
    const items: Array<{ info: string }> = []
    let itemIndex = 0
    for (
      let i = index + 1;
      i < tokens.length && tokens[i].type !== close;
      i++
    ) {
      const token = tokens[i]
      if (token.type !== 'fence') continue
      token.meta ??= {}
      token.meta.tnCodeGroupIndex = itemIndex++
      items.push({ info: token.info })
    }
    return `<CodeGroup :items="${bindJson(items)}">\n`
  }
  md.renderer.rules[close] = () => '</CodeGroup>\n'
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
    const parts = token.info.trim().split(/\s+/).filter(Boolean)

    // `mermaid` or `mermaid center`
    if (parts[0] === 'mermaid') {
      try {
        const centered = parts
          .slice(1)
          .some((part) => part.toLowerCase() === 'center')
        const key = `mermaid-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`
        const content = token.content
        const centerAttr = centered ? ' :center="true"' : ''
        return `<Mermaid id="${key}" graph="${encodeURIComponent(content)}"${centerAttr} />`
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
    // Mindmap nodes must live in the fence body. External `<<<` includes are
    // no longer resolved here (body-level VitePress snippets remain separate).
    const content = normalizeMindmapMarkdown(token.content, {
      title: fenceOptions.title,
    })
    const props = [
      `content="${encodeURIComponent(content.trim())}"`,
      fenceOptions.initialExpandLevel === undefined
        ? ''
        : `:initialExpandLevel="${fenceOptions.initialExpandLevel}"`,
    ]
      .filter(Boolean)
      .join(' ')
    return `<Mindmap ${props}></Mindmap>\n`
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
            title,
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

/** Escape text for HTML element bodies (not attributes). */
function escapeHtmlText(s: string) {
  return s.replace(
    /[&<>"']/g,
    (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        ch
      ] as string,
  )
}

/**
 * `::: footprints 2025-01-22 23:47` → Footprints Vue block.
 * Prefer token-based extraction (source line maps are unreliable in VitePress).
 * Text goes through encoded props; images use a slot so Vite rewrites asset URLs.
 */
function extractFootprintsPayloadFromTokens(tokens: any[], idx: number) {
  const meta = String(tokens[idx].info || '')
    .trim()
    .replace(/^footprints\s*/i, '')
  const times = parseFootprintsDatetime(meta)
  const paragraphs: string[] = []
  const images: string[] = []
  let otherInfo = ''
  let inOther = false

  for (let i = idx + 1; i < tokens.length; i++) {
    const t = tokens[i]
    if (t.type === 'container_footprints_close') break
    if (t.type !== 'inline') continue

    const childImgs: string[] = []
    if (Array.isArray(t.children)) {
      for (const c of t.children) {
        if (c.type === 'image') {
          const src =
            c.attrGet?.('src') ||
            c.attrs?.find((a: string[]) => a[0] === 'src')?.[1]
          if (src) childImgs.push(src)
        }
      }
    }

    const content = String(t.content || '').trim()
    if (content === '---') {
      inOther = true
      continue
    }
    if (childImgs.length) {
      // Treat as image block when the inline is image-only (ignore bare alt text).
      const withoutImgs = content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim()
      if (!withoutImgs) {
        images.push(...childImgs)
        continue
      }
    }
    const imgOnly = content.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/)
    if (imgOnly) {
      images.push(imgOnly[2])
      continue
    }
    if (!content) continue
    if (inOther) otherInfo = otherInfo ? `${otherInfo}\n${content}` : content
    else paragraphs.push(content)
  }

  return { times, paragraphs, images, otherInfo }
}

function configureFootprintsContainer(md: MarkdownIt) {
  md.use(markdownItContainer, 'footprints', {
    validate: (params: string) => /^footprints(\s|$)/i.test(params.trim()),
    render: (tokens: any[], idx: number, _opts: unknown, env: any) => {
      if (tokens[idx].nesting !== 1) return ''

      // Extract BEFORE hiding/clearing tokens.
      let payload = extractFootprintsPayloadFromTokens(tokens, idx)

      // Optional enrichment from source slice when tokens missed content.
      const startLine = tokens[idx].map?.[0] ?? 0
      let endLine = startLine
      for (let i = idx + 1; i < tokens.length; i++) {
        if (tokens[i].type === 'container_footprints_close') {
          endLine = tokens[i].map?.[0] ?? endLine
          break
        }
      }
      const raw = String(env?.src ?? env?.source ?? '')
      if (raw && endLine > startLine) {
        const slice = raw
          .split(/\r?\n/)
          .slice(startLine, endLine + 1)
          .join('\n')
        const fromSource = parseFootprintsSource(
          slice.includes(':::')
            ? slice
            : `::: ${tokens[idx].info}\n${slice}\n:::`,
        )
        if (!payload.paragraphs.length && fromSource.paragraphs.length) {
          payload = { ...payload, paragraphs: fromSource.paragraphs }
        }
        if (!payload.images.length && fromSource.images.length) {
          payload = { ...payload, images: fromSource.images }
        }
        if (!payload.otherInfo && fromSource.otherInfo) {
          payload = { ...payload, otherInfo: fromSource.otherInfo }
        }
        if (!payload.times.length && fromSource.times.length) {
          payload = { ...payload, times: fromSource.times }
        }
      }

      for (let i = idx + 1; i < tokens.length; i++) {
        if (tokens[i].type === 'container_footprints_close') break
        tokens[i].hidden = true
        tokens[i].content = ''
        if (Array.isArray(tokens[i].children)) {
          for (const child of tokens[i].children) {
            child.hidden = true
            child.content = ''
          }
          tokens[i].children = []
        }
      }

      const enc = (value: unknown) =>
        encodeURIComponent(JSON.stringify(value)).replace(/'/g, '%27')
      const bindExpr = (value: unknown) =>
        "JSON.parse(decodeURIComponent('" + enc(value) + "'))"
      const imageSlot = payload.images
        .map((src, i) => {
          return (
            '<img src="' +
            escapeHtmlText(src) +
            '" @click="openModal(' +
            String(i) +
            ')" />'
          )
        })
        .join('\n')
      const openTag =
        '<Footprints :times="' +
        bindExpr(payload.times) +
        '" :paragraphs="' +
        bindExpr(payload.paragraphs) +
        '" :other-info="' +
        bindExpr(payload.otherInfo) +
        '">'
      if (!payload.images.length) return openTag + '</Footprints>\n'
      return (
        openTag +
        '\n<template #image-list="{ openModal }">\n' +
        imageSlot +
        '\n</template>\n</Footprints>\n'
      )
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

      // Footprints 容器（Type A）
      configureFootprintsContainer(md)
      // Last on purpose: replace only VitePress code DOM and styling.
      configureSharedCodeBlocks(md)
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
