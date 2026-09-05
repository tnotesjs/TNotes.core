# Frozen VitePress baseline

This directory is a buildable time capsule, not the active TNotes site engine.
The active implementation is the additive `@tnotesjs/ssg` package.

Pinned baseline (2026-09-05): Node 22.22.0, pnpm 10.17.1,
VitePress 1.6.4, its Vite 5.4.21 and Shiki 2.5.0 pipeline, Vue 3.5.31,
Mermaid 11.13.0 and markdown-it-mathjax3 4.3.2. The lockfile is committed.

Build the image from this directory and mount a legacy knowledge base:

```sh
docker build -t tnotes-vitepress-1.6.4 .
docker run --rm -v "$PWD:/workspace" tnotes-vitepress-1.6.4
```

All legacy framework changes must be represented by a committed pnpm patch in
`patches/`. Five patches trigger review; eight patches are a hard stop for new
legacy customization. Run `pnpm audit:vitepress` once a year and record the
result in `audits/YYYY-MM-DD.md`.
