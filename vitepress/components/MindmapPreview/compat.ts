export interface MarkmapFenceOptions {
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

function promoteLegacyRootList(body: string[], rootTitle: string): string[] {
  const firstContentIndex = body.findIndex((line) => line.trim() !== '')
  if (firstContentIndex < 0) return body

  const firstItem = body[firstContentIndex].match(/^[-+*]\s+(.+?)\s*$/)
  if (!firstItem || cleanHeadingText(firstItem[1]) !== rootTitle) return body

  const descendants = body.slice(firstContentIndex + 1)
  if (descendants.some((line) => line.trim() !== '' && !/^\s{2,}/.test(line))) return body

  return [
    ...body.slice(0, firstContentIndex),
    ...descendants.map((line) => line.replace(/^ {2}/, '')),
  ]
}

/** Parse the opening fence while retaining every legacy expand-level spelling. */
export function parseMarkmapFence(openLine: string): MarkmapFenceOptions {
  const fenceBody = openLine.trim().replace(/^`+\s*/, '')
  const nameMatch = fenceBody.match(/^(mindmap|markmap)(?=\s|\{|\[|$)/)
  if (!nameMatch) return {}
  let rest = fenceBody.slice(nameMatch[1].length).trim()
  const options: MarkmapFenceOptions = {}

  const titleMatch = rest.match(/\[([^\]]+)\]/)
  if (titleMatch) {
    options.title = titleMatch[1].trim()
    rest = `${rest.slice(0, titleMatch.index)} ${rest.slice((titleMatch.index ?? 0) + titleMatch[0].length)}`.trim()
  }

  const braceMatch = rest.match(/\{([^}]*)\}/)
  const paramPart = braceMatch ? braceMatch[1].trim() : rest
  const tokens = paramPart.match(/"[^"]*"|'[^']*'|\S+/g) ?? []
  for (const [index, token] of tokens.entries()) {
    if (/^\d+$/.test(token) && index === 0) {
      options.initialExpandLevel = Number(token)
      continue
    }
    const pair = token.match(/^([^=:\s]+)\s*(?:=|:)\s*(.+)$/)
    if (!pair || pair[1] !== 'initialExpandLevel') continue
    const value = pair[2].replace(/^['"]|['"]$/g, '')
    if (/^\d+$/.test(value)) options.initialExpandLevel = Number(value)
  }
  return options
}

/** Parse `<<< file.md [title]`; the title is optional and paths may be quoted. */
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

/** Convert historical VitePress markmap input into the strict mindmap-core format. */
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
  const body: string[] = []
  let headingDepth: number | null = null

  for (let index = 0; index < lines.length; index++) {
    if (index === rootIndex) continue
    const line = lines[index]
    const heading = line.match(/^\s{0,3}(#{2,6})\s+(.+?)\s*$/)
    if (heading) {
      headingDepth = heading[1].length - 2
      body.push(`${'  '.repeat(headingDepth)}- ${cleanHeadingText(heading[2])}`)
      continue
    }

    const listItem = line.match(/^(\s*)([-+*])\s+(.+)$/)
    if (listItem && headingDepth !== null) {
      body.push(`${'  '.repeat(headingDepth + 1)}${line}`)
      continue
    }
    body.push(line)
  }

  const normalizedBody = promoteLegacyRootList(body, rootTitle)
  while (normalizedBody[0]?.trim() === '') normalizedBody.shift()
  while (normalizedBody[normalizedBody.length - 1]?.trim() === '') normalizedBody.pop()
  return normalizedBody.length > 0
    ? `# ${rootTitle}\n\n${normalizedBody.join('\n')}\n`
    : `# ${rootTitle}\n`
}
