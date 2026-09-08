import type { Orientation, Platform, StoreTarget } from "./types";

const EIGHT_MB = 8 * 1024 * 1024;

/** Google Play accepts 16:9 or 9:16 for phone, tablet and Chromebook shots. */
const PLAY_ASPECT = { label: "16:9 or 9:16", value: 16 / 9 };

/**
 * Every target AppLaunchKit can generate.
 *
 * Provenance matters here, so it is recorded per entry:
 *
 * - Google Play 7-inch and 10-inch tablets are transcribed from the Play
 *   Console field help and are exact.
 * - iPhone dimensions match the four sizes supplied for this app.
 * - Google Play phone and Chromebook, and iPad entries, are still from
 *   general knowledge. Verify them against the live store documentation before
 *   relying on them.
 *
 * This module is the single place to change any of it.
 */
const TARGETS: Omit<StoreTarget, "id">[] = [
  {
    platform: "google_play",
    deviceType: "phone",
    orientation: "portrait",
    label: "Phone",
    targetWidth: 1080,
    targetHeight: 1920,
    minWidth: 320,
    maxWidth: 3840,
    minHeight: 320,
    maxHeight: 3840,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
    notes: "16:9 or 9:16, 320–3840px per side, max 8MB.",
  },
  {
    platform: "google_play",
    deviceType: "phone",
    orientation: "landscape",
    label: "Phone",
    targetWidth: 1920,
    targetHeight: 1080,
    minWidth: 320,
    maxWidth: 3840,
    minHeight: 320,
    maxHeight: 3840,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
  },
  {
    platform: "google_play",
    deviceType: "tablet_7",
    orientation: "portrait",
    label: "7-inch tablet",
    targetWidth: 1440,
    targetHeight: 2560,
    minWidth: 320,
    maxWidth: 3840,
    minHeight: 320,
    maxHeight: 3840,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
    notes:
      "Play Console: up to eight 7-inch tablet screenshots, PNG or JPEG, up to 8MB each, 16:9 or 9:16, each side 320–3,840px.",
  },
  {
    platform: "google_play",
    deviceType: "tablet_7",
    orientation: "landscape",
    label: "7-inch tablet",
    targetWidth: 2560,
    targetHeight: 1440,
    minWidth: 320,
    maxWidth: 3840,
    minHeight: 320,
    maxHeight: 3840,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
  },
  {
    platform: "google_play",
    deviceType: "tablet_10",
    orientation: "portrait",
    label: "10-inch tablet",
    targetWidth: 1620,
    targetHeight: 2880,
    minWidth: 1080,
    maxWidth: 7680,
    minHeight: 1080,
    maxHeight: 7680,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
    notes:
      "Play Console: up to eight 10-inch tablet screenshots, PNG or JPEG, up to 8MB each, 16:9 or 9:16, each side 1,080–7,680px.",
  },
  {
    platform: "google_play",
    deviceType: "tablet_10",
    orientation: "landscape",
    label: "10-inch tablet",
    targetWidth: 2880,
    targetHeight: 1620,
    minWidth: 1080,
    maxWidth: 7680,
    minHeight: 1080,
    maxHeight: 7680,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
  },
  {
    platform: "google_play",
    deviceType: "chromebook",
    orientation: "landscape",
    label: "Chromebook",
    targetWidth: 1920,
    targetHeight: 1080,
    minWidth: 1080,
    maxWidth: 3840,
    minHeight: 1080,
    maxHeight: 3840,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: EIGHT_MB,
    allowedAspectRatio: PLAY_ASPECT,
    maxAssets: 8,
    notes: "Chromebook listings expect landscape 16:9 assets.",
  },
  {
    platform: "apple_app_store",
    deviceType: "iphone",
    orientation: "portrait",
    label: "iPhone · 1242 × 2688",
    targetWidth: 1242,
    targetHeight: 2688,
    minWidth: 1242,
    maxWidth: 1242,
    minHeight: 2688,
    maxHeight: 2688,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: "Exact iPhone screenshot dimensions requested for this app.",
  },
  {
    platform: "apple_app_store",
    deviceType: "iphone",
    orientation: "landscape",
    label: "iPhone · 1242 × 2688",
    targetWidth: 2688,
    targetHeight: 1242,
    minWidth: 2688,
    maxWidth: 2688,
    minHeight: 1242,
    maxHeight: 1242,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: "Exact iPhone screenshot dimensions requested for this app.",
  },
  {
    platform: "apple_app_store",
    deviceType: "iphone_1284",
    orientation: "portrait",
    label: "iPhone · 1284 × 2778",
    targetWidth: 1284,
    targetHeight: 2778,
    minWidth: 1284,
    maxWidth: 1284,
    minHeight: 2778,
    maxHeight: 2778,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: "Exact iPhone screenshot dimensions requested for this app.",
  },
  {
    platform: "apple_app_store",
    deviceType: "iphone_1284",
    orientation: "landscape",
    label: "iPhone · 1284 × 2778",
    targetWidth: 2778,
    targetHeight: 1284,
    minWidth: 2778,
    maxWidth: 2778,
    minHeight: 1284,
    maxHeight: 1284,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: "Exact iPhone screenshot dimensions requested for this app.",
  },
  {
    platform: "apple_app_store",
    deviceType: "ipad",
    orientation: "portrait",
    label: "iPad",
    targetWidth: 2048,
    targetHeight: 2732,
    minWidth: 2048,
    maxWidth: 2064,
    minHeight: 2732,
    maxHeight: 2752,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: 'Accepted 12.9" size. Apple also accepts 2064×2752 (13").',
  },
  {
    platform: "apple_app_store",
    deviceType: "ipad",
    orientation: "landscape",
    label: "iPad",
    targetWidth: 2732,
    targetHeight: 2048,
    minWidth: 2732,
    maxWidth: 2752,
    minHeight: 2048,
    maxHeight: 2064,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
  },
];

export function targetId(
  platform: Platform,
  deviceType: string,
  orientation: Orientation,
): string {
  return `${platform}:${deviceType}:${orientation}`;
}

export const storeTargets: StoreTarget[] = TARGETS.map((target) => ({
  ...target,
  id: targetId(target.platform, target.deviceType, target.orientation),
}));

const byId = new Map(storeTargets.map((target) => [target.id, target]));

export function getStoreTarget(id: string): StoreTarget | undefined {
  return byId.get(id);
}

/** Resolves ids from an untrusted form body, dropping anything unrecognised. */
export function resolveStoreTargets(ids: string[]): StoreTarget[] {
  const seen = new Set<string>();
  const resolved: StoreTarget[] = [];

  for (const id of ids) {
    if (seen.has(id)) continue;
    const target = byId.get(id);
    if (target) {
      seen.add(id);
      resolved.push(target);
    }
  }

  // Keep the canonical order regardless of form field order.
  return storeTargets.filter((target) => seen.has(target.id));
}

/** Grouped for the picker: one block per platform, one row per device. */
export function groupTargetsByPlatform(): {
  platform: Platform;
  devices: { deviceType: string; label: string; targets: StoreTarget[] }[];
}[] {
  const platforms: Platform[] = ["google_play", "apple_app_store"];

  return platforms.map((platform) => {
    const devices = new Map<
      string,
      { deviceType: string; label: string; targets: StoreTarget[] }
    >();

    for (const target of storeTargets) {
      if (target.platform !== platform) continue;
      const existing = devices.get(target.deviceType);
      if (existing) {
        existing.targets.push(target);
      } else {
        devices.set(target.deviceType, {
          deviceType: target.deviceType,
          label: target.label,
          targets: [target],
        });
      }
    }

    return { platform, devices: [...devices.values()] };
  });
}
