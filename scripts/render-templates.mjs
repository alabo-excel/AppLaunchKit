import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  alias: { "~": fileURLToPath(new URL("../app", import.meta.url)) },
});
const { templates, applyTemplate } = await jiti.import("../app/features/templates/registry.ts");
const { parseTemplateConfig } = await jiti.import("../app/features/templates/config.server.ts");
const { renderAsset } = await jiti.import("../app/features/render/render.server.ts");
const out = new URL("../public/templates/", import.meta.url);
await mkdir(out, { recursive: true });
const source = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844">
  <rect width="390" height="844" fill="#FFFFFF"/>
  <text x="28" y="42" font-family="sans-serif" font-size="12" fill="#182827">9:41</text>
  <circle cx="345" cy="37" r="6" fill="#647C71"/>
  <text x="28" y="107" font-family="sans-serif" font-size="15" fill="#75867D">YOUR DAILY SPACE</text>
  <text x="28" y="151" font-family="sans-serif" font-size="32" font-weight="bold" fill="#182827">Hello, Alex.</text>
  <rect x="28" y="183" width="334" height="192" rx="22" fill="#DCEAE2"/>
  <circle cx="291" cy="248" r="44" fill="#B4CFC1"/>
  <text x="49" y="226" font-family="sans-serif" font-size="14" fill="#425E50">TODAY'S FOCUS</text>
  <text x="49" y="277" font-family="sans-serif" font-size="25" fill="#182827">Small steps,</text>
  <text x="49" y="309" font-family="sans-serif" font-size="25" fill="#182827">real progress.</text>
  <text x="28" y="421" font-family="sans-serif" font-size="21" font-weight="bold" fill="#182827">Made for your day</text>
  ${["Find a fresh perspective", "Build a little momentum", "Take time for yourself"].map((label, i) => `<rect x="28" y="${445 + i * 95}" width="334" height="78" rx="16" fill="#F3F6F4"/><circle cx="62" cy="${484 + i * 95}" r="16" fill="#CEDFD5"/><text x="93" y="${489 + i * 95}" font-family="sans-serif" font-size="15" fill="#32493C">${label}</text>`).join("")}
  <rect x="28" y="762" width="334" height="52" rx="26" fill="#243F32"/>
  <text x="195" y="795" text-anchor="middle" font-family="sans-serif" font-size="15" fill="#FFFFFF">Home      Explore      Profile</text>
</svg>`)).png().toBuffer();

for (const template of templates) {
  const config = parseTemplateConfig(template.config);
  assert.equal(applyTemplate(template.key, { ...config, headline: "My custom copy" }).headline, "My custom copy");
  for (const [width, height] of [[1080, 1920], [1920, 1080]]) {
    const result = await renderAsset({ source, width, height, config: { ...config, headline: config.headline || "Your app. Beautifully simple." } });
    const metadata = await sharp(result.buffer).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, height);
    if (height > width) {
      await writeFile(new URL(`${template.key}.png`, out), await sharp(result.buffer).resize(270, 480).png().toBuffer());
    }
  }
  console.log(`Rendered and verified ${template.name} in portrait and landscape`);
}
