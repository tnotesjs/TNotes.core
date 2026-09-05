// Static import graph of a pinned upstream checkout; never edits upstream files.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(process.argv[2] || "../reference/vitepress");
const seeds = [
  "src/node/markdown/markdown.ts",
  "src/client/app/router.ts",
  "src/node/contentLoader.ts",
];
const visited = new Map();
const external = new Set();
const unresolved = [];
function resolve(spec, from) {
  const base = spec.startsWith(".")
    ? path.resolve(path.dirname(from), spec)
    : spec.startsWith("@shared/")
      ? path.join(root, "src/shared", spec.slice(8))
      : null;
  if (!base) {
    external.add(spec);
    return null;
  }
  const candidates = [
    base,
    base.replace(/\.js$/, ".ts"),
    ...[".ts", ".tsx", ".vue", "/index.ts"].map((suffix) => base + suffix),
    path.join(base, `${path.basename(base)}.ts`),
  ];
  const found = candidates.find(
    (file) => fs.existsSync(file) && fs.statSync(file).isFile(),
  );
  if (!found && path.basename(base) === "shared") {
    const generatedShared = path.join(root, "src/shared/shared.ts");
    if (fs.existsSync(generatedShared)) return generatedShared;
  }
  if (!found) unresolved.push({ from: path.relative(root, from), spec });
  return found;
}
function visit(file) {
  if (visited.has(file)) return;
  const text = fs.readFileSync(file, "utf8");
  const edges = [];
  visited.set(file, {
    file: path.relative(root, file),
    lines: text.split("\n").length,
    imports: edges,
  });
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function walk(node) {
    let spec;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (!node.isTypeOnly && !node.importClause?.isTypeOnly)
        spec = node.moduleSpecifier?.text;
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      if (node.arguments[0] && ts.isStringLiteral(node.arguments[0]))
        spec = node.arguments[0].text;
    }
    if (spec) {
      const target = resolve(spec, file);
      if (target && /\.(?:ts|tsx|vue)$/.test(target)) {
        edges.push(path.relative(root, target));
        visit(target);
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(source);
}
for (const seed of seeds) visit(path.join(root, seed));
const modules = [...visited.values()].sort((a, b) =>
  a.file.localeCompare(b.file),
);
const report = {
  upstream: "https://github.com/vuejs/vitepress",
  version: "1.6.4",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  method:
    "TypeScript AST runtime imports/re-exports and literal dynamic imports; comments/types excluded. LOC includes blanks/comments. Runtime-computed imports listed as a limitation.",
  seeds,
  moduleCount: modules.length,
  lines: modules.reduce((sum, item) => sum + item.lines, 0),
  external: [...external].sort(),
  unresolved,
  modules,
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
