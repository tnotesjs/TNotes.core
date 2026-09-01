export interface MindmapFenceOptions {
  title?: string
  initialExpandLevel?: number
}

export interface MindmapReference {
  path: string
  title?: string
}

function cleanHeadingText(value: string): string {
  return value.trim().replace(/\s+#+\s*$/, '').trim()
}

/** Parse the canonical `mindmap [title] 2` fence metadata. */
export function parseMindmapFence(openLine: string): MindmapFenceOptions | null {
  const fenceBody = openLine.trim().replace(/^`+\s*/, '')
  const nameMatch = fenceBody.match(/^mindmap(?=\s|\[|$)/)
  if (!nameMatch) return null

  let rest = fenceBody.slice(nameMatch[0].length).trim()
  const options: MindmapFenceOptions = {}
  const titleMatch = rest.match(/\[([^\]]+)\]/)
  if (titleMatch) {
    options.title = cleanHeadingText(titleMatch[1]) || undefined
    rest = `${rest.slice(0, titleMatch.index)} ${rest.slice((titleMatch.index ?? 0) + titleMatch[0].length)}`.trim()
  }

  if (rest && !/^\d+$/.test(rest)) return null
  if (rest) {
    options.initialExpandLevel = Math.max(1, Number(rest))
  }
  return options
}

/** @deprecated Mindmap fences no longer resolve `<<<` includes; kept for tests / migration docs. */
export function parseMindmapReference(line: string): MindmapReference | null {
  const match = line.trim().match(/^<<<\s+(.+?)\s*$/)
  if (!match) return null

  let rest = match[1].trim()
  let title: string | undefined
  const titleMatch = rest.match(/\s+\[([^\]]+)\]\s*$/)
  if (titleMatch) {
    title = cleanHeadingText(titleMatch[1]) || undefined
    rest = rest.slice(0, titleMatch.index).trim()
  }

  const path = rest.replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, '$1$2').trim()
  return path ? { path, title } : null
}

export interface NormalizeMindmapOptions {
  title?: string
  defaultTitle?: string
}

/** Ensure canonical mindmap Markdown has exactly one H1 root title. */
export function normalizeMindmapMarkdown(
  source: string,
  options: NormalizeMindmapOptions = {},
): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let existingTitle = ''
  let rootIndex = -1

  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^\s{0,3}#(?!#)\s+(.+?)\s*$/)
    if (!match) continue
    existingTitle = cleanHeadingText(match[1])
    rootIndex = index
    break
  }

  const rootTitle = cleanHeadingText(options.title || existingTitle || options.defaultTitle || 'root') || 'root'
  const body = lines.filter((_, index) => index !== rootIndex)
  while (body[0]?.trim() === '') body.shift()
  while (body[body.length - 1]?.trim() === '') body.pop()

  return body.length > 0
    ? `# ${rootTitle}\n\n${body.join('\n')}\n`
    : `# ${rootTitle}\n`
}
