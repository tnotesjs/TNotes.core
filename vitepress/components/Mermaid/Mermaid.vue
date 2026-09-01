<!--
  Deprecated local shell. Canonical implementation lives in @tnotesjs/ui as Mermaid.
-->
<template>
  <Mermaid :id="id" :graph="graph" :center="center" security-level="loose" />
</template>

<script setup>
import { Mermaid } from '@tnotesjs/ui'

defineProps({
  graph: {
    type: String,
    required: true
  },
  id: {
    type: String,
    required: true
  },
  center: {
    type: Boolean,
    default: false
  },
  class: {
    type: String,
    default: 'mermaid'
  }
})
</script>
