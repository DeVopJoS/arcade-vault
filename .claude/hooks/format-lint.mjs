import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = input?.tool_input?.file_path;
if (!file) process.exit(0);

const root = process.cwd();
const rel = path.relative(root, path.resolve(root, file));
if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
if (/(^|[\/])(node_modules|\.next|demos)[\/]/.test(rel)) process.exit(0);

const ext = path.extname(rel).slice(1);
const PRETTIER = ["ts", "tsx", "js", "jsx", "mjs", "json", "css", "md", "mdx"];
const ESLINT = ["ts", "tsx", "js", "jsx", "mjs"];
if (!PRETTIER.includes(ext)) process.exit(0);

const run = (args) =>
  spawnSync("npx", args, { cwd: root, encoding: "utf8", shell: true });

const p = run(["prettier", "--write", `"${rel}"`]);
if (p.status !== 0) {
  console.error(p.stdout + p.stderr);
  process.exit(2);
}

if (ESLINT.includes(ext)) {
  const e = run(["eslint", "--fix", `"${rel}"`]);
  if (e.status !== 0) {
    console.error(`ESLint errors in ${rel}:\n${e.stdout}${e.stderr}`);
    process.exit(2);
  }
}
