import { existsSync } from "node:fs";
import path from "node:path";
import sharp, {
  type CreateText,
  type OverlayOptions,
  type ResizeOptions,
  type Sharp,
} from "sharp";

import type { TemplateConfig } from "~/features/templates/types";
import { finalizeLayout, planLayout, type Layout, type Rect } from "./layout";

export type RenderInput = {
  /** The user's original screenshot. */
  source: Buffer;
  /** Target asset size, from `store_requirements`. */
  width: number;
  height: number;
  config: TemplateConfig;
};

export type RenderResult = {
  buffer: Buffer;
  width: number;
  height: number;
  layoutMode: Layout["mode"];
};

export class RenderError extends Error {}

/**
 * Composes one store asset.
 *
 * The source screenshot is fitted, never stretched: it keeps its aspect ratio
 * and is placed inside a composition sized for the target device. That is what
 * makes a phone screenshot usable as a tablet asset.
 */
export async function renderAsset(input: RenderInput): Promise<RenderResult> {
  const { source, width, height, config } = input;

  if (width < 1 || height < 1) {
    throw new RenderError(`Invalid target size: ${width}x${height}`);
  }

  const sourceMeta = await sharp(source).metadata();
  if (!sourceMeta.width || !sourceMeta.height) {
    throw new RenderError("Could not read the source screenshot's dimensions.");
  }

  const plan = planLayout({
    canvasWidth: width,
    canvasHeight: height,
    sourceWidth: sourceMeta.width,
    sourceHeight: sourceMeta.height,
    config,
  });

  const headline = config.headline.trim();
  const text = headline
    ? await renderText({
        text: headline,
        color: config.textColor,
        fontFamily: config.fontFamily,
        fontWeight: config.fontWeight,
        fontSize: plan.text.fontSize,
        maxWidth: plan.text.width,
        align: plan.text.align,
      })
    : null;

  const layout = finalizeLayout(plan, {
    textWidth: text?.width ?? 0,
    textHeight: text?.height ?? 0,
    sourceWidth: sourceMeta.width,
    sourceHeight: sourceMeta.height,
    config,
  });

  const layers: OverlayOptions[] = [];

  if (config.shadow) {
    const shadow = await renderShadow(
      layout.screenshotRect,
      layout.cornerRadius,
      width,
      height,
    );
    if (shadow) layers.push(shadow);
  }

  layers.push({
    input: await renderScreenshot(
      source,
      layout.screenshotRect,
      layout.screenshotFit,
      layout.cornerRadius,
    ),
    left: layout.screenshotRect.left,
    top: layout.screenshotRect.top,
  });

  if (text) {
    layers.push({
      input: text.buffer,
      left: layout.textRect.left,
      top: layout.textRect.top,
    });
  }

  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: hexToRgb(config.backgroundColor),
    },
  })
    .composite(layers)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return { buffer, width, height, layoutMode: layout.mode };
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

async function renderScreenshot(
  source: Buffer,
  rect: Rect,
  fit: Layout["screenshotFit"],
  cornerRadius: number,
): Promise<Buffer> {
  // cover: scale to fill the rect and crop the overflow, anchored to the top so
  //   the app's own header stays visible and the bottom is what gets cut.
  // contain: the rect already matches the source aspect ratio (see fitInside),
  //   so filling it exactly is a no-op resize rather than a stretch.
  const resize: ResizeOptions =
    fit === "cover"
      ? { fit: "cover", position: "top" }
      : { fit: "fill" };

  const resized = await sharp(source)
    .resize(rect.width, rect.height, resize)
    .ensureAlpha()
    .png()
    .toBuffer();

  if (cornerRadius <= 0) return resized;

  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">` +
      `<rect width="${rect.width}" height="${rect.height}" rx="${cornerRadius}" ry="${cornerRadius}" fill="#ffffff"/>` +
      `</svg>`,
  );

  return sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function renderShadow(
  rect: Rect,
  cornerRadius: number,
  canvasWidth: number,
  canvasHeight: number,
): Promise<OverlayOptions | null> {
  const shortSide = Math.min(rect.width, rect.height);
  const sigma = Math.max(1, Math.round(shortSide * 0.02));
  const spread = Math.ceil(sigma * 3);
  const offsetY = Math.round(shortSide * 0.015);

  const shadowWidth = rect.width + spread * 2;
  const shadowHeight = rect.height + spread * 2;

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${shadowWidth}" height="${shadowHeight}">` +
      `<rect x="${spread}" y="${spread}" width="${rect.width}" height="${rect.height}" ` +
      `rx="${cornerRadius}" ry="${cornerRadius}" fill="#000000" fill-opacity="0.22"/>` +
      `</svg>`,
  );

  const blurred = sharp(svg).blur(sigma);

  // The blur spreads past the screenshot on every side, so for a screenshot that
  // nearly fills the asset the shadow is larger than the canvas. libvips refuses
  // to composite an oversized layer, so clip it to what is actually visible.
  return placeClipped(blurred, shadowWidth, shadowHeight, {
    left: rect.left - spread,
    top: rect.top - spread + offsetY,
    canvasWidth,
    canvasHeight,
  });
}

/**
 * Positions a layer on the canvas, cropping whatever falls outside it.
 *
 * `composite` requires a layer no larger than the base and a non-negative
 * offset, so anything that overhangs an edge has to be trimmed here rather than
 * left for libvips to reject. Returns null when nothing would be visible.
 */
async function placeClipped(
  image: Sharp,
  imageWidth: number,
  imageHeight: number,
  placement: {
    left: number;
    top: number;
    canvasWidth: number;
    canvasHeight: number;
  },
): Promise<OverlayOptions | null> {
  const { left, top, canvasWidth, canvasHeight } = placement;

  const cropLeft = Math.max(0, -left);
  const cropTop = Math.max(0, -top);
  const destLeft = Math.max(0, left);
  const destTop = Math.max(0, top);

  const width = Math.min(imageWidth - cropLeft, canvasWidth - destLeft);
  const height = Math.min(imageHeight - cropTop, canvasHeight - destTop);

  if (width <= 0 || height <= 0) return null;

  const needsCrop =
    cropLeft > 0 || cropTop > 0 || width < imageWidth || height < imageHeight;

  const buffer = await (needsCrop
    ? image.extract({ left: cropLeft, top: cropTop, width, height })
    : image
  )
    .png()
    .toBuffer();

  return { input: buffer, left: destLeft, top: destTop };
}

type RenderedText = { buffer: Buffer; width: number; height: number };

async function renderText(input: {
  text: string;
  color: string;
  fontFamily: string;
  fontWeight: TemplateConfig["fontWeight"];
  fontSize: number;
  maxWidth: number;
  align: TemplateConfig["align"];
  opacity?: number;
}): Promise<RenderedText> {
  const alphaAttr =
    input.opacity === undefined ? "" : ` alpha="${Math.round(input.opacity * 100)}%"`;
  const markup =
    `<span foreground="${input.color}"${alphaAttr}>` +
    escapePango(input.text) +
    `</span>`;

  const textOptions: CreateText = {
    text: markup,
    font: pangoFontDescription(input.fontFamily, input.fontWeight, input.fontSize),
    width: input.maxWidth,
    align: input.align === "center" ? "centre" : input.align,
    rgba: true,
    wrap: "word",
  };

  const fontfile = resolveFontFile(input.fontFamily);
  if (fontfile) textOptions.fontfile = fontfile;

  const buffer = await sharp({ text: textOptions }).png().toBuffer();
  const metadata = await sharp(buffer).metadata();

  return {
    buffer,
    width: metadata.width ?? input.maxWidth,
    height: metadata.height ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEIGHT_TOKENS: Record<TemplateConfig["fontWeight"], string> = {
  regular: "",
  medium: " Medium",
  bold: " Bold",
};

/** Pango font description, e.g. `Inter Bold 63`. Size is px at the default 72dpi. */
function pangoFontDescription(
  family: string,
  weight: TemplateConfig["fontWeight"],
  size: number,
): string {
  return `${family}${WEIGHT_TOKENS[weight]} ${size}`;
}

const FONT_DIR = path.join(process.cwd(), "fonts");
const FONT_EXTENSIONS = [".ttf", ".otf", ".ttc", ".woff"];
const fontFileCache = new Map<string, string | null>();

/**
 * Renders identically on every machine when the font is bundled. Drop e.g.
 * `fonts/Inter.ttf` into the repo and Pango uses it instead of whatever the
 * host's fontconfig happens to resolve.
 */
function resolveFontFile(family: string): string | undefined {
  const cached = fontFileCache.get(family);
  if (cached !== undefined) return cached ?? undefined;

  const base = path.join(FONT_DIR, family.replaceAll(" ", ""));
  const match = FONT_EXTENSIONS.map((extension) => `${base}${extension}`).find(
    (candidate) => existsSync(candidate),
  );

  fontFileCache.set(family, match ?? null);
  return match;
}

function escapePango(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("'", "&apos;")
    .replaceAll('"', "&quot;");
}

function hexToRgb(hex: string): { r: number; g: number; b: number; alpha: number } {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    alpha: 1,
  };
}
