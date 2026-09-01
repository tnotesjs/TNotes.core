<!-- Legacy path: re-export shared Mindmap as MindmapPreview for old fence output. -->
<script setup lang="ts">
import { Mindmap } from '@tnotesjs/ui'

defineProps<{
  content?: string
  source?: string
  initialExpandLevel?: number
  isDark?: boolean
}>()
</script>

<template>
  <Mindmap
    :content="content"
    :source="source"
    :initial-expand-level="initialExpandLevel"
    :is-dark="isDark"
  />
</template>
