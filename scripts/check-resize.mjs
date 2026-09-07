import assert from "node:assert/strict";
import sharp from "sharp";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
const jiti = createJiti(import.meta.url, { alias: { "~": fileURLToPath(new URL("../app", import.meta.url)) } });
const { renderAsset } = await jiti.import("../app/features/render/render.server.ts");
const { parseTemplateConfig } = await jiti.import("../app/features/templates/config.server.ts");
const source = await sharp({ create: { width: 100, height: 200, channels: 3, background: "#FF0000" } }).png().toBuffer();
for (const screenshotFit of ["cover", "contain"]) {
  const config = parseTemplateConfig({ exportMode: "resize", screenshotFit, headline: "This must not render", shadow: true, framePadding: 0.12, cornerRadius: 0.12, backgroundColor: "#00FF00" });
  const { buffer } = await renderAsset({ source, width: 200, height: 100, config });
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 200);
  assert.equal(info.height, 100);
  assert.deepEqual([...data.subarray(0, 3)], screenshotFit === "cover" ? [255, 0, 0] : [255, 255, 255]);
  const center = (50 * info.width + 100) * info.channels;
  assert.deepEqual([...data.subarray(center, center + 3)], [255, 0, 0]);
  const clean = await renderAsset({ source, width: 200, height: 100, config: { ...config, headline: "", shadow: false, framePadding: 0, cornerRadius: 0 } });
  assert(buffer.equals(clean.buffer), "Resize must ignore template decoration and captions");
}
assert.equal(parseTemplateConfig({ fontFamily: "Unavailable font" }).fontFamily, "sans-serif");
assert.equal(parseTemplateConfig({}).exportMode, "template");
console.log("Resize dimensions, fit, caption/decoration bypass, and legacy config defaults passed.");
