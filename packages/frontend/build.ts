//@ts-ignore
import input from "./tailwind.css" with { type: "text" };

import { TailwindCSSCollector } from "bun-tailwindcss/build";
import { rmSync, symlinkSync } from "node:fs";
import { join, relative } from "node:path";
import postcss from "postcss";
import nested from "postcss-nested";
//@ts-ignore
import csso from "postcss-csso";

using collector = new TailwindCSSCollector(input, import.meta.dir);

const outdir = join(import.meta.dir, "dist");
rmSync(outdir, { recursive: true, force: true });
const { outputs } = await Bun.build({
  entrypoints: ["src/main.tsx"],
  outdir,
  minify: false,
  sourcemap: "linked",
  throw: true,
  naming: { entry: "[hash].[ext]" },
});
const entrypoints: string[] = [];
for (const output of outputs) {
  if (output.kind === "entry-point") {
    entrypoints.push(relative(outdir, output.path));
  }
}
const raw = await collector.collect();
const { css } = await postcss([nested(), csso()]).process(raw, {
  from: undefined,
  map: false,
});
await Bun.file(join(outdir, "index.html")).write(
  buildHTML("APP", css, entrypoints)
);
symlinkSync(
  join(import.meta.dir, "node_modules/subsetted-fonts/MiSans-VF"),
  join(outdir, "font")
);

function buildHTML(title: string, css: string, entrypoints: string[]) {
  return [
    `<!doctype html>`,
    `<html lang="zh-Hans-CN">`,
    `<meta charset="UTF-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
    `<title>${Bun.escapeHTML(title)}</title>`,
    `<link rel="stylesheet" href="./font/MiSans-VF.css">`,
    `<style>${css}</style>`,
    `<div id="loader"></div>`,
    ...entrypoints.map(
      (src) => `<script src="${Bun.escapeHTML(src)}" type="module"></script>`
    ),
  ].join("");
}
