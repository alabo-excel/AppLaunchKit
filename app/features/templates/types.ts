export const TEMPLATE_KEYS = ["minimal"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type FontWeight = "regular" | "medium" | "bold";
export type TextAlign = "left" | "center" | "right";
export type ScreenshotFit = "cover" | "contain";

/**
 * Everything the renderer needs beyond the source image and target size.
 *
 * Sizes are fractions of the canvas rather than pixels, so one config renders
 * correctly at every store dimension — a 1080x1920 phone asset and a 2880x1620
 * landscape tablet asset come out visually consistent.
 *
 * Kept free of zod so the editor UI can import it without pulling a validator
 * into the browser bundle; parsing lives in `config.server.ts`.
 */
export type TemplateConfig = {
  templateKey: TemplateKey;
  headline: string;

  fontFamily: string;
  fontWeight: FontWeight;
  /** Headline size as a fraction of the canvas's short side. */
  headlineScale: number;
  align: TextAlign;

  backgroundColor: string;
  textColor: string;

  /**
   * `cover` fills the available frame, cropping whatever overflows — the usual
   * store-screenshot look. `contain` fits the whole screenshot inside the frame
   * with letterboxing, which is height-constrained in portrait and so leaves
   * wide side margins.
   */
  screenshotFit: ScreenshotFit;
  /** How much of the available box the screenshot fills. */
  screenshotScale: number;
  /** Corner radius as a fraction of the placed screenshot's short side. */
  cornerRadius: number;
  shadow: boolean;
};

export const defaultTemplateConfig: TemplateConfig = {
  templateKey: "minimal",
  headline: "",
  fontFamily: "Inter",
  fontWeight: "bold",
  headlineScale: 0.055,
  align: "center",
  backgroundColor: "#F4F4F5",
  textColor: "#111111",
  screenshotFit: "cover",
  screenshotScale: 1,
  cornerRadius: 0.035,
  shadow: true,
};
