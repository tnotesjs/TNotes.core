import fs from 'node:fs'
import path from 'node:path'

const EXTENSION_LANGUAGES: Record<string, string> = {
  cjs: 'js',
  h: 'c',
  hpp: 'cpp',
  js: 'js',
  jsx: 'jsx',
  md: 'markdown',
  mjs: 'js',
  mts: 'ts',
  py: 'python',
  sh: 'bash',
  ts: 'ts',
  tsx: 'tsx',
  vue: 'vue',
  yml: 'yaml',
}

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.vitepress',
  'dist',
  'node_modules',
])

function visitMarkdownFiles(
  directory: string,
  visit: (source: string) => void,
) {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name))
        visitMarkdownFiles(absolute, visit)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      visit(fs.readFileSync(absolute, 'utf8'))
    }
  }
}

/** Languages used by fences and VitePress `<<<` snippets in this knowledge base. */
export function collectCodeLanguages(rootPath: string): string[] {
  const languages = new Set(['text'])
  visitMarkdownFiles(rootPath, (source) => {
    for (const match of source.matchAll(/^[ \t]*```[ \t]*([^\s{[]+)/gm)) {
      const language = match[1]?.split(':')[0]?.trim()
      if (language && language !== 'mermaid' && language !== 'mindmap') {
        languages.add(language)
      }
    }
    for (const match of source.matchAll(/^[ \t]*<<<[ \t]+([^\s{[]+)/gm)) {
      const extension = path
        .extname(match[1] || '')
        .slice(1)
        .toLowerCase()
      if (extension) languages.add(EXTENSION_LANGUAGES[extension] || extension)
    }
  })
  return [...languages].sort()
}
