/**
 * vitepress/components/composables/useLocalIde.ts
 *
 * 本地 IDE（VS Code / Cursor）选择状态与展示信息
 */

import { computed, ref } from 'vue'

import { icon__cursor, icon__vscode } from '../../assets/icons'
import { LOCAL_IDE_KEY } from '../constants'
import {
  DEFAULT_LOCAL_IDE,
  normalizeLocalIde,
  toIdeFileUrl,
  type LocalIdeId,
} from '../utils/vscodePaths'

const ide = ref<LocalIdeId>(DEFAULT_LOCAL_IDE)
let hydrated = false

function readIdeFromStorage(): LocalIdeId {
  if (typeof window === 'undefined') return DEFAULT_LOCAL_IDE
  return normalizeLocalIde(localStorage.getItem(LOCAL_IDE_KEY))
}

function hydrateFromStorage() {
  if (typeof window === 'undefined' || hydrated) return
  ide.value = readIdeFromStorage()
  hydrated = true
}

export function useLocalIde() {
  hydrateFromStorage()

  const icon = computed(() =>
    ide.value === 'cursor' ? icon__cursor : icon__vscode,
  )

  const shortLabel = computed(() =>
    ide.value === 'cursor' ? 'Cursor' : 'VS Code',
  )

  const openNoteTitle = computed(
    () => `用 ${shortLabel.value} 打开笔记目录`,
  )
  const openRepoTitle = computed(
    () => `用 ${shortLabel.value} 打开本地知识库`,
  )
  const openReadmeTitle = computed(
    () => `用 ${shortLabel.value} 打开 README.md`,
  )
  const openCurrentTitle = computed(
    () => `用 ${shortLabel.value} 打开当前笔记`,
  )

  function setLocalIde(next: LocalIdeId) {
    ide.value = normalizeLocalIde(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_IDE_KEY, ide.value)
    }
  }

  function refreshLocalIde() {
    ide.value = readIdeFromStorage()
  }

  function toFileUrl(filePath: string) {
    return toIdeFileUrl(filePath, ide.value)
  }

  return {
    ide,
    icon,
    shortLabel,
    openNoteTitle,
    openRepoTitle,
    openReadmeTitle,
    openCurrentTitle,
    setLocalIde,
    refreshLocalIde,
    toFileUrl,
  }
}
