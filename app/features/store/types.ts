export type Platform = "google_play" | "apple_app_store";
export type Orientation = "portrait" | "landscape";
export type ImageFormat = "png" | "jpeg" | "webp";

/**
 * One store/device/orientation target.
 *
 * `targetWidth`/`targetHeight` are what AppLaunchKit renders; the min/max bounds
 * are what the store will accept.
 */
/** An aspect ratio a store accepts, expressed as long side ÷ short side. */
export type AspectRatio = { label: string; value: number };

export type StoreTarget = {
  /** Stable id, e.g. `google_play:tablet_7:portrait`. Used in URLs and forms. */
  id: string;
  platform: Platform;
  deviceType: string;
  orientation: Orientation;
  label: string;
  targetWidth: number;
  targetHeight: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  allowedFormats: ImageFormat[];
  /** Bytes. `null` when the store publishes no hard limit. */
  maxFileSize: number | null;
  /**
   * Omitted when the store states no aspect-ratio rule. Google Play requires
   * 16:9 or 9:16 for phone, tablet and Chromebook screenshots; Apple does not
   * publish an equivalent constraint.
   */
  allowedAspectRatio?: AspectRatio;
  /** Most screenshots the store accepts for this device. */
  maxAssets: number;
  notes?: string;
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  google_play: "Google Play",
  apple_app_store: "Apple App Store",
};

/** Directory name used for this platform inside a ZIP export. */
export const PLATFORM_DIRS: Record<Platform, string> = {
  google_play: "google-play",
  apple_app_store: "apple",
};

/** `tablet_7` -> `tablet-7`, for export paths and file names. */
export function deviceDir(deviceType: string): string {
  return deviceType.replaceAll("_", "-");
}
