# VitePress 1.6.4 dependency-closure experiment

The reproducible scanner is `scripts/audit-vitepress-closure.mjs`. It was run
against the upstream VitePress `v1.6.4` checkout at commit
`1fc537b78cda287fa23c1129a815ad9455fd8106`.

Seeds:

- `src/node/markdown/markdown.ts`
- `src/client/app/router.ts`
- `src/node/contentLoader.ts`

Result: 16 runtime source modules, 2,321 source lines (including comments and
blank lines), 28 external packages, and zero unresolved literal imports. The
closure includes the VitePress route/data model and Markdown environment/plugin
contracts in addition to the three requested capabilities.

Decision: do not subtract from or fork VitePress. Although the static closure is
small enough to study, copying it would retain upstream-specific interfaces and
external coupling. `@tnotesjs/ssg` therefore implements the TNotes requirements
additively and uses the upstream checkout only as a behavioral reference.
