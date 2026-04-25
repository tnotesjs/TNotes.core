/**
 * .vitepress/config/theme.config.ts
 *
 * 主题配置
 *
 * doc:
 * https://vitepress.dev/reference/default-theme-config
 */
import type { TNotesConfig } from '../../types'
import type { DefaultTheme } from 'vitepress'

export function getThemeConfig(config: TNotesConfig): DefaultTheme.Config {
  const themeConfig: DefaultTheme.Config = {
    docFooter: {
      prev: '上一篇',
      next: '下一篇',
    },
    externalLinkIcon: true,
    outline: {
      level: [2, 3],
      label: '目录',
    },
    nav: [
      {
        text: '👀 README',
        link: '/README',
      },
      {
        text: 'Menus',
        items: config.menuItems,
      },
    ],
    search: {
      // 使用本地搜索（不依赖远程服务器）
      provider: 'local',
      options: {
        miniSearch: {
          /**
           * 控制如何对文档进行分词、字段提取等预处理
           * @type {Pick<import('minisearch').Options, 'extractField' | 'tokenize' | 'processTerm'>}
           */
          options: {
            // 自定义分词逻辑
            tokenize: (text, language) => {
              if (language === 'zh') {
                return text.match(/[\u4e00-\u9fa5]+|\S+/g) || []
              }
              return text.split(/\s+/)
            },
            // 将所有词转为小写，确保大小写不敏感匹配
            processTerm: (term) => term.toLowerCase(),
          },
          /**
           * 控制搜索时的行为（如模糊匹配、权重）
           * @type {import('minisearch').SearchOptions}
           * @default
           * { fuzzy: 0.2, prefix: true, boost: { title: 4, text: 2, titles: 1 } }
           */
          searchOptions: {
            fuzzy: 0.2, // 模糊匹配阈值（0-1），允许拼写错误的阈值（数值越低越严格）
            prefix: true, // 是否启用前缀匹配（输入"jav"可匹配"javascript"）
            boost: {
              title: 10, // 文件名作为 h1 标题，权重最高
              headings: 5, // h2 - h6
              text: 3, // 正文内容索引
              code: 1, // 代码块索引权重
            },
          },
        },
        /**
         * 控制哪些 Markdown 内容参与本地搜索引擎索引
         * @param {string} src 当前 Markdown 文件的原始内容（即 .md 文件中的文本）
         * @param {import('vitepress').MarkdownEnv} env 包含当前页面环境信息的对象，比如 frontmatter、路径等
         * @param {import('markdown-it-async')} md 一个 Markdown 渲染器实例，用来将 Markdown 转换为 HTML
         */
        async _render(src, env, md) {
          const filePath = env.relativePath
          if (filePath.includes('TOC.md')) return ''

          // 提取路径中 "notes/..." 后面的第一个目录名
          const notesIndex = filePath.indexOf('notes/')
          let folderName = ''

          if (notesIndex !== -1) {
            const pathAfterNotes = filePath.slice(notesIndex + 'notes/'.length)
            folderName = pathAfterNotes.split('/')[0]
          }

          // 显式添加一个高权重字段，例如 "title"
          const titleField = `# ${folderName}\n`
          const html = md.render(titleField + '\n\n' + src, env)

          return html
        },
      },
    },
    // sidebar: [...sidebar],
    sidebar: [
      {
        text: '👀 README',
        link: '/README',
      },
    ],
    socialLinks: config.socialLinks as DefaultTheme.SocialLink[],
  }

  return themeConfig
}
