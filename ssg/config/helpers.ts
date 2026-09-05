import type { TNotesConfig } from "../../types";

export function getIgnoreList(config: TNotesConfig): string[] {
  return config.ignore_dirs.map((directory) => `**/${directory}/**`);
}

export function getGithubPageUrl(config: TNotesConfig): string {
  return `https://${config.author.toLowerCase()}.github.io/${config.repoName}/`;
}
