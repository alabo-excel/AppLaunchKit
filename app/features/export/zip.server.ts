import { zipSync } from "fflate";

import {
  readGenerated,
  type StoredAsset,
  type StoredScreenshot,
} from "~/features/storage/local-store.server";
import { getStoreTarget } from "~/features/store/requirements";
import { PLATFORM_DIRS, deviceDir, type Platform } from "~/features/store/types";

export type ExportEntry = { path: string; asset: StoredAsset };

/**
 * Plans the archive layout: one folder per store, one per device/orientation,
 * and `screenshot-N.png` following the order the user arranged upstairs.
 *
 * The orientation is part of the folder name, unlike the PRD sketch — a
 * `phone/` folder holding both portrait and landscape assets can't name them
 * both `screenshot-1.png`.
 */
export function planExport(
  screenshots: StoredScreenshot[],
  assets: StoredAsset[],
): ExportEntry[] {
  const position = new Map(
    screenshots.map((screenshot, index) => [screenshot.id, index + 1]),
  );

  const entries: ExportEntry[] = [];

  for (const asset of assets) {
    const index = position.get(asset.screenshotId);
    if (index === undefined) continue; // Source screenshot was deleted.

    const platformDir =
      PLATFORM_DIRS[asset.platform as Platform] ?? asset.platform;
    const folder = `${platformDir}/${deviceDir(asset.deviceType)}-${asset.orientation}`;
    entries.push({ path: `${folder}/screenshot-${index}.png`, asset });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Builds the ZIP in memory. Assets are already-compressed PNGs, so the archive
 * stores them rather than spending time deflating incompressible data.
 */
export async function buildExportZip(
  sessionId: string,
  screenshots: StoredScreenshot[],
  assets: StoredAsset[],
): Promise<{ buffer: Buffer; fileCount: number } | null> {
  const entries = planExport(screenshots, assets);
  if (entries.length === 0) return null;

  const files: Record<string, Uint8Array> = {};

  for (const entry of entries) {
    try {
      files[entry.path] = new Uint8Array(
        await readGenerated(sessionId, entry.asset.id),
      );
    } catch {
      // A missing file shouldn't sink the whole export.
    }
  }

  const fileCount = Object.keys(files).length;
  if (fileCount === 0) return null;

  files["MANIFEST.txt"] = new TextEncoder().encode(
    buildManifest(entries.filter((entry) => files[entry.path])),
  );

  const zipped = zipSync(files, { level: 0 });
  return { buffer: Buffer.from(zipped), fileCount };
}

function buildManifest(entries: ExportEntry[]): string {
  const lines = [
    "AppLaunchKit export",
    `Generated: ${new Date().toISOString()}`,
    `Assets: ${entries.length}`,
    "",
  ];

  for (const entry of entries) {
    const target = getStoreTarget(entry.asset.targetId);
    lines.push(
      `${entry.path}  ${entry.asset.width}x${entry.asset.height}` +
        (target ? `  ${target.label} ${target.orientation}` : ""),
    );
  }

  lines.push(
    "",
    "Verify these sizes against the current Google Play and App Store",
    "requirements before you upload them.",
  );

  return lines.join("\n");
}
