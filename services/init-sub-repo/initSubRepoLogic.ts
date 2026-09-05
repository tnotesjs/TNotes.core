/**
 * services/init-sub-repo/initSubRepoLogic.ts
 *
 * 子知识库初始化纯函数（便于测试）
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

import { getDefaultConfig } from "../../config/defaultConfig";
import {
  generateNoteTitle,
  getNewNoteReadmeBody,
} from "../../config/templates";

import type { NoteConfig, TNotesConfig } from "../../types";

export const TOPIC_PATTERN = /^[a-z][a-z0-9-]*$/;
export const DEFAULT_PORT = 8000;
export const DEFAULT_DESCRIPTION =
  "这是一个基于 tnotesjs/core 搭建的 TNotes 知识库。";
export const GITHUB_ORG = "tnotesjs";
export const TNOTES_ROOT_URL = "https://tnotesjs.github.io/TNotes";

/** 静态模板文件（相对 templates/sub-repo/） */
export const STATIC_TEMPLATE_FILES = [
  ".github/workflows/deploy.yml",
  ".tnotes/config.mts",
  ".vscode/settings.json",
  ".vscode/tnotes.code-snippets",
  "public/logo.png",
  "public/favicon.ico",
  ".gitattributes",
  ".gitignore",
  "tsconfig.json",
] as const;

export interface InitSubRepoInput {
  topic: string;
  displayName: string;
  port: number;
  description: string;
  repoUuid: string;
  noteUuid: string;
  coreVersion: string;
}

export interface InitSubRepoContext extends InitSubRepoInput {
  repoName: string;
  noteTitle: string;
  noteDirName: string;
}

export interface PackageJsonTemplate {
  type: "module";
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface InitSubRepoWriteResult {
  created: string[];
  skipped: string[];
  updated: string[];
}

export function buildRepoName(topic: string): string {
  return `TNotes.${topic}`;
}

export function defaultDisplayName(topic: string): string {
  const label = topic.charAt(0).toUpperCase() + topic.slice(1);
  return `${label} 笔记`;
}

export function validateTopic(topic: string): string | null {
  const trimmed = topic.trim();
  if (!trimmed) return "topic 不能为空";
  if (!TOPIC_PATTERN.test(trimmed)) {
    return "topic 须以小写字母开头，仅含小写字母、数字、连字符";
  }
  return null;
}

export function validatePort(raw: string): { port: number; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { port: DEFAULT_PORT };

  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    return {
      port: DEFAULT_PORT,
      error: "端口须为 1024–65535 之间的整数，已使用默认值 8000",
    };
  }
  return { port };
}

export function buildInitContext(input: InitSubRepoInput): InitSubRepoContext {
  const repoName = buildRepoName(input.topic);
  const noteTitle = repoName;
  const noteDirName = `0001. ${noteTitle}`;

  return {
    ...input,
    repoName,
    noteTitle,
    noteDirName,
  };
}

export function buildTNotesConfig(ctx: InitSubRepoContext): TNotesConfig {
  const config = getDefaultConfig(ctx.repoName);

  config.id = ctx.repoUuid;
  config.port = ctx.port;
  config.root_item = {
    ...config.root_item,
    title: ctx.topic,
    details: ctx.displayName,
    link: `https://tnotesjs.github.io/${ctx.repoName}/`,
  };
  config.menuItems = [
    { text: "🏠 Home", link: "/" },
    { text: "⚙️ Settings", link: "/Settings" },
    { text: "📒 TNotes", link: TNOTES_ROOT_URL },
    {
      text: "📂 TNotes.yuque",
      link: "https://www.yuque.com/tdahuyou/tnotes.yuque",
    },
  ];

  return config;
}

export function buildNoteConfig(noteUuid: string): NoteConfig {
  return {
    id: noteUuid,
    bilibili: [],
    tnotes: [],
    yuque: [],
    done: false,
    enableDiscussions: false,
    description: "",
  };
}

export function buildRepoNotesUrl(repoName: string): string {
  return `https://github.com/${GITHUB_ORG}/${repoName}/tree/main/notes`;
}

export function renderFirstNoteReadme(ctx: InitSubRepoContext): string {
  const noteTitle = generateNoteTitle(
    "0001",
    ctx.noteTitle,
    buildRepoNotesUrl(ctx.repoName),
  );
  return `${noteTitle}\n${getNewNoteReadmeBody()}`;
}

export function renderIndexMd(ctx: InitSubRepoContext): string {
  return `---
layout: home

hero:
  name: '${ctx.displayName}'
  image:
    src: /logo.png
    alt: TNotes logo
---

<SidebarCard pending />
`;
}

export function renderTocMd(ctx: InitSubRepoContext): string {
  return `- [ ] 0001. ${ctx.noteTitle}\n`;
}

export function renderRootReadme(ctx: InitSubRepoContext): string {
  return `# ${ctx.repoName}\n\n${ctx.description}\n`;
}

export function buildPackageJsonTemplate(
  coreVersion: string,
): PackageJsonTemplate {
  return {
    type: "module",
    scripts: {
      "tn:build": "tnotes --build",
      "tn:create-notes": "tnotes --create-notes",
      "tn:dev": "tnotes --dev",
      "tn:help": "tnotes --help",
      "tn:init-sub-repo": "tnotes --init-sub-repo",
      "tn:preview": "tnotes --preview",
      "tn:pull": "tnotes --pull",
      "tn:push": "tnotes --push",
      "tn:update": "tnotes --update",
      "tn:update-completed-count": "tnotes --update-completed-count",
    },
    dependencies: {
      "@tnotesjs/core": `^${coreVersion}`,
      "@tnotesjs/ssg": "^0.1.0",
    },
    devDependencies: { vue: "3.5.41" },
  };
}

export function mergePackageJson(
  existing: Record<string, unknown>,
  template: PackageJsonTemplate,
): Record<string, unknown> {
  return {
    ...existing,
    type: template.type,
    scripts: template.scripts,
    dependencies: template.dependencies,
    devDependencies: template.devDependencies,
  };
}

export interface DynamicFileSpec {
  relativePath: string;
  content: string;
}

export function buildDynamicFiles(ctx: InitSubRepoContext): DynamicFileSpec[] {
  return [
    {
      relativePath: ".tnotes.json",
      content: `${JSON.stringify(buildTNotesConfig(ctx), null, 2)}\n`,
    },
    {
      relativePath: "package.json",
      content: `${JSON.stringify(buildPackageJsonTemplate(ctx.coreVersion), null, 2)}\n`,
    },
    {
      relativePath: "index.md",
      content: renderIndexMd(ctx),
    },
    {
      relativePath: "TOC.md",
      content: renderTocMd(ctx),
    },
    {
      relativePath: "README.md",
      content: renderRootReadme(ctx),
    },
    {
      relativePath: join("notes", ctx.noteDirName, "README.md"),
      content: renderFirstNoteReadme(ctx),
    },
    {
      relativePath: join("notes", ctx.noteDirName, ".tnotes.json"),
      content: `${JSON.stringify(buildNoteConfig(ctx.noteUuid), null, 2)}\n`,
    },
  ];
}

export function isAlreadyInitialized(rootPath: string): boolean {
  return existsSync(resolve(rootPath, ".tnotes.json"));
}

export function getInitializedConfigPath(rootPath: string): string {
  return resolve(rootPath, ".tnotes.json");
}

export function resolvePackageJsonMerge(
  targetPath: string,
  template: PackageJsonTemplate,
): { content: string; action: "created" | "updated" } {
  if (!existsSync(targetPath)) {
    return {
      content: `${JSON.stringify(template, null, 2)}\n`,
      action: "created",
    };
  }

  const existing = JSON.parse(readFileSync(targetPath, "utf-8")) as Record<
    string,
    unknown
  >;
  const merged = mergePackageJson(existing, template);
  return {
    content: `${JSON.stringify(merged, null, 2)}\n`,
    action: "updated",
  };
}

export function buildManualSteps(ctx: InitSubRepoContext): string[] {
  return [
    "pnpm install — package.json 已更新，需重装依赖",
    `创建 GitHub 仓库 https://github.com/${GITHUB_ORG}/${ctx.repoName}（若尚未创建）`,
    "git init / git remote add origin（若尚未关联远程）",
    "GitHub Pages：Settings → Build and deployment → Source 选 GitHub Actions",
    "Repository secret：添加 TNOTES_DISPATCH_TOKEN（供 deploy.yml notify job 回调根库）",
    `主题图标（可选）：确认 CDN 存在 icon--${ctx.topic}.svg，否则替换 .tnotes.json 中 root_item.icon.src`,
    "本地验证：pnpm tn:dev",
    "首次发布：push 到 main 触发 deploy workflow",
  ];
}
