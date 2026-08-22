<script setup lang="ts">
defineProps<{
  view: 'mindmap' | 'outline' | 'source'
}>()
</script>

<template>
  <svg v-if="view === 'mindmap'" aria-hidden="true" viewBox="0 0 48 48">
    <path d="M0 0h48v48H0z" fill="none" />
    <path
      d="M26 24h16M26 38h16M26 10h16M18 24H6h4m8 14c-6-2-2-14-8-14m8-14c-6 2-2 14-8 14"
      fill="none"
      stroke="#636cff"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="4"
    />
  </svg>
  <svg v-else-if="view === 'outline'" aria-hidden="true" viewBox="0 0 48 48">
    <path d="M0 0h48v48H0z" fill="none" />
    <path
      d="M26 24h18m-30 0h4m0 14h26M6 38h4m8-28h26M6 10h4"
      fill="none"
      stroke="#636cff"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="4"
    />
  </svg>
  <svg v-else aria-hidden="true" viewBox="0 0 24 24">
    <path d="M0 0h24v24H0z" fill="none" />
    <path
      d="m17 8 1.84 1.85c.773.778 1.16 1.167 1.16 1.65s-.387.872-1.16 1.65L17 15M7 8 5.16 9.85C4.387 10.628 4 11.017 4 11.5s.387.872 1.16 1.65L7 15m7.5-11-5 16"
      fill="none"
      stroke="#636cff"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="1.5"
    />
  </svg>
</template>
