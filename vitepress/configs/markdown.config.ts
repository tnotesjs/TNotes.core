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
  parseMarkmapFence,
  parseMindmapReference,
} from '../components/MindmapPreview/compat'

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

/**
 * Mindmap 容器配置（兼容旧的 markmap 围栏名）
 */
function configureMindmapContainer(md: MarkdownIt) {
  md.use(markdownItContainer, 'markmap', {
    marker: '`',
    validate(params: string) {
      return (params || '').trim().startsWith('markmap')
    },
    render() {
      return ''
    },
  })

  // 在 core 阶段把整个 container 区间替换成一个 html_block（MarkMap 组件标签）
  // 这样渲染时就只输出 <MarkMap ...>，中间的列表 token 已被移除
  md.core.ruler.after('block', 'tn_replace_markmap_container', (state) => {
    const src = state.env.source || ''
    const lines = src.split('\n')
    const tokens = state.tokens

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i]
      if (t.type === 'container_markmap_open') {
        const containerName = 'markmap'
        const closeType = 'container_markmap_close'
        // 找到对应的 close token
        let j = i + 1
        while (
          j < tokens.length &&
          tokens[j].type !== closeType
        )
          j++
        if (j >= tokens.length) continue // safety

        // 使用 token.map 提取源文件对应行（open.token.map 存着 container 起止行）
        const open = t
        const startLine = open.map ? open.map[0] + 1 : null
        const endLine = open.map ? open.map[1] - 1 : null

        // 1) 从开头 fence 行解析参数（支持 `{a=1 b="x"}`、`a=1 b="x"`，并支持单个数字 shorthand）
        const params: { [key: string]: any; initialExpandLevel?: number } = {}
        let explicitTitle: string | undefined

        if (open.map && typeof open.map[0] === 'number') {
          const openLine = (lines[open.map[0]] || '').trim()
          const fenceOptions = parseMarkmapFence(openLine)
          explicitTitle = fenceOptions.title
          let paramPart = ''

          // 优先匹配大括号形式 ```markmap{...}
          const braceMatch = openLine.match(/\{([^}]*)\}/)
          if (braceMatch) {
            paramPart = braceMatch[1].trim()
          } else {
            // 否则尝试去掉前缀 ``` 和 markmap，剩下的作为参数部分
            const after = openLine.replace(/^`+\s*/, '')
            if (after.startsWith(containerName)) {
              paramPart = after.slice(containerName.length).trim()
            }
          }
          if (fenceOptions.initialExpandLevel !== undefined) {
            params.initialExpandLevel = fenceOptions.initialExpandLevel
          }

          if (paramPart) {
            // 使用正则按 token 切分：保持用引号包裹的片段为单个 token（支持包含空格）
            const tokenArr = paramPart.match(/"[^"]*"|'[^']*'|\S+/g) || []

            // 如果第一个 token 是纯数字，把它当作 initialExpandLevel
            let startIdx = 0
            if (tokenArr.length > 0 && /^\d+$/.test(tokenArr[0] as string)) {
              params.initialExpandLevel = Number(tokenArr[0])
              startIdx = 1
            }

            // 解析剩余 token 为 key=value（支持 key=val 或 key:val）
            for (let k = startIdx; k < tokenArr.length; k++) {
              const pair = tokenArr[k]
              if (!pair) continue
              const m = pair.match(/^([^=:\s]+)\s*(=|:)\s*(.+)$/)
              if (m) {
                const key = m[1]
                let val = m[3]

                // 去除外层引号（若存在）
                if (
                  (/^".*"$/.test(val) && val.length >= 2) ||
                  (/^'.*'$/.test(val) && val.length >= 2)
                ) {
                  val = val.slice(1, -1)
                } else if (/^\d+$/.test(val)) {
                  // 纯数字转字符串
                  val = String(Number(val))
                }

                params[key] = val
              }
            }
          }
        }

        // 2) 提取内容（支持文件引用语法 `<<< ./path/to/file.md`）
        let content = ''
        if (startLine !== null && endLine !== null) {
          for (let k = startLine; k <= endLine && k < lines.length; k++) {
            content += lines[k] + '\n'
          }
        } else {
          // 回退：如果没有 map 信息，尝试用中间 tokens 拼接文本
          for (let k = i + 1; k < j; k++) {
            content += tokens[k].content || ''
          }
        }

        // --- 检查第一非空行是否为引用语法 ---
        const firstNonEmptyLine =
          (content || '').split('\n').find((ln) => ln.trim() !== '') || ''
        const reference = parseMindmapReference(firstNonEmptyLine)
        let referencedTitle: string | undefined
        if (reference) {
          const refRaw = reference.path
          referencedTitle = reference.title

          // 尝试同步读取文件内容（兼容常见 Node 环境）
          try {
            // 尝试根据当前 markdown 文件位置解析相对路径
            const env = state.env || {}
            const possibleRel =
              env.relativePath || env.path || env.filePath || env.file || ''
            let refFullPath = refRaw

            if (!path.isAbsolute(refRaw)) {
              if (possibleRel) {
                // 将 relativePath 视作相对于项目根的路径（例如 'notes/foo/bar.md'），取其目录
                const currentDir = path.dirname(possibleRel)
                // 解析到 process.cwd()
                refFullPath = path.resolve(process.cwd(), currentDir, refRaw)
              } else {
                // 没有相对文件信息，则相对于项目根解析
                refFullPath = path.resolve(process.cwd(), refRaw)
              }
            } else {
              // 绝对路径直接使用（按系统路径）
              refFullPath = refRaw
            }

            // console.log('refFullPath:', refFullPath)
            const fileContent = fs.readFileSync(refFullPath, 'utf-8')
            content = fileContent
          } catch (err) {
            // 读取失败：将错误写入 content 以便排查（不会让流程直接崩溃）
            const errorMsg = err instanceof Error ? err.message : String(err)
            content = `- Failed to load referenced file: ${esc(String(refRaw))}\n  - Error: ${esc(errorMsg)}`
          }
        }

        content = normalizeMindmapMarkdown(content, {
          title: explicitTitle || referencedTitle,
        })

        // 3) 构造组件标签并把参数注入为 props
        const encodedContent = encodeURIComponent(content.trim())
        let propsStr = `content="${encodedContent}"`

        for (const [k, v] of Object.entries(params)) {
          if (typeof v === 'number' || /^\d+$/.test(String(v))) {
            propsStr += ` :${k}="${v}"`
          } else {
            const safe = String(v).replace(/"/g, '&quot;')
            propsStr += ` ${k}="${safe}"`
          }
        }

        const html = `<MindmapPreview ${propsStr}></MindmapPreview>\n`

        // 创建 html_block token
        const htmlToken = new state.Token('html_block', '', 0)
        htmlToken.content = html

        // 用单个 html_token 替换 open..close 区间
        tokens.splice(i, j - i + 1, htmlToken as any)
      }
    }

    return true
  })
}

/** Canonical `mindmap` fence. Legacy `markmap` stays on its historical container path. */
function configureMindmapFence(md: MarkdownIt) {
  const fence = md.renderer.rules.fence
    ? md.renderer.rules.fence.bind(md.renderer.rules)
    : () => ''

  md.renderer.rules.fence = (tokens, index, options, env, slf) => {
    const token = tokens[index]
    const info = token.info.trim()
    if (!/^mindmap(?=\s|\{|\[|$)/.test(info)) {
      return fence(tokens, index, options, env, slf)
    }

    const fenceOptions = parseMarkmapFence(info)
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

      // 添加 Mindmap 支持，并继续兼容旧 MarkMap 围栏
      configureMindmapContainer(md)
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
