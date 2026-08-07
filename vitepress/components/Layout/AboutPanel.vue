<!-- 
vitepress/components/Layout/AboutPanel.vue 
-->

<template>
  <div class="timeModalContent">
    <!-- 笔记编号（仅笔记页显示） -->
    <div
      class="timeLine"
      v-if="!isHomeReadme && currentNoteId"
      title="笔记编号"
    >
      <div class="timeLabel">
        <strong>🔢 笔记编号</strong>
      </div>
      <div class="timeValue">{{ currentNoteId }}</div>
    </div>

    <!-- 笔记标题（仅笔记页显示） -->
    <div
      class="timeLine"
      v-if="!isHomeReadme && currentNoteId"
      title="笔记标题"
    >
      <div class="timeLabel">
        <strong>📝 笔记标题</strong>
      </div>
      <div class="timeValue">
        <input
          v-model="editableNoteTitle"
          type="text"
          class="titleInput"
          :class="{ error: titleError }"
          :disabled="!isDev"
          @input="onTitleInput"
          @blur="onTitleBlur"
          placeholder="请输入笔记标题"
        />
        <div v-if="titleError" class="errorMessage">
          {{ titleError }}
        </div>
      </div>
    </div>

    <!-- 笔记简介（仅笔记页显示） -->
    <div
      class="timeLine"
      v-if="!isHomeReadme && currentNoteId"
      title="笔记简介"
    >
      <div class="timeLabel">
        <strong>📄 笔记简介</strong>
      </div>
      <div class="timeValue">
        <textarea
          v-model="editableDescription"
          class="descriptionInput"
          :disabled="!isDev"
          @input="onDescriptionInput"
          placeholder="请输入笔记的一句话简介（可选）"
          rows="2"
        />
      </div>
    </div>

    <!-- 笔记状态（仅笔记页显示且非开发环境只读） -->
    <div
      class="timeLine"
      v-if="!isHomeReadme && currentNoteId"
      title="笔记状态"
    >
      <div class="timeLabel">
        <strong>📝 完成状态</strong>
      </div>
      <div class="timeValue">
        <select
          v-model="editableNoteStatus"
          class="statusSelect"
          :disabled="!isDev"
          @change="onConfigChange"
        >
          <option :value="true">✅ 已完成</option>
          <option :value="false">⏰ 待处理</option>
        </select>
      </div>
    </div>

    <!-- 评论状态（仅笔记页显示且非开发环境只读） -->
    <div
      class="timeLine"
      v-if="!isHomeReadme && currentNoteId"
      title="评论状态"
    >
      <div class="timeLabel">
        <strong>🫧 评论状态</strong>
      </div>
      <div class="timeValue">
        <select
          v-model="editableDiscussionsEnabled"
          class="statusSelect"
          :disabled="!isDev"
          @change="onConfigChange"
        >
          <option :value="true">✅ 开启</option>
          <option :value="false">❌ 关闭</option>
        </select>
      </div>
    </div>

    <!-- GitHub -->
    <div
      class="timeLine"
      v-if="modalGithubUrl"
      :title="
        isHomeReadme ? '在 GitHub 中打开知识库' : '在 GitHub 中打开当前笔记'
      "
    >
      <div class="timeLabel">
        <strong>🔗 GitHub</strong>
      </div>
      <div class="timeValue">
        <a
          :href="modalGithubUrl"
          target="_blank"
          rel="noopener"
          class="githubLink"
        >
          {{
            isHomeReadme ? '在 GitHub 中打开知识库' : '在 GitHub 中打开当前笔记'
          }}
        </a>
      </div>
    </div>

    <!-- GitHub Page -->
    <div
      class="timeLine"
      v-if="modalGithubPageUrl"
      :title="
        isHomeReadme
          ? '在 GitHub Page 中打开知识库'
          : '在 GitHub Page 中打开当前笔记'
      "
    >
      <div class="timeLabel">
        <strong>🔗 GitHub Page</strong>
      </div>
      <div class="timeValue">
        <a
          :href="modalGithubPageUrl"
          target="_blank"
          rel="noopener"
          class="githubLink"
        >
          {{
            isHomeReadme
              ? '在 GitHub Page 中打开知识库'
              : '在 GitHub Page 中打开当前笔记'
          }}
        </a>
      </div>
    </div>

    <!-- 完成进度（仅首页显示） -->
    <div
      class="timeLine"
      v-if="isHomeReadme && completionPercentage !== null"
      title="笔记完成进度"
    >
      <div class="timeLabel">
        <strong>📊 完成进度</strong>
      </div>
      <div class="timeValue">
        {{ completionPercentage }}% ({{ doneNotesLen }} / {{ totalNotesLen }})
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  isHomeReadme: boolean
  currentNoteId: string | null
  isDev: boolean
  editableNoteTitle: string
  editableDescription: string
  editableNoteStatus: boolean
  editableDiscussionsEnabled: boolean
  titleError: string
  modalGithubUrl: string
  modalGithubPageUrl: string
  completionPercentage: number | null
  doneNotesLen: number
  totalNotesLen: number
}>()

const emit = defineEmits<{
  'update:editableNoteTitle': [value: string]
  'update:editableDescription': [value: string]
  'update:editableNoteStatus': [value: boolean]
  'update:editableDiscussionsEnabled': [value: boolean]
  'update:titleError': [value: string]
  titleInput: []
  titleBlur: []
  descriptionInput: []
  configChange: []
}>()

const editableNoteTitle = computed({
  get: () => props.editableNoteTitle,
  set: (value) => emit('update:editableNoteTitle', value),
})

const editableDescription = computed({
  get: () => props.editableDescription,
  set: (value) => emit('update:editableDescription', value),
})

const editableNoteStatus = computed({
  get: () => props.editableNoteStatus,
  set: (value) => emit('update:editableNoteStatus', value),
})

const editableDiscussionsEnabled = computed({
  get: () => props.editableDiscussionsEnabled,
  set: (value) => emit('update:editableDiscussionsEnabled', value),
})

function onTitleInput() {
  emit('titleInput')
}

function onTitleBlur() {
  emit('titleBlur')
}

function onDescriptionInput() {
  emit('descriptionInput')
}

function onConfigChange() {
  emit('configChange')
}
</script>

<style scoped lang="scss">
/* time-modal-content: 通用容器 */
.timeModalContent {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.25rem 0;
  font-size: 0.95rem;

  /* 每一行：移动端默认纵向排列（标签在上，值在下），在宽屏时变成左右两栏 */
  .timeLine {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    padding: 0.5rem;
    border-radius: 8px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: var(--vp-c-bg-soft);
    }
  }

  /* 标签（左侧） */
  .timeLabel {
    font-weight: 700;
    color: var(--vp-c-text);
    font-size: 0.98rem;

    strong {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
  }

  /* 值（右侧/下方） */
  .timeValue {
    color: var(--vp-c-text-2);
    font-size: 0.88rem;
    line-height: 1.35;
    word-break: break-word;
    font-family: var(--vp-font-family-mono);
  }

  /* GitHub 链接样式 */
  .githubLink {
    color: var(--vp-c-brand-1);
    text-decoration: none;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;

    &:hover {
      color: var(--vp-c-brand-2);
      text-decoration: underline;
    }
  }

  /* 状态选择框样式 */
  .statusSelect {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background-color: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 120px;

    &:hover:not(:disabled) {
      border-color: var(--vp-c-brand-1);
      background-color: var(--vp-c-bg-soft);
    }

    &:focus {
      outline: none;
      border-color: var(--vp-c-brand-1);
      box-shadow: 0 0 0 3px rgba(var(--vp-c-brand-rgb), 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    option {
      padding: 0.5rem;
      background-color: var(--vp-c-bg);
      color: var(--vp-c-text-1);
    }
  }

  /* 标题输入框样式 */
  .titleInput {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background-color: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
    font-family: inherit;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      border-color: var(--vp-c-brand-1);
      background-color: var(--vp-c-bg-soft);
    }

    &:focus {
      outline: none;
      border-color: var(--vp-c-brand-1);
      box-shadow: 0 0 0 3px rgba(var(--vp-c-brand-rgb), 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background-color: var(--vp-c-bg-soft);
    }

    &.error {
      border-color: var(--vp-c-danger-1);

      &:focus {
        box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
      }
    }
  }

  /* 错误提示样式 */
  .errorMessage {
    margin-top: 0.25rem;
    color: var(--vp-c-danger-1);
    font-size: 0.75rem;
  }

  /* 简介文本框样式 */
  .descriptionInput {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--vp-c-divider);
    border-radius: 6px;
    background-color: var(--vp-c-bg);
    color: var(--vp-c-text-1);
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    min-height: 3rem;
    transition: all 0.2s ease;

    &:hover:not(:disabled) {
      border-color: var(--vp-c-brand-1);
      background-color: var(--vp-c-bg-soft);
    }

    &:focus {
      outline: none;
      border-color: var(--vp-c-brand-1);
      box-shadow: 0 0 0 3px rgba(var(--vp-c-brand-rgb), 0.1);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background-color: var(--vp-c-bg-soft);
    }
  }
}

/* 宽屏样式：在 >=720px 时，改为左右两栏布局 */
@media (min-width: 720px) {
  .timeModalContent {
    gap: 1rem;

    .timeLine {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      gap: 1rem;
    }

    .timeLabel {
      width: 9.5rem;
      text-align: left;
      font-size: 1rem;
    }

    .timeValue {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

/* 更明显的可触控目标（移动端） */
@media (max-width: 520px) {
  .timeModalContent {
    gap: 0.9rem;

    .timeLabel {
      font-size: 1.02rem;
    }

    .timeValue {
      font-size: 1rem;
    }
  }
}
</style>
