import "./styles.css";

import type { App } from "vue";

export interface NotesThemeContext {
  app: App;
}

export interface NotesTheme {
  enhanceApp?: (context: NotesThemeContext) => void;
}

export function defineNotesTheme(overrides: NotesTheme = {}): NotesTheme {
  return overrides;
}

export default defineNotesTheme();
