import fs from "node:fs";
import path from "node:path";

import { getGithubPageUrl, getIgnoreList } from "./helpers";
import { ConfigManager } from "../../config/ConfigManager";
import { getTNotesMarkdownConfig } from "../markdown";

interface SidebarItem {
  text: string;
  link?: string;
  collapsed?: boolean;
  items?: SidebarItem[];
}

interface NotesSsgConfig {
  [key: string]: unknown;
}

export function defineNotesConfig(
  overrides: NotesSsgConfig = {},
): NotesSsgConfig {
  const root = process.cwd();
  ConfigManager.init({ rootPath: root });
  const config = ConfigManager.getInstance().getAll();
  const markdown = getTNotesMarkdownConfig();
  const githubPageUrl = getGithubPageUrl(config);
  const sidebarPath = path.join(root, "sidebar.json");
  const sidebar = fs.existsSync(sidebarPath)
    ? (JSON.parse(fs.readFileSync(sidebarPath, "utf8")) as SidebarItem[])
    : [];

  return {
    root,
    base: `/${config.repoName}/`,
    title: config.repoName,
    description: config.root_item.details || config.repoName,
    lang: "zh-Hans",
    port: config.port,
    outDir: ".tnotes/dist",
    cacheDir: "node_modules/.tnotes-ssg",
    ignore: getIgnoreList(config),
    ignoreDeadLinks: true,
    sidebar,
    nav: config.menuItems,
    theme: "@tnotesjs/core/ssg/theme",
    head: [
      ["meta", { name: "keywords", content: config.keywords.join(", ") }],
      ["meta", { name: "author", content: config.author }],
      ["link", { rel: "canonical", href: githubPageUrl }],
      ["link", { rel: "icon", href: `${githubPageUrl}favicon.ico` }],
    ],
    markdown: {
      lineNumbers: markdown.lineNumbers !== false,
      math: markdown.math !== false,
      slugify: markdown.anchor?.slugify,
      imageLazyLoading: markdown.image?.lazyLoading !== false,
      configure: markdown.config,
    },
    ...overrides,
  };
}
