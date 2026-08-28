import { format as prettierFormat } from 'prettier'

import { generateAnchor } from '../utils/generateAnchor'

import type { WorkspaceNoteConfig } from '../workspace/types'

export const NOTE_TOC_START_TAG = '<!-- region:toc -->'
export const NOTE_TOC_END_TAG = '<!-- endregion:toc -->'

export interface FormatTNotesNoteInput {
  content: string
  noteIndex: string
  title: string
  repoOwner: string
  repoName: string
  noteConfig: WorkspaceNoteConfig
  prettier?: boolean
}

export interface FormatTNotesNoteResult {
  content: string
  generatedTitle: string
  generatedToc: string[]
}

function generatedNoteTitle(input: FormatTNotesNoteInput): string {
  const dirName = `${input.noteIndex}. ${input.title}`
  const encodedDirName = encodeURIComponent(dirName)
  const repositoryUrl = `https://github.com/${input.repoOwner}/${input.repoName}/tree/main/notes`
  return `# [${dirName}](${repositoryUrl}/${encodedDirName})`
}

function ensureGeneratedTitle(lines: string[], generatedTitle: string): void {
  if (lines.length === 0) {
    lines.push(generatedTitle)
    return
  }

  lines[0] = lines[0].replace(/^\uFEFF/, '')
  if (lines[0].trimStart().startsWith('# ')) {
    lines[0] = generatedTitle
    return
  }

  lines.unshift(generatedTitle, '')
}

function ensureTocRegion(lines: string[]): { start: number; end: number } {
  let start = lines.findIndex((line) => line.trim() === NOTE_TOC_START_TAG)
  let end = lines.findIndex(
    (line, index) => index > start && line.trim() === NOTE_TOC_END_TAG,
  )

  if (start >= 0 && end > start) return { start, end }

  if (start >= 0) lines.splice(start, 1)
  if (end >= 0) lines.splice(end > start ? end - 1 : end, 1)

  let insertAt = 1
  while (insertAt < lines.length && lines[insertAt].trim() === '') insertAt++
  lines.splice(
    insertAt,
    0,
    '',
    NOTE_TOC_START_TAG,
    '',
    NOTE_TOC_END_TAG,
    '',
  )
  start = insertAt + 1
  end = insertAt + 3
  return { start, end }
}

interface Heading {
  level: number
  text: string
}

function normalizeHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = []
  const counters = { h2: 0, h3: 0 }
  let fence: { marker: '`' | '~'; length: number } | null = null
  let inHtmlComment = false

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as '`' | '~'
      if (!fence) {
        fence = { marker, length: fenceMatch[1].length }
      } else if (fence.marker === marker && fenceMatch[1].length >= fence.length) {
        fence = null
      }
      continue
    }
    if (fence) continue

    if (inHtmlComment) {
      if (line.includes('-->')) inHtmlComment = false
      continue
    }
    const commentStart = line.indexOf('<!--')
    if (commentStart >= 0) {
      const commentEnd = line.indexOf('-->', commentStart + 4)
      if (commentEnd < 0) inHtmlComment = true
      if (line.trimStart().startsWith('<!--')) continue
    }

    const match = line.match(/^(#{2,6})\s+(.+?)\s*#*\s*$/)
    if (!match) continue

    const level = match[1].length
    const plainText = match[2]
      .replace(/^\d+(?:\.\d+)+\.?\s+|^\d+\.\s+/, '')
      .trim()
    let text = plainText

    if (level === 2) {
      counters.h2 += 1
      counters.h3 = 0
      text = `${counters.h2}. ${plainText}`
    } else if (level === 3) {
      counters.h3 += 1
      text = `${counters.h2}.${counters.h3}. ${plainText}`
    }

    lines[index] = `${'#'.repeat(level)} ${text}`
    headings.push({ level, text })
  }

  return headings
}

function buildHeadingToc(headings: Heading[]): string[] {
  return headings.map((heading) => {
    const indent = ' '.repeat(Math.max(0, heading.level - 2) * 2)
    return `${indent}- [${heading.text}](#${generateAnchor(heading.text)})`
  })
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function buildResourceToc(input: FormatTNotesNoteInput): string[] {
  const bilibili = stringArray(input.noteConfig.bilibili)
  const relatedTNotes = stringArray(input.noteConfig.tnotes)
  const yuque = stringArray(input.noteConfig.yuque)
  if (bilibili.length + relatedTNotes.length + yuque.length === 0) return []

  const lines: string[] = ['::: details 📚 相关资源', '']
  if (bilibili.length > 0) {
    lines.push(
      '- [📺 bilibili（笔记视频资源）](https://space.bilibili.com/407241004)',
      ...bilibili.map(
        (bvid, index) =>
          `  - [bilibili.${input.repoName}.${input.noteIndex}.${index + 1}](https://www.bilibili.com/video/${bvid})`,
      ),
    )
  }
  if (relatedTNotes.length > 0) {
    lines.push(
      '- [📒 TNotes（相关知识库）](https://tnotesjs.github.io/TNotes/)',
      ...relatedTNotes.map(
        (repoName) =>
          `  - [TNotes.${repoName}](https://tnotesjs.github.io/TNotes.${repoName}/)`,
      ),
    )
  }
  if (yuque.length > 0) {
    const base = 'https://www.yuque.com/tdahuyou/tnotes.yuque/'
    lines.push(
      `- [📂 TNotes.yuque（笔记附件资源）](${base})`,
      ...yuque.map(
        (slug) =>
          `  - [TNotes.yuque.${input.repoName.replace('TNotes.', '')}.${input.noteIndex}](${base}${slug})`,
      ),
    )
  }
  lines.push('', ':::', '')
  return lines
}

export async function formatTNotesNote(
  input: FormatTNotesNoteInput,
): Promise<FormatTNotesNoteResult> {
  let content = input.content.replace(/\r\n?/g, '\n')
  if (input.prettier !== false) {
    content = await prettierFormat(content, {
      parser: 'markdown',
      proseWrap: 'never',
      endOfLine: 'lf',
    })
  }

  const lines = content.replace(/\n$/, '').split('\n')
  const title = generatedNoteTitle(input)
  ensureGeneratedTitle(lines, title)
  let region = ensureTocRegion(lines)
  const headings = normalizeHeadings(lines)

  // Heading normalization does not add/remove lines, but resolving the region
  // again makes the invariant explicit and protects future format extensions.
  region = ensureTocRegion(lines)
  const toc = buildHeadingToc(headings)
  const resources = buildResourceToc(input)
  lines.splice(
    region.start + 1,
    region.end - region.start - 1,
    '',
    ...resources,
    ...toc,
    '',
  )

  return {
    content: `${lines.join('\n').replace(/\n{3,}$/g, '\n\n')}\n`,
    generatedTitle: title,
    generatedToc: toc,
  }
}
