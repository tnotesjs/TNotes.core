import { parseInlineSegments } from '@tnotesjs/mindmap-core'
import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'MindmapInlineRuns',
  props: {
    raw: { type: String, default: '' },
  },
  setup(props) {
    return () => h('span', { class: 'mindmap-inline-runs' }, parseInlineSegments(props.raw).map((segment) => {
      const classes = Object.entries(segment.marks)
        .filter(([, enabled]) => enabled)
        .map(([name]) => `is-${name}`)
      if (segment.link) {
        return h('a', {
          class: ['mindmap-inline-run', 'is-link', ...classes],
          href: segment.link.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        }, segment.text)
      }
      return h('span', { class: ['mindmap-inline-run', ...classes] }, segment.text)
    }))
  },
})
