import type { ScreenshotFit, TemplateConfig } from "~/features/templates/types";

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type LayoutMode = "stacked" | "side-by-side";

export type LayoutPlan = {
  mode: LayoutMode;
  canvasWidth: number;
  canvasHeight: number;
  /** Width the headline must be rendered at, and its font size in px. */
  text: {
    left: number;
    width: number;
    fontSize: number;
    align: TemplateConfig["align"];
  };
  /** The area the screenshot may occupy, before any aspect-preserving fit. */
  screenshotBox: Rect;
  /** Top inset of the headline block. Independent of the screenshot's inset. */
  textPaddingTop: number;
  /**
   * How far the screenshot is held off the canvas edges, in pixels. Zero means
   * full bleed, which is the default: a border of background colour around a
   * screenshot reads as wasted space on a store listing.
   */
  framePadding: number;
  gap: number;
};

export type Layout = LayoutPlan & {
  /** Final headline placement, alignment already applied. */
  textRect: Rect;
  /** Where the screenshot is drawn. */
  screenshotRect: Rect;
  /**
   * How the source fills `screenshotRect`. `cover` crops the overflow; the
   * aspect ratio is preserved either way — the source is never stretched.
   */
  screenshotFit: ScreenshotFit;
  cornerRadius: number;
};

/**
 * Decides the composition before the headline is measured.
 *
 * A portrait screenshot dropped into a landscape tablet canvas looks wrong when
 * stacked — it becomes a thin sliver under a wide headline. In that case the
 * headline moves beside the screenshot instead, which is how good tablet store
 * assets are actually composed.
 *
 * Both layouts honour `screenshotFit` (covering fills the frame and crops the
 * overflow) and `framePadding` (zero bleeds the screenshot to the canvas edges).
 */
export function planLayout(input: {
  canvasWidth: number;
  canvasHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  config: TemplateConfig;
}): LayoutPlan {
  const { canvasWidth, canvasHeight, sourceWidth, sourceHeight, config } = input;

  const shortSide = Math.min(canvasWidth, canvasHeight);
  const fontSize = Math.max(12, Math.round(shortSide * config.headlineScale));
  // Measured off the short side so the inset looks the same in both orientations.
  const framePadding = Math.round(shortSide * config.framePadding);

  const canvasIsWide = canvasWidth / canvasHeight >= 1.2;
  const sourceIsTall = sourceHeight > sourceWidth;
  const mode: LayoutMode =
    canvasIsWide && sourceIsTall ? "side-by-side" : "stacked";

  if (mode === "side-by-side") {
    const covering = config.screenshotFit === "cover";
    // The headline keeps its own gutters whatever the screenshot does — text
    // running into the canvas edge is never what you want.
    const textGutter = Math.round(canvasWidth * 0.06);
    const gap = Math.round(canvasWidth * 0.05);
    // The screenshot is the subject; when it covers, the headline column yields
    // width to it.
    const textWidth = Math.round(
      (canvasWidth - textGutter * 2 - gap) * (covering ? 0.32 : 0.42),
    );
    const panelLeft = textGutter + textWidth + gap;

    return {
      mode,
      canvasWidth,
      canvasHeight,
      textPaddingTop: Math.round(canvasHeight * 0.08),
      framePadding,
      gap,
      text: {
        left: textGutter,
        width: textWidth,
        fontSize,
        // Centring a narrow column beside an image reads worse than left-aligning.
        align: config.align === "center" ? "left" : config.align,
      },
      screenshotBox: {
        left: panelLeft,
        top: framePadding,
        width: canvasWidth - framePadding - panelLeft,
        height: canvasHeight - framePadding * 2,
      },
    };
  }

  const textGutter = Math.round(canvasWidth * 0.075);
  const textPaddingTop = Math.round(canvasHeight * 0.075);

  return {
    mode,
    canvasWidth,
    canvasHeight,
    textPaddingTop,
    framePadding,
    gap: Math.round(canvasHeight * 0.035),
    text: {
      left: textGutter,
      width: canvasWidth - textGutter * 2,
      fontSize,
      align: config.align,
    },
    screenshotBox: {
      left: framePadding,
      top: framePadding,
      width: canvasWidth - framePadding * 2,
      height: canvasHeight - framePadding * 2,
    },
  };
}

/** Completes the plan once the rendered headline has been measured. */
export function finalizeLayout(
  plan: LayoutPlan,
  input: {
    textWidth: number;
    textHeight: number;
    sourceWidth: number;
    sourceHeight: number;
    config: TemplateConfig;
  },
): Layout {
  const { textWidth, textHeight, sourceWidth, sourceHeight, config } = input;
  const hasText = textHeight > 0;
  const screenshotFit = config.screenshotFit;

  const frame: Rect = {
    left: plan.framePadding,
    top: plan.framePadding,
    width: plan.canvasWidth - plan.framePadding * 2,
    height: plan.canvasHeight - plan.framePadding * 2,
  };

  // With no headline there is nothing to make room for, so the screenshot takes
  // the whole frame in either layout. Reserving the side-by-side text column
  // here would leave a third of a landscape asset as bare background.
  if (!hasText) {
    const screenshotRect =
      screenshotFit === "cover"
        ? frame
        : fitInside(frame, sourceWidth, sourceHeight);

    return {
      ...plan,
      textRect: { left: frame.left, top: frame.top, width: 0, height: 0 },
      screenshotRect,
      screenshotFit,
      cornerRadius: cornerRadiusFor(screenshotRect, config),
    };
  }

  let textRect: Rect;
  let screenshotRect: Rect;

  if (plan.mode === "side-by-side") {
    if (screenshotFit === "cover") {
      // Flush to the top, right and bottom edges (minus any frame padding).
      // Centring the pair here would put background back along the right edge,
      // which is the gap a covering panel exists to remove.
      screenshotRect = plan.screenshotBox;
      textRect = {
        left: plan.text.left,
        top: Math.round((plan.canvasHeight - textHeight) / 2),
        width: textWidth,
        height: textHeight,
      };
    } else {
      // Contained: centre the headline and the screenshot as one group, so a
      // short headline doesn't leave a hole in the middle of a wide canvas.
      const fitted = fitInside(plan.screenshotBox, sourceWidth, sourceHeight);
      const groupWidth = textWidth + plan.gap + fitted.width;
      const groupLeft = Math.round((plan.canvasWidth - groupWidth) / 2);

      textRect = {
        left: groupLeft,
        top: Math.round((plan.canvasHeight - textHeight) / 2),
        width: textWidth,
        height: textHeight,
      };
      screenshotRect = { ...fitted, left: groupLeft + textWidth + plan.gap };
    }
  } else {
    textRect = {
      left:
        plan.text.left +
        alignOffset(plan.text.width, textWidth, plan.text.align),
      top: plan.textPaddingTop,
      width: textWidth,
      height: textHeight,
    };

    // The screenshot starts below the headline and runs to the frame's edges.
    const top = plan.textPaddingTop + textHeight + plan.gap;
    const box: Rect = {
      left: frame.left,
      top,
      width: frame.width,
      height: plan.canvasHeight - top - plan.framePadding,
    };

    screenshotRect =
      screenshotFit === "cover"
        ? box
        : fitInside(box, sourceWidth, sourceHeight);
  }

  return {
    ...plan,
    textRect,
    screenshotRect,
    screenshotFit,
    cornerRadius: cornerRadiusFor(screenshotRect, config),
  };
}

function cornerRadiusFor(rect: Rect, config: TemplateConfig): number {
  return Math.round(
    Math.min(rect.width, rect.height) * config.cornerRadius,
  );
}

/** Horizontal offset of `contentWidth` inside `containerWidth` for an alignment. */
export function alignOffset(
  containerWidth: number,
  contentWidth: number,
  align: TemplateConfig["align"],
): number {
  const slack = Math.max(0, containerWidth - contentWidth);
  if (align === "center") return Math.round(slack / 2);
  if (align === "right") return slack;
  return 0;
}

/** Aspect-preserving contain fit, centred in the box. Never stretches. */
export function fitInside(
  box: Rect,
  sourceWidth: number,
  sourceHeight: number,
): Rect {
  const ratio = Math.min(box.width / sourceWidth, box.height / sourceHeight);

  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));

  return {
    width,
    height,
    left: box.left + Math.round((box.width - width) / 2),
    top: box.top + Math.round((box.height - height) / 2),
  };
}
