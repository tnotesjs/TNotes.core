/**
 * services/toc/moveTocInside.test.ts
 *
 * 验证 inside 落点将源子树插入目标行之后（第一个子项位置）。
 */

import { describe, expect, it } from 'vitest'

import {
  adjustTocLineIndexAfterSubtreeRemoval,
  getTocEntrySubtreeRange,
  parseTocLine,
  TOC_INDENT_SPACES,
} from './tocHelpers'

function adjustSubtreeIndent(lines: string[], delta: number): string[] {
  if (delta === 0) return lines

  return lines.map((line) => {
    const parsed = parseTocLine(line)
    if (!parsed.isMatch) return line

    const newIndent = Math.max(0, parsed.indentLevel + delta)
    const withoutIndent = line.trimStart()
    return `${' '.repeat(newIndent * TOC_INDENT_SPACES)}${withoutIndent}`
  })
}

function moveTocEntryInsideFirstChild(
  lines: string[],
  sourceTocLineIndex: number,
  targetTocLineIndex: number,
): string[] {
  const next = [...lines]
  const { start, end } = getTocEntrySubtreeRange(next, sourceTocLineIndex)
  const movingLines = next.splice(start, end - start)

  const targetLineIndex = adjustTocLineIndexAfterSubtreeRemoval(
    targetTocLineIndex,
    start,
    end,
  )
  const targetParsed = parseTocLine(next[targetLineIndex])
  const insertIndex = targetLineIndex + 1
  const newIndent = targetParsed.indentLevel + 1

  const oldBaseIndent = parseTocLine(movingLines[0]).indentLevel
  const indentDelta = newIndent - oldBaseIndent
  const adjustedLines = adjustSubtreeIndent(movingLines, indentDelta)

  next.splice(insertIndex, 0, ...adjustedLines)
  return next
}

describe('moveTocEntry inside first child', () => {
  it('inserts moved note immediately after parent when children exist', () => {
    const lines = [
      '- [x] 0019. Author',
      '  - [x] 0036. Workflow',
      '  - [ ] 0035. Norm',
      '- [ ] 0039. new',
    ]

    const result = moveTocEntryInsideFirstChild(lines, 3, 0)

    expect(result).toEqual([
      '- [x] 0019. Author',
      '  - [ ] 0039. new',
      '  - [x] 0036. Workflow',
      '  - [ ] 0035. Norm',
    ])
  })
})
