<script setup lang="ts">
import { Footprints as TnFootprints } from '@tnotesjs/ui'

defineProps<{
  times?: number[]
  paragraphs?: string[]
  images?: string[]
  otherInfo?: string
}>()
</script>

<template>
  <TnFootprints
    :times="times"
    :paragraphs="paragraphs"
    :images="images"
    :other-info="otherInfo"
  />
</template>
