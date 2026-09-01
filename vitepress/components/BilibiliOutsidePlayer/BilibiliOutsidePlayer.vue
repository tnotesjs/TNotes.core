<!--
  Deprecated local shell. Canonical implementation lives in @tnotesjs/ui as
  BilibiliVideo. Kept so deep path imports do not break during migration.
-->
<template>
  <BilibiliVideo :id="id" />
</template>

<script setup lang="ts">
import { BilibiliVideo } from '@tnotesjs/ui'

defineProps<{
  id: string
}>()
</script>
