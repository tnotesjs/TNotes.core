<!--
  Deprecated local shell. Canonical implementation lives in @tnotesjs/ui as
  WordList. Kept so deep path imports do not break during migration.
-->
<template>
  <WordList :words="words" :need-sort="needSort" />
</template>

<script setup lang="ts">
import { WordList } from '@tnotesjs/ui'

withDefaults(
  defineProps<{
    words?: string[]
    needSort?: boolean
  }>(),
  {
    words: () => [],
    needSort: false
  }
)
</script>
