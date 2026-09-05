import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cwd = path.join(root, "legacy/vitepress");
const result = spawnSync("corepack", ["pnpm", "audit", "--prod"], {
  cwd,
  stdio: "inherit",
});
process.exitCode = result.status ?? 1;
