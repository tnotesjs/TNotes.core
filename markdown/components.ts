export type TNotesComponentKind =
  | 'block-component'
  | 'inline-component'
  | 'container'
  | 'fenced-language'

export interface TNotesComponentDescriptor {
  name: string
  aliases?: string[]
  kind: TNotesComponentKind
  editable: 'visual' | 'source-only' | 'placeholder'
}

/**
 * Runtime-neutral registry shared by Desk and other TNotes clients. It does not
 * import Vue or VitePress and is therefore safe in Node/Electron workers.
 */
export const TNOTES_COMPONENTS: readonly TNotesComponentDescriptor[] = [
  {
    name: 'BilibiliOutsidePlayer',
    aliases: ['B'],
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'EnWordList',
    aliases: ['E'],
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'Footprints',
    aliases: ['F'],
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'NotesTable',
    aliases: ['N'],
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'Tooltip',
    kind: 'inline-component',
    editable: 'visual',
  },
  {
    name: 'MindmapPreview',
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'Mermaid',
    kind: 'block-component',
    editable: 'visual',
  },
  {
    name: 'Discussions',
    kind: 'block-component',
    editable: 'placeholder',
  },
  {
    name: 'SidebarCard',
    kind: 'block-component',
    editable: 'placeholder',
  },
  { name: 'swiper', kind: 'container', editable: 'visual' },
  { name: 'code-group', kind: 'container', editable: 'visual' },
  { name: 'details', kind: 'container', editable: 'visual' },
  { name: 'info', kind: 'container', editable: 'visual' },
  { name: 'tip', kind: 'container', editable: 'visual' },
  { name: 'warning', kind: 'container', editable: 'visual' },
  { name: 'danger', kind: 'container', editable: 'visual' },
  { name: 'mermaid', kind: 'fenced-language', editable: 'visual' },
  { name: 'mindmap', kind: 'fenced-language', editable: 'visual' },
  { name: 'markmap', kind: 'fenced-language', editable: 'visual' },
] as const

export function findTNotesComponent(
  name: string,
): TNotesComponentDescriptor | undefined {
  const normalized = name.toLowerCase()
  return TNOTES_COMPONENTS.find(
    (component) =>
      component.name.toLowerCase() === normalized ||
      component.aliases?.some((alias) => alias.toLowerCase() === normalized),
  )
}
