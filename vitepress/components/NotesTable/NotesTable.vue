<!--
  VitePress adapter: resolves note ids via notesConfig + useData,
  then renders host-neutral @tnotesjs/ui NotesTable.
-->
<template>
  <NotesTable
    :notes="tableData"
    :missing-ids="notFoundIds"
    :error="errorMessage"
  />
</template>

<script setup lang="ts">
import { NotesTable } from '@tnotesjs/ui'
import { useData } from 'vitepress'
import { computed } from 'vue'

// @ts-expect-error - VitePress data loader exports data at runtime
import { data as allNotesConfig } from '../notesConfig.data.ts'

import type { NotesTableRow } from '@tnotesjs/ui'

interface Props {
  ids: string[]
}

const props = defineProps<Props>()
const vpData = useData()

const errorMessage = computed(() => {
  if (!props.ids || !Array.isArray(props.ids)) {
    return '错误: ids 属性必须是一个数组'
  }
  if (props.ids.length === 0) {
    return '错误: ids 数组不能为空'
  }
  return null
})

const notFoundIds = computed(() => {
  if (errorMessage.value) return []
  return props.ids.filter((id) => !allNotesConfig[id])
})

const tableData = computed((): NotesTableRow[] => {
  if (errorMessage.value) return []
  const base = vpData.site.value.base || '/'
  return props.ids
    .filter((id) => allNotesConfig[id])
    .map((id) => {
      const config = allNotesConfig[id]
      let title = id
      if (config.redirect) {
        const match = config.redirect.match(/notes\/\d{4}\.\s*([^/]+)\/README/)
        if (match) title = match[1]
      }
      return {
        id,
        title,
        description: config.description || '',
        url: config.redirect ? `${base}${config.redirect}` : '#',
      }
    })
})
</script>
