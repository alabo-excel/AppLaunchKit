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
 * - Google Play phone and Chromebook, and every Apple entry, are still from
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
    label: "iPhone",
    targetWidth: 1290,
    targetHeight: 2796,
    minWidth: 1242,
    maxWidth: 1320,
    minHeight: 2688,
    maxHeight: 2868,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
    notes: 'Accepted 6.5"/6.7" size. Apple also accepts 1320×2868 (6.9").',
  },
  {
    platform: "apple_app_store",
    deviceType: "iphone",
    orientation: "landscape",
    label: "iPhone",
    targetWidth: 2796,
    targetHeight: 1290,
    minWidth: 2688,
    maxWidth: 2868,
    minHeight: 1242,
    maxHeight: 1320,
    allowedFormats: ["png", "jpeg"],
    maxFileSize: null,
    maxAssets: 10,
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
