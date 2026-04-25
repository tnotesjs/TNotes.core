/**
 * .vitepress/config/head.config.ts
 *
 * HTML head 标签配置
 */
import { HeadConfig } from 'vitepress'

import type { TNotesConfig } from '../../types'

export function getHeadConfig(config: TNotesConfig, githubPageUrl: string): HeadConfig[] {
  const head: HeadConfig[] = [
    [
      'meta',
      {
        name: 'keywords',
        content: config.keywords.join(', '),
      },
    ],
    ['meta', { name: 'author', content: config.author }],
    ['link', { rel: 'canonical', href: githubPageUrl }],
    ['link', { rel: 'icon', href: githubPageUrl + 'favicon.ico' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
  ]

  return head
}
