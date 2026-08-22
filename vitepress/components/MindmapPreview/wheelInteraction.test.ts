import { describe, expect, it, vi } from 'vitest'

import { gateMindmapWheel } from './wheelInteraction'

describe('gateMindmapWheel', () => {
  it('keeps document scrolling available before the canvas is activated', () => {
    const stop = vi.fn()
    const event = { stopImmediatePropagation: stop } as unknown as WheelEvent

    gateMindmapWheel(event, false)

    expect(stop).toHaveBeenCalledOnce()
  })

  it('lets CanvasViewer handle wheel input after activation', () => {
    const stop = vi.fn()
    const event = { stopImmediatePropagation: stop } as unknown as WheelEvent

    gateMindmapWheel(event, true)

    expect(stop).not.toHaveBeenCalled()
  })
})
