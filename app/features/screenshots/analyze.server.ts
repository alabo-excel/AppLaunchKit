import sharp, { type Metadata } from "sharp";

import { formatBytes } from "~/lib/format";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB, matching Google Play
export const SUPPORTED_FORMATS = ["png", "jpeg", "webp"] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/** Shortest side below which a source will visibly degrade when upscaled. */
export const RECOMMENDED_MIN_SHORT_SIDE = 1080;
/** Shortest side below which the source is unusable. */
export const ABSOLUTE_MIN_SHORT_SIDE = 320;

export type ImageAnalysis = {
  width: number;
  height: number;
  format: SupportedFormat;
  fileSize: number;
  orientation: "portrait" | "landscape" | "square";
  /** Long side / short side, rounded to 3 decimals. */
  aspectRatio: number;
};

export type ValidationIssue = {
  level: "error" | "warning";
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export class UnsupportedImageError extends Error {}

export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new UnsupportedImageError(
      "We couldn't read this image. Upload a PNG, JPG, or WEBP file.",
    );
  }

  const { width, height, format } = metadata;

  if (!width || !height) {
    throw new UnsupportedImageError(
      "We couldn't read this image's dimensions. Upload a PNG, JPG, or WEBP file.",
    );
  }

  if (!isSupportedFormat(format)) {
    throw new UnsupportedImageError(
      "This file type isn't supported. Upload PNG, JPG, or WEBP.",
    );
  }

  return {
    width,
    height,
    format,
    fileSize: buffer.byteLength,
    orientation:
      width === height ? "square" : height > width ? "portrait" : "landscape",
    aspectRatio:
      Math.round((Math.max(width, height) / Math.min(width, height)) * 1000) /
      1000,
  };
}

/**
 * Judges a source screenshot. Errors block the upload; warnings are shown but
 * let the user proceed — a 720p source still generates a usable asset, just not
 * a great one.
 */
export function validateSource(analysis: ImageAnalysis): ValidationResult {
  const issues: ValidationIssue[] = [];
  const shortSide = Math.min(analysis.width, analysis.height);

  if (analysis.fileSize > MAX_UPLOAD_BYTES) {
    issues.push({
      level: "error",
      message: `This file is ${formatBytes(analysis.fileSize)}. The limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`,
    });
  }

  if (shortSide < ABSOLUTE_MIN_SHORT_SIDE) {
    issues.push({
      level: "error",
      message: `This image is only ${analysis.width} × ${analysis.height}. Store assets need at least ${ABSOLUTE_MIN_SHORT_SIDE}px on the short side.`,
    });
  } else if (shortSide < RECOMMENDED_MIN_SHORT_SIDE) {
    issues.push({
      level: "warning",
      message: `This screenshot may produce a low-quality store asset. Your image is ${analysis.width} × ${analysis.height}; ${RECOMMENDED_MIN_SHORT_SIDE}px or more on the short side is recommended.`,
    });
  }

  return { valid: !issues.some((issue) => issue.level === "error"), issues };
}

export function isSupportedFormat(value: unknown): value is SupportedFormat {
  return SUPPORTED_FORMATS.includes(value as SupportedFormat);
}

export function extensionFor(format: SupportedFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

export function mimeTypeFor(format: SupportedFormat): string {
  return `image/${format}`;
}
