import { formatBytes } from "~/lib/format";

import type { StoreTarget } from "./types";

export type AssetCheck = {
  label: string;
  ok: boolean;
  detail?: string;
};

export type AssetValidation = {
  ready: boolean;
  checks: AssetCheck[];
};

/**
 * Validates a rendered asset against the store spec it was generated for.
 * Runs before an asset is offered for download, so nothing a store would reject
 * gets exported.
 */
export function validateGeneratedAsset(
  asset: { width: number; height: number; format: string; fileSize: number },
  target: StoreTarget,
): AssetValidation {
  const checks: AssetCheck[] = [];

  const dimensionsMatch =
    asset.width === target.targetWidth &&
    asset.height === target.targetHeight;
  checks.push({
    label: "Correct dimensions",
    ok: dimensionsMatch,
    detail: dimensionsMatch
      ? `${asset.width} × ${asset.height}`
      : `Got ${asset.width} × ${asset.height}, expected ${target.targetWidth} × ${target.targetHeight}`,
  });

  const withinBounds =
    asset.width >= target.minWidth &&
    asset.width <= target.maxWidth &&
    asset.height >= target.minHeight &&
    asset.height <= target.maxHeight;
  checks.push({
    label: "Within store limits",
    ok: withinBounds,
    detail: `${target.minWidth}–${target.maxWidth} × ${target.minHeight}–${target.maxHeight}`,
  });

  const expectedOrientation =
    asset.height > asset.width ? "portrait" : "landscape";
  const orientationMatches = expectedOrientation === target.orientation;
  checks.push({
    label: "Correct orientation",
    ok: orientationMatches,
    detail: orientationMatches ? target.orientation : expectedOrientation,
  });

  const formatAllowed = (target.allowedFormats as string[]).includes(
    asset.format,
  );
  checks.push({
    label: `${asset.format.toUpperCase()} format`,
    ok: formatAllowed,
    detail: formatAllowed
      ? undefined
      : `Allowed: ${target.allowedFormats.join(", ")}`,
  });

  if (target.maxFileSize !== null) {
    const withinSize = asset.fileSize <= target.maxFileSize;
    checks.push({
      label: "File size within limit",
      ok: withinSize,
      detail: `${formatBytes(asset.fileSize)} of ${formatBytes(target.maxFileSize)}`,
    });
  } else {
    checks.push({
      label: "File size",
      ok: true,
      detail: formatBytes(asset.fileSize),
    });
  }

  return { ready: checks.every((check) => check.ok), checks };
}
