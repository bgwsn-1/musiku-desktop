// Build CSS UI Musiku: @font-face (dari next/font) + globals.css asli
// + utility Tailwind yang dipindai dari komponen web & shell desktop.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../crates/server/ui/assets/app.css");
// Pakai entry JS langsung lewat node: shim .bin (shell script) gagal di
// Windows saat dipanggil spawnSync tanpa shell.
const cli = path.join(__dirname, "node_modules/@tailwindcss/cli/dist/index.mjs");

const watch = process.argv.includes("--watch");
const args = ["-i", path.join(__dirname, "tailwind.css"), "-o", OUT];
if (!watch) args.push("--minify");

if (!fs.existsSync(cli)) {
  console.error(`[css] CLI Tailwind tidak ditemukan: ${cli}`);
  process.exit(1);
}

const r = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit", cwd: __dirname });
if (r.status !== 0) process.exit(r.status ?? 1);

if (!watch) {
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  const css = fs.readFileSync(OUT, "utf8");
  const faces = (css.match(/@font-face/g) || []).length;
  console.log(`[css] built ${OUT} (${kb} KB, ${faces} @font-face)`);
}
