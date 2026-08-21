import { describe, expect, it } from 'vitest'

import { DEFAULT_OPTIMIZE_DEPS_INCLUDE } from './dependencyOptimization'

describe('Vite dependency optimization', () => {
  it('pre-bundles Mermaid nested CommonJS fastdom dependency', () => {
    expect(DEFAULT_OPTIMIZE_DEPS_INCLUDE).toContain(
      '@tnotesjs/core > mermaid > fastdom',
    )
  })
})
