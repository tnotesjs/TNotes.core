<!-- .vitepress\components\Layout\ToggleSidebar.vue -->
<template>
  <img
    @click="toggleSidebar"
    :class="$style.sidebarToggleBtn"
    :aria-pressed="hidden"
    :title="hidden ? '显示侧边栏' : '隐藏侧边栏'"
    :src="hidden ? icon__next : icon__prev"
    alt=""
  />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import { useSidebarLayout } from './composables/useSidebarLayout'
import { icon__next, icon__prev } from '../../assets/icons'

const { hidden, initSidebarLayout, toggleSidebar } = useSidebarLayout()

onMounted(() => {
  initSidebarLayout()
})
</script>

<style module src="./ToggleSidebar.module.scss"></style>
