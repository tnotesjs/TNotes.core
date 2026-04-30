<template>
  <Layout>
    <template v-if="showNotFound" #not-found>
      <div class="not-found-container">
        <h1>404</h1>
        <p>Page not found</p>
        <!-- <div class="debug-info">
          <p>Current path: {{ decodedCurrentPath }}</p>
          <p>Matched ID: {{ matchedId }}</p>
          <p>Redirect path: {{ redirectPath }}</p>
        </div> -->layout
      </div>
    </template>
    <template #doc-top>
      <!-- <pre>vscodesNoteDir: {{ vscodeNotesDir }}</pre> -->
      <!-- <pre>vpData.page.value: {{ vpData.page.value }}</pre>
            <pre>currentNoteConfig: {{ currentNoteConfig }}</pre> -->
      <!-- <button @click="copyRawFile" title="Copy raw file">raw</button> -->
      <!-- <pre>{{ tocData }}</pre> -->
      <ImagePreview />
      <Swiper />
      <ContentCollapse />
    </template>
    <!-- <template #doc-bottom>doc-bottom</template> -->
    <template #doc-before>
      <DocBeforeControls
        :is-full-content-mode="isFullContentMode"
        :vscode-notes-dir="vscodeNotesDir"
        :is-home-readme="isHomeReadme"
        :current-note-id="currentNoteId"
        :created_at="created_at"
        :updated_at="updated_at"
        :home-readme-created-at="homeReadmeCreatedAt"
        :home-readme-updated-at="homeReadmeUpdatedAt"
        :time-modal-open="timeModalOpen"
        :all-collapsed="allCollapsed"
        @open-time-modal="openTimeModal"
        @toggle-all-collapse="toggleAllCollapse"
      />
      <!-- 笔记状态标题 -->
      <NoteStatus
        :note-config="currentNoteConfig"
        :is-notes-page="isNotesPage"
      />

      <AboutModal
        v-model="timeModalOpen"
        @close="onTimeModalClose"
        :title="modalTitle"
      >
        <template #title>
          {{ modalTitle }}
        </template>

        <AboutPanel
          :is-home-readme="modalIsHomeReadme"
          :current-note-id="modalNoteId"
          :is-dev="isDev"
          v-model:editable-note-title="editableNoteTitle"
          v-model:editable-description="editableDescription"
          v-model:editable-note-status="editableNoteStatus"
          v-model:editable-discussions-enabled="editableDiscussionsEnabled"
          v-model:title-error="titleError"
          :modal-created-at="modalCreatedAt"
          :modal-updated-at="modalUpdatedAt"
          :modal-github-url="modalGithubUrl"
          :modal-github-page-url="modalGithubPageUrl"
          :completion-percentage="completionPercentage"
          :done-notes-len="doneNotesLen"
          :total-notes-len="totalNotesLen"
          @title-input="onTitleInput"
          @title-blur="onTitleBlur"
          @description-input="onDescriptionInput"
          @config-change="onConfigChange"
        />

        <!-- 操作按钮（仅开发环境且非首页显示） -->
        <template #footer v-if="isDev && !modalIsHomeReadme">
          <div :class="$style.actionBar">
            <button
              :class="[
                $style.saveButton,
                { [$style.disabled]: !hasConfigChanges },
              ]"
              @click="saveNoteConfig"
              :disabled="!hasConfigChanges || isSaving"
              type="button"
            >
              {{ saveButtonText }}
            </button>
            <button
              v-if="hasConfigChanges"
              @click="resetNoteConfig"
              :class="$style.resetButton"
              type="button"
            >
              重置
            </button>
          </div>

          <!-- 保存进度提示 -->
          <Transition name="toast">
            <div v-if="isSaving && savingMessage" :class="$style.loadingToast">
              <div :class="$style.loadingSpinner"></div>
              <span>{{ savingMessage }}</span>
            </div>
          </Transition>

          <!-- 保存成功提示 -->
          <Transition name="toast">
            <div v-if="showSuccessToast" :class="$style.toast">✓ 保存成功</div>
          </Transition>
        </template>
      </AboutModal>
    </template>
    <template #doc-footer-before>
      <!-- <div class="footer-time-info">
        <p title="首次提交时间">首次提交时间：{{ formatDate(created_at) }}</p>
        <p title="最近提交时间">最近提交时间：{{ formatDate(updated_at) }}</p>
      </div> -->
    </template>
    <template #doc-after>
      <!-- 自定义 DocFooter -->
      <DocFooter />
      <!-- {{ REPO_NAME + '.' + currentNoteId }} -->
      <Discussions
        v-if="isDiscussionsVisible"
        :id="currentNoteConfig.id"
        :note-number="currentNoteId || ''"
        :note-title="currentNoteTitle"
      />
    </template>
    <!-- <template #doc-bottom>
            <Discussions id="TNotes.template.0003" />
        </template> -->

    <template #aside-top>
      <!-- aside-top -->
      <!-- {{ vpData.page.value.title }} -->
    </template>
    <!-- <template #aside-outline-before>
      <span
        @click="scrollToTop"
        style="cursor: pointer; height: 1em; width: 1em"
        title="回到顶部"
      >
        <img :src="icon__totop" alt="to top" />
      </span>
    </template> -->

    <!-- 使用 sidebar-nav-before 插槽插入控制按钮 -->
    <template #sidebar-nav-before>
      <SidebarNavBefore
        :is-expanded="allSidebarExpanded"
        :show-note-id="showNoteId"
        @toggle-expand="toggleSidebarSections"
        @toggle-note-id="toggleNoteId"
        @focus-current="focusCurrentNote"
      />
    </template>

    <!-- 使用 sidebar-nav-after 插槽插入自定义 Sidebar -->
    <template #sidebar-nav-after>
      <CustomSidebar
        ref="customSidebarRef"
        @open-note-about="openSidebarNoteAbout"
      />
    </template>
    <!-- <template #sidebar-nav-after>sidebar-nav-after</template> -->

    <!-- <template #aside-outline-after>aside-outline-after</template> -->
    <!-- <template #aside-bottom>aside-bottom</template> -->
    <!-- <template #aside-ads-before>aside-ads-before</template> -->
    <!-- <template #aside-ads-after>aside-ads-after</template> -->
    <!-- <template #layout-top>layout-top</template> -->
    <!-- <template #layout-bottom>layout-bottom</template> -->
    <!-- <template #nav-bar-title-before>nav-bar-title-before</template> -->
    <!-- <template #nav-bar-title-after>nav-bar-title-after</template> -->
    <!-- <template #nav-bar-content-before>nav-bar-content-before</template> -->
    <!-- 设置入口：固定在 VPNav 右侧（social-links / appearance 之后，extra 之前） -->
    <template #nav-bar-content-after>
      <NavBarSettingsTrigger />
    </template>

    <!-- !NOTE 不清楚下面的插槽所对应的位置 -->
    <!-- <template #nav-screen-content-before>nav-screen-content-before</template> -->
    <!-- <template #nav-screen-content-after>nav-screen-content-after</template> -->
  </Layout>

  <!-- 全局重命名遮罩：关于面板保存或文件系统重命名时由 useRenameOverlay 控制 -->
  <LoadingPage
    :visible="renameOverlayState.visible"
    :message="renameOverlayState.message"
    :tip="renameOverlayState.tip"
  />

  <!-- 全局设置 Dialog：由 useSettingsDialog 控制显隐 -->
  <SettingsDialog />
</template>

<script setup>
import { useData, useRoute, useRouter } from "vitepress";
import DefaultTheme from "vitepress/theme";
import { computed, onMounted, ref, watch } from "vue";

import { useCodeBlockFullscreen } from "../CodeBlockFullscreen";
import { SIDEBAR_SHOW_NOTE_ID_KEY } from "../constants";
import { data as allNotesConfig } from "../notesConfig.data.ts";
import AboutModal from "./AboutModal.vue";
import AboutPanel from "./AboutPanel.vue";
import Discussions from "../Discussions/Discussions.vue";
import LoadingPage from "../LoadingPage/LoadingPage.vue";
import { useCollapseControl } from "./composables/useCollapseControl";
import { useNoteConfig } from "./composables/useNoteConfig";
import { useNoteSave } from "./composables/useNoteSave";
import { useNoteValidation } from "./composables/useNoteValidation";
import { useRedirect } from "./composables/useRedirect";
import { useRenameOverlay } from "./composables/useRenameOverlay";
import { useVSCodeIntegration } from "./composables/useVSCodeIntegration";
import ContentCollapse from "./ContentCollapse.vue";
import CustomSidebar from "./CustomSidebar.vue";
import DocBeforeControls from "./DocBeforeControls.vue";
import DocFooter from "./DocFooter.vue";
import { data as readmeData } from "./homeReadme.data.ts";
import ImagePreview from "./ImagePreview.vue";
import NavBarSettingsTrigger from "./NavBarSettingsTrigger.vue";
import NoteStatus from "./NoteStatus.vue";
import SidebarNavBefore from "./SidebarNavBefore.vue";
import Swiper from "./Swiper.vue";
import SettingsDialog from "../Settings/SettingsDialog.vue";

const { Layout } = DefaultTheme;
const vpData = useData();
const router = useRouter();
const route = useRoute();

// 启用代码块全屏功能
useCodeBlockFullscreen();

// 全局重命名遮罩状态（由 useRenameRedirect 控制 show/hide）
const { state: renameOverlayState } = useRenameOverlay();

// 自定义侧边栏引用
const customSidebarRef = ref(null);
const showNoteId = ref(false);

// 计算是否有展开的一级章节
const allSidebarExpanded = computed(() => {
  if (!customSidebarRef.value) return false;
  return customSidebarRef.value.hasAnyFirstLevelExpanded();
});

// 初始化笔记编号显示状态
if (typeof window !== "undefined") {
  const savedShowNoteId = localStorage.getItem(SIDEBAR_SHOW_NOTE_ID_KEY);
  showNoteId.value = savedShowNoteId === "true";
}

// 切换侧边栏展开/折叠状态（智能切换）
function toggleSidebarSections() {
  if (customSidebarRef.value) {
    customSidebarRef.value.toggleExpandCollapse();
  }
}

// 切换笔记编号显示状态
function toggleNoteId() {
  showNoteId.value = !showNoteId.value;
  if (typeof window !== "undefined") {
    localStorage.setItem(SIDEBAR_SHOW_NOTE_ID_KEY, showNoteId.value.toString());
    // 刷新页面以应用变化
    window.location.reload();
  }
}

// 聚焦到当前笔记
function focusCurrentNote() {
  if (customSidebarRef.value) {
    customSidebarRef.value.focusCurrentNote();
  }
}

// 提取当前笔记的 ID（前 4 个数字）
const currentNoteId = computed(() => {
  const relativePath = vpData.page.value.relativePath;
  // relativePath 格式: notes/0001. 标题/README.md
  const match = relativePath.match(/notes\/(\d{4})/);
  const id = match ? match[1] : null;

  return id;
});

// 判断是否是笔记页面（notes 目录下）
const isNotesPage = computed(() => {
  return vpData.page.value.relativePath.startsWith("notes/");
});

// 提取当前笔记的标题（从 relativePath）
const currentNoteTitle = computed(() => {
  const relativePath = vpData.page.value.relativePath;
  // relativePath 格式: notes/0001. 标题/README.md
  const match = relativePath.match(/notes\/\d{4}\.\s+([^/]+)\//);
  const title = match ? match[1] : "";

  return title;
});

// 根据当前笔记 ID 获取配置数据
const currentNoteConfig = computed(() => {
  return currentNoteId.value && allNotesConfig[currentNoteId.value]
    ? allNotesConfig[currentNoteId.value]
    : {
        bilibili: [],
        done: false,
        enableDiscussions: false,
      };
});

function getEmptyNoteConfig() {
  return {
    bilibili: [],
    done: false,
    enableDiscussions: false,
  };
}

const isDiscussionsVisible = computed(
  () => currentNoteConfig.value.enableDiscussions,
);
const updated_at = computed(() => currentNoteConfig.value.updated_at);
const created_at = computed(() => currentNoteConfig.value.created_at);

// 判断是否为首页 README.md
const isHomeReadme = computed(() => vpData.page.value.filePath === "README.md");
const doneNotesLen = computed(() => readmeData?.doneNotesLen || 0);
const totalNotesLen = computed(() => readmeData?.totalNotesLen || 0);

// 完成进度百分比
const completionPercentage = computed(() => {
  if (!totalNotesLen.value || totalNotesLen.value === 0) return null;
  return Math.round((doneNotesLen.value / totalNotesLen.value) * 100);
});

// 首页 README.md 的时间戳
const homeReadmeCreatedAt = computed(() => readmeData?.created_at);
const homeReadmeUpdatedAt = computed(() => readmeData?.updated_at);

// #region - Composables
// 404 重定向
const { showNotFound, decodedCurrentPath, initRedirectCheck } =
  useRedirect(allNotesConfig);

// modal 控制
const timeModalOpen = ref(false);
const sidebarAboutNoteId = ref(null);

const modalIsHomeReadme = computed(
  () => !sidebarAboutNoteId.value && isHomeReadme.value,
);

const modalNoteId = computed(() => sidebarAboutNoteId.value || currentNoteId.value);

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getNoteFolderSegment(noteId) {
  if (!noteId) return "";

  const source =
    noteId === currentNoteId.value
      ? vpData.page.value.relativePath
      : allNotesConfig[noteId]?.redirect || "";
  const match = source.match(/notes\/([^/]+)\/README/);

  return match ? match[1] : "";
}

function getNoteTitleById(noteId) {
  const folderSegment = getNoteFolderSegment(noteId);
  const match = folderSegment.match(/^\d{4}\.\s+(.+)$/);

  return match ? safeDecode(match[1]) : "";
}

const modalNoteTitle = computed(() => {
  if (!sidebarAboutNoteId.value) return currentNoteTitle.value;
  return getNoteTitleById(sidebarAboutNoteId.value);
});

const modalNoteConfig = computed(() => {
  return modalNoteId.value && allNotesConfig[modalNoteId.value]
    ? allNotesConfig[modalNoteId.value]
    : getEmptyNoteConfig();
});

// 笔记配置管理
const {
  editableNoteStatus,
  editableDiscussionsEnabled,
  editableNoteTitle,
  editableDescription,
  titleError,
  hasConfigChanges,
  resetNoteConfig,
  updateOriginalValues,
} = useNoteConfig(
  modalNoteId,
  modalNoteConfig,
  modalNoteTitle,
  timeModalOpen,
);

// 标题验证
const { onTitleInput: validateTitleInput, onTitleBlur: validateTitleBlur } =
  useNoteValidation();

// 保存逻辑
const {
  isSaving,
  showSuccessToast,
  savingMessage,
  saveButtonText,
  saveNoteConfig,
} = useNoteSave(
  modalNoteId,
  computed(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }),
  hasConfigChanges,
  titleError,
  editableNoteTitle,
  computed(() => modalNoteTitle.value),
  editableNoteStatus,
  computed(() => modalNoteConfig.value.done || false),
  editableDiscussionsEnabled,
  computed(() => modalNoteConfig.value.enableDiscussions || false),
  editableDescription,
  computed(() => modalNoteConfig.value.description || ""),
  allNotesConfig,
  updateOriginalValues,
);

// 折叠控制
const { allCollapsed, toggleAllCollapse } = useCollapseControl();

// VSCode 集成
const { vscodeNotesDir, updateVscodeNoteDir, interceptHomeReadmeLinks } =
  useVSCodeIntegration();

// 判断是否为开发环境
const isDev = computed(() => {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
});

// #endregion

// modal 标题
const modalTitle = computed(() => {
  return modalIsHomeReadme.value ? "关于这个知识库" : "关于这篇笔记";
});

// modal 中显示的 GitHub 链接
const modalGithubUrl = computed(() => {
  if (modalIsHomeReadme.value) {
    const repoName = vpData.site.value.title.toLowerCase();
    return `https://github.com/tnotesjs/${repoName}`;
  }

  const folderSegment = getNoteFolderSegment(modalNoteId.value);
  if (!folderSegment) return "";

  const repoName = vpData.site.value.title.toLowerCase();
  return `https://github.com/tnotesjs/${repoName}/tree/main/notes/${encodeURIComponent(folderSegment)}`;
});

// modal 中显示的 GitHub Page 链接
const modalGithubPageUrl = computed(() => {
  if (modalIsHomeReadme.value) {
    const repoName = vpData.site.value.title; // 保持原始大小写
    return `https://tnotesjs.github.io/${repoName}/`;
  }
  // 笔记页面的 GitHub Page 链接
  const folderSegment = getNoteFolderSegment(modalNoteId.value);
  if (modalNoteId.value && folderSegment) {
    const repoName = vpData.site.value.title; // 保持原始大小写
    return `https://tnotesjs.github.io/${repoName}/notes/${encodeURIComponent(folderSegment)}/README`;
  }
  return "";
});

// modal 中显示的创建时间
const modalCreatedAt = computed(() => {
  return modalIsHomeReadme.value
    ? homeReadmeCreatedAt.value
    : modalNoteConfig.value.created_at;
});

// modal 中显示的更新时间
const modalUpdatedAt = computed(() => {
  return modalIsHomeReadme.value
    ? homeReadmeUpdatedAt.value
    : modalNoteConfig.value.updated_at;
});

function openTimeModal() {
  sidebarAboutNoteId.value = null;
  timeModalOpen.value = true;
}

function onTimeModalClose() {
  timeModalOpen.value = false;
  sidebarAboutNoteId.value = null;
}

function openSidebarNoteAbout(noteIndex) {
  sidebarAboutNoteId.value = noteIndex;
  timeModalOpen.value = true;
}

// 配置变更时的回调
function onConfigChange() {
  // 配置变更时不需要做额外操作，只需要触发 hasConfigChanges 计算
}

// 标题输入事件
function onTitleInput() {
  validateTitleInput(editableNoteTitle, titleError);
}

// 标题失焦事件
function onTitleBlur() {
  validateTitleBlur(editableNoteTitle, titleError);
}

// 简介输入事件
function onDescriptionInput() {
  // 简介没有特殊验证,只需要触发变更检测
}

// #region - 全屏状态检测
const isFullContentMode = ref(false);

function checkFullContentMode() {
  if (typeof document === "undefined") return;

  const vpApp = document.querySelector(".VPContent");
  if (vpApp) {
    const sidebar = document.querySelector(".VPSidebar");
    if (sidebar) {
      const sidebarDisplay = window.getComputedStyle(sidebar).display;
      isFullContentMode.value = sidebarDisplay === "none";
    }
  }
}
// #endregion

// 生命周期钩子
onMounted(() => {
  updateVscodeNoteDir();
  interceptHomeReadmeLinks(isHomeReadme, router);
  initRedirectCheck();

  if (typeof window !== "undefined") {
    checkFullContentMode();
    window.addEventListener("resize", checkFullContentMode);

    // 监听 VitePress 的侧边栏切换事件
    const observer = new MutationObserver(checkFullContentMode);
    const vpLayout = document.querySelector(".Layout");
    if (vpLayout) {
      observer.observe(vpLayout, {
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
  }
});

// 监听路由变化
watch(
  () => vpData.page.value.relativePath,
  () => {
    updateVscodeNoteDir();
    interceptHomeReadmeLinks(isHomeReadme, router);
  },
);

watch(
  () => route.path,
  () => {
    setTimeout(checkFullContentMode, 100);
  },
);
</script>

<style>
@import "../CodeBlockFullscreen/styles.css";

#VPSidebarNav > .group {
  display: none;
}
</style>

<style module src="./Layout.module.scss" scoped></style>
