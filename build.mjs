// Compile le site : src/app.jsx -> app.js (React inclus) et style.css (Tailwind).
// Usage : npm install && npm run build   (les fichiers générés sont à committer)
import { build } from "esbuild";
import { compile } from "tailwindcss";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

await build({
  entryPoints: ["src/app.jsx"],
  outfile: "app.js",
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "none",
});

// Tailwind : on génère uniquement les classes utilisées dans src/app.jsx
const source = readFileSync("src/app.jsx", "utf8");
const candidates = [...new Set(source.match(/[A-Za-z0-9_\-:\/.\[\]%#!&@]+/g) || [])];
const twDir = path.dirname(require.resolve("tailwindcss/package.json"));
const compiler = await compile('@import "tailwindcss";', {
  base: twDir,
  loadStylesheet: async (id, base) => {
    const file = id === "tailwindcss" ? path.join(twDir, "index.css") : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: readFileSync(file, "utf8") };
  },
});
writeFileSync("style.css", compiler.build(candidates));
console.log("OK : app.js + style.css générés");
