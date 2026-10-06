import { readFile, writeFile } from "node:fs/promises";

const sourceFiles = [
  "config.js",
  "data-loader.js",
  "inflation.js",
  "rolling-returns.js",
  "tax.js",
  "simulation-engine.js",
  "analysis.js",
  "graph-domain.js",
  "historical-events.js",
  "playback-controller.js",
  "formatters.js",
  "graph-renderer.js",
  "app.js"
];

const parts = [];
for (const filename of sourceFiles) {
  let source = await readFile(new URL(`../js/${filename}`, import.meta.url), "utf8");
  source = source.replace(/^import\s+.*?;\s*$/gm, "").replace(/^export\s+/gm, "");
  parts.push(`\n// ---- ${filename} ----\n${source.trim()}\n`);
}

const banner = "// Generated from modular source files by scripts/build-browser-bundle.js. Do not edit manually.\n";
await writeFile(new URL("../js/app.bundle.js", import.meta.url), `${banner}(() => {\n"use strict";\n${parts.join("\n")}\n})();\n`, "utf8");
