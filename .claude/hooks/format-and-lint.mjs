// Hook PostToolUse (Write|Edit): pasa Prettier y ESLint --fix al archivo escrito.
// En Node y no en bash+jq porque jq no está garantizado en Windows y Node sí
// (es un proyecto Next). Nunca sale con código != 0: un hook roto no debe
// romper la sesión.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../..");
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const DOC_EXT = new Set([".md", ".mdx"]);
const SKIP_DIRS = ["node_modules", ".next", "references"];

function runBin(pkg, binRelPath, args) {
  const bin = path.join(PROJECT_ROOT, "node_modules", pkg, binRelPath);
  if (!existsSync(bin)) return { status: 0, output: "" };
  const res = spawnSync(process.execPath, [bin, ...args], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return {
    status: res.status ?? 0,
    output: `${res.stdout ?? ""}${res.stderr ?? ""}`.trim(),
  };
}

try {
  const { readFileSync } = await import("node:fs");
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.exit(0);
  }

  const filePath =
    input?.tool_response?.filePath ?? input?.tool_input?.file_path;
  if (!filePath) process.exit(0);

  const abs = path.resolve(PROJECT_ROOT, filePath);
  const rel = path.relative(PROJECT_ROOT, abs);
  // Fuera del proyecto o en directorio excluido.
  if (rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
  const segments = rel.split(path.sep);
  if (segments.some((s) => SKIP_DIRS.includes(s))) process.exit(0);

  const ext = path.extname(abs).toLowerCase();
  const isCode = CODE_EXT.has(ext);
  if (!isCode && !DOC_EXT.has(ext)) process.exit(0);
  if (!existsSync(abs)) process.exit(0);

  runBin("prettier", path.join("bin", "prettier.cjs"), [
    "--write",
    "--ignore-unknown",
    rel,
  ]);

  if (isCode) {
    const eslint = runBin("eslint", path.join("bin", "eslint.js"), [
      "--fix",
      rel,
    ]);
    if (eslint.status !== 0 && eslint.output) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PostToolUse",
            additionalContext: `ESLint no pudo autofijar todo en ${rel}:\n${eslint.output}`,
          },
        }),
      );
    }
  }
} catch {
  // Silencio deliberado.
}
process.exit(0);
