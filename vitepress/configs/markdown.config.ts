import { getTNotesMarkdownConfig } from "../../ssg/markdown";

import type { MarkdownOptions } from "vitepress";

/** Legacy VitePress adapter. New builds consume `ssg/markdown` directly. */
export function getMarkdownConfig(): MarkdownOptions {
  return getTNotesMarkdownConfig() as MarkdownOptions;
}
