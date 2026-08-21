/**
 * Renders sample store assets from a source screenshot, straight to disk.
 *
 * Useful for eyeballing the asset engine without Supabase, auth, or the UI:
 *
 *   node scripts/render-preview.mjs ./my-screenshot.png ./out
 *
 * With no source it synthesises a placeholder phone screenshot.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createJiti } from "jiti";

// jiti lets this plain .mjs script import the app's TypeScript modules, `~/`
// aliases included, so the renderer is tested as the app actually uses it.
const appRoot = path.resolve(fileURLToPath(import.meta.url), "../../app");
const jiti = createJiti(import.meta.url, { alias: { "~": appRoot } });

const { renderAsset } = await jiti.import("../app/features/render/render.server.ts");
const { parseTemplateConfig } = await jiti.import("../app/features/templates/config.server.ts");

const TARGETS = [
  { name: "play-phone-portrait", width: 1080, height: 1920 },
  { name: "play-tablet7-portrait", width: 1440, height: 2560 },
  { name: "play-tablet10-portrait", width: 1620, height: 2880 },
  { name: "play-tablet10-landscape", width: 2880, height: 1620 },
  { name: "play-chromebook-landscape", width: 1920, height: 1080 },
  { name: "apple-iphone-portrait", width: 1290, height: 2796 },
  { name: "apple-ipad-portrait", width: 2048, height: 2732 },
];

const [sourceArg, outArg = "./.render-preview"] = process.argv.slice(2);
const outDir = path.resolve(outArg);
await mkdir(outDir, { recursive: true });

const source = sourceArg
  ? await sharp(path.resolve(sourceArg)).png().toBuffer()
  : await placeholderScreenshot();

const config = parseTemplateConfig({
  headline: "Put the Word First",
  backgroundColor: "#0F172A",
  textColor: "#F8FAFC",
});

for (const target of TARGETS) {
  const start = performance.now();
  const result = await renderAsset({
    source,
    width: target.width,
    height: target.height,
    config,
  });
  const file = path.join(outDir, `${target.name}.png`);
  await writeFile(file, result.buffer);
  console.log(
    `${target.name.padEnd(28)} ${String(result.width).padStart(4)}x${String(result.height).padEnd(4)}` +
      ` ${result.layoutMode.padEnd(13)} ${(result.buffer.byteLength / 1024).toFixed(0)}KB` +
      ` ${(performance.now() - start).toFixed(0)}ms`,
  );
}

console.log(`\nWrote ${TARGETS.length} assets to ${outDir}`);

async function placeholderScreenshot() {
  const width = 1080;
  const height = 1920;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#ffffff"/>
    <rect width="${width}" height="220" fill="#111827"/>
    ${Array.from({ length: 7 }, (_, i) => {
      const y = 320 + i * 210;
      return `<rect x="72" y="${y}" width="936" height="160" rx="24" fill="#F3F4F6"/>
              <rect x="104" y="${y + 32}" width="${420 + ((i * 97) % 300)}" height="28" rx="14" fill="#9CA3AF"/>
              <rect x="104" y="${y + 84}" width="${260 + ((i * 61) % 400)}" height="22" rx="11" fill="#D1D5DB"/>`;
    }).join("")}
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
