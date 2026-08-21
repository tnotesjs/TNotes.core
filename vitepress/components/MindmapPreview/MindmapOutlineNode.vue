<script setup lang="ts">
import InlineRuns from './InlineRuns'

import type { MindmapNode } from '@tnotesjs/mindmap-core'

defineOptions({ name: 'MindmapOutlineNode' })

defineProps<{
  node: MindmapNode
  version: number
  root?: boolean
}>()

defineEmits<{
  toggle: [id: string]
}>()
</script>

<template>
  <li class="mindmap-outline-node" :class="{ 'is-root': root, 'is-done': node.content.checked === true }">
    <div class="mindmap-outline-row">
      <button
        v-if="node.children.length > 0"
        type="button"
        class="mindmap-outline-toggle"
        :aria-label="node.collapsed ? '展开主题' : '折叠主题'"
        :aria-expanded="!node.collapsed"
        @click="$emit('toggle', node.id)"
      >
        {{ node.collapsed ? '›' : '⌄' }}
      </button>
      <span v-else class="mindmap-outline-leaf" aria-hidden="true">•</span>
      <input
        v-if="node.content.checked !== null && !root"
        class="mindmap-outline-checkbox"
        type="checkbox"
        :checked="node.content.checked"
        disabled
        aria-label="只读待办状态"
      />
      <span class="mindmap-outline-label">
        <InlineRuns :raw="node.content.image ? node.content.text : node.content.raw" />
      </span>
    </div>
    <img
      v-if="node.content.image"
      class="mindmap-outline-image"
      :src="node.content.image.src"
      :alt="node.content.image.alt"
      :style="node.content.image.width ? { width: `${node.content.image.width}px` } : undefined"
    />
    <ul v-if="node.children.length > 0 && !node.collapsed" class="mindmap-outline-children">
      <MindmapOutlineNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :version="version"
        @toggle="$emit('toggle', $event)"
      />
    </ul>
  </li>
</template>
