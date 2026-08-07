<!-- 
vitepress/components/SidebarCard/FolderTreeItems.vue 
-->

<script setup>
import {
  icon__sidebar_collapsed,
  icon__sidebar_opened,
} from '../../assets/icons'
import { useLocalIde } from '../composables/useLocalIde'

const props = defineProps({
  nodes: {
    type: Array,
    required: true,
  },
  depth: {
    type: Number,
    default: 0,
  },
  showNumber: {
    type: Boolean,
    default: false,
  },
  expandedKeys: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['toggle-node', 'open-vscode'])

const { icon: localIdeIcon, openNoteTitle } = useLocalIde()

function hasChildren(node) {
  return node.children?.length > 0
}

function isExpanded(node) {
  return props.expandedKeys.has(node.key)
}

function getNodeKey(node) {
  return node.key
}

function getDisplayTitle(node) {
  if (props.showNumber && node.realNumber) {
    return `${node.realNumber}. ${node.text}`
  }
  return node.text
}

function getStatusEmoji(status) {
  if (status === 'done') return '✅'
  if (status === 'pending') return '⏰'
  return '📄'
}

function onToggle(node) {
  emit('toggle-node', node.key)
}

function onOpenVscode(node, event) {
  event.preventDefault()
  event.stopPropagation()
  emit('open-vscode', node)
}
</script>

<template>
  <div
    v-for="node in nodes"
    :key="getNodeKey(node)"
    class="tree-node"
    :style="{ paddingLeft: `${depth * 16}px` }"
  >
    <div
      class="tree-row"
      :class="{ 'tree-row-parent': hasChildren(node) }"
    >
      <button
        v-if="hasChildren(node)"
        class="tree-arrow-btn"
        type="button"
        :title="isExpanded(node) ? '折叠' : '展开'"
        @click.stop="onToggle(node)"
      >
        <span class="tree-arrow" :class="{ collapsed: !isExpanded(node) }">
          <img
            :src="
              isExpanded(node)
                ? icon__sidebar_opened
                : icon__sidebar_collapsed
            "
            alt=""
          />
        </span>
      </button>
      <span v-else class="tree-arrow-placeholder" aria-hidden="true" />

      <a
        v-if="node.fullLink"
        :href="node.fullLink"
        class="tree-link"
        :class="{ 'tree-link-leaf': !hasChildren(node) }"
      >
        <span class="tree-status" :class="`status-${node.status}`">
          {{ getStatusEmoji(node.status) }}
        </span>
        <span class="tree-title">{{ getDisplayTitle(node) }}</span>
      </a>

      <button
        v-else-if="hasChildren(node)"
        type="button"
        class="tree-link tree-link-folder"
        :title="isExpanded(node) ? '折叠分组' : '展开分组'"
        @click="onToggle(node)"
      >
        <span class="tree-title">{{ getDisplayTitle(node) }}</span>
      </button>

      <button
        v-if="node.relativePath"
        class="vscode-article"
        type="button"
        :title="openNoteTitle"
        @click="onOpenVscode(node, $event)"
      >
        <img :src="localIdeIcon" :alt="openNoteTitle" />
      </button>
    </div>

    <FolderTreeItems
      v-if="hasChildren(node) && isExpanded(node)"
      :nodes="node.children"
      :depth="depth + 1"
      :show-number="showNumber"
      :expanded-keys="expandedKeys"
      @toggle-node="emit('toggle-node', $event)"
      @open-vscode="emit('open-vscode', $event)"
    />
  </div>
</template>

<script>
export default {
  name: 'FolderTreeItems',
}
</script>

<style scoped lang="scss">
.tree-node {
  margin-bottom: 3px;
}

.tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 48px;
  padding: 3px 9px;
  border-radius: 6px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--vp-c-default-soft);

    .tree-link {
      color: var(--vp-c-brand-1);
    }
  }
}

.tree-arrow-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}

.tree-arrow-placeholder {
  flex: 0 0 20px;
  width: 20px;
}

.tree-arrow {
  display: inline-flex;
  width: 14px;
  height: 14px;
  transition: transform 0.25s;
}

.tree-arrow:not(.collapsed) {
  transform: rotate(90deg);
}

.tree-arrow img {
  width: 14px;
  height: 14px;
  display: block;
}

.tree-link {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-size: 0.9rem;
  overflow: hidden;
  transition: color 0.2s;
}

.tree-link-leaf .tree-title {
  font-weight: 400;
}

.tree-row-parent .tree-link {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.tree-link-folder {
  cursor: pointer;
  font-weight: 600;
  color: var(--vp-c-text-1);
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  font: inherit;
}

.tree-status {
  flex-shrink: 0;
  width: 1.4rem;
  margin-right: 0.4rem;
  text-align: center;
  font-size: 0.85rem;
}

.tree-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vscode-article {
  background: none;
  border: none;
  padding: 0.3rem;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.2s ease;

  &:hover {
    opacity: 1;
    background-color: var(--vp-c-bg-soft-down);
  }

  img {
    display: block;
    height: 1rem;
    width: 1rem;
  }
}
</style>
