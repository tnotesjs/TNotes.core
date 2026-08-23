import { describe, expect, it } from 'vitest'

import {
  findTNotesComponent,
  formatTNotesNote,
  TNOTES_COMPONENTS,
} from './index'

describe('TNotes Markdown contract', () => {
  it('exposes runtime-neutral component descriptors', () => {
    expect(findTNotesComponent('N')?.name).toBe('NotesTable')
    expect(findTNotesComponent('SWIPER')?.kind).toBe('container')
    expect(TNOTES_COMPONENTS.some((item) => item.name === 'markmap')).toBe(true)
  })

  it('restores missing generated markers without interpreting fenced headings', async () => {
    const result = await formatTNotesNote({
      content: '## Heading\n\n~~~md\n### source\n~~~\n',
      noteIndex: '0042',
      title: 'Answer',
      repoOwner: 'tnotesjs',
      repoName: 'TNotes.fixture',
      noteConfig: {
        id: 'answer',
        bilibili: [],
        tnotes: [],
        yuque: [],
        done: false,
        enableDiscussions: false,
      },
      prettier: false,
    })

    expect(result.content).toContain('<!-- region:toc -->')
    expect(result.content).toContain('<!-- endregion:toc -->')
    expect(result.generatedToc).toEqual(['- [1. Heading](#1-heading)'])
    expect(result.content).toContain('~~~md\n### source\n~~~')
  })
})
