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
  text: { left: number; width: number; fontSize: number; align: TemplateConfig["align"] };
  /** The area the screenshot may occupy, before aspect-preserving fit. */
  screenshotBox: Rect;
  /** Vertical padding, reused when placing the finished text block. */
  paddingY: number;
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
 * Both layouts honour `screenshotFit`: covering fills the frame and crops the
 * overflow, and in the side-by-side case the headline column also gives up
 * width so the screenshot dominates the asset.
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
  const fontSize = Math.max(
    12,
    Math.round(shortSide * config.headlineScale),
  );
  const canvasIsWide = canvasWidth / canvasHeight >= 1.2;
  const sourceIsTall = sourceHeight > sourceWidth;
  const mode: LayoutMode =
    canvasIsWide && sourceIsTall ? "side-by-side" : "stacked";

  if (mode === "side-by-side") {
    const covering = config.screenshotFit === "cover";
    const paddingX = Math.round(canvasWidth * 0.06);
    // A covering panel is a solid block, so it can sit closer to the edges than
    // a contained screenshot floating in space.
    const paddingY = Math.round(canvasHeight * (covering ? 0.05 : 0.08));
    const gap = Math.round(canvasWidth * 0.05);
    const contentWidth = canvasWidth - paddingX * 2;
    // The screenshot is the subject; when it covers, the headline column yields
    // width to it.
    const textWidth = Math.round((contentWidth - gap) * (covering ? 0.32 : 0.42));

    return {
      mode,
      canvasWidth,
      canvasHeight,
      paddingY,
      gap,
      text: {
        left: paddingX,
        width: textWidth,
        fontSize,
        // Centring a narrow column beside an image reads worse than left-aligning.
        align: config.align === "center" ? "left" : config.align,
      },
      screenshotBox: {
        left: paddingX + textWidth + gap,
        top: paddingY,
        width: contentWidth - textWidth - gap,
        height: canvasHeight - paddingY * 2,
      },
    };
  }

  const paddingX = Math.round(canvasWidth * 0.075);
  const paddingY = Math.round(canvasHeight * 0.075);
  const gap = Math.round(canvasHeight * 0.035);

  return {
    mode,
    canvasWidth,
    canvasHeight,
    paddingY,
    gap,
    text: {
      left: paddingX,
      width: canvasWidth - paddingX * 2,
      fontSize,
      align: config.align,
    },
    screenshotBox: {
      left: paddingX,
      top: paddingY,
      width: canvasWidth - paddingX * 2,
      height: canvasHeight - paddingY * 2,
    },
  };
}

/**
 * Completes the plan once the rendered headline has been measured.
 *
 * The measured text width matters: in side-by-side mode the headline and the
 * screenshot are centred as a single group, so a short headline does not leave a
 * hole in the middle of the canvas.
 */
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

  let textRect: Rect;
  let screenshotRect: Rect;
  let screenshotFit: ScreenshotFit;

  if (plan.mode === "side-by-side") {
    screenshotFit = config.screenshotFit;

    const panel =
      screenshotFit === "cover"
        ? fillBox(plan.screenshotBox, config.screenshotScale)
        : fitInside(
            plan.screenshotBox,
            sourceWidth,
            sourceHeight,
            config.screenshotScale,
          );

    // Centre the headline and the screenshot as one group, so a short headline
    // doesn't leave a hole in the middle of a wide canvas.
    const gap = hasText ? plan.gap : 0;
    const groupWidth = (hasText ? textWidth + gap : 0) + panel.width;
    const groupLeft = Math.round((plan.canvasWidth - groupWidth) / 2);

    textRect = {
      left: groupLeft,
      top: Math.round((plan.canvasHeight - textHeight) / 2),
      width: textWidth,
      height: textHeight,
    };
    screenshotRect = {
      ...panel,
      left: groupLeft + (hasText ? textWidth + gap : 0),
    };
  } else {
    screenshotFit = config.screenshotFit;

    textRect = {
      left:
        plan.text.left +
        alignOffset(plan.text.width, textWidth, plan.text.align),
      top: plan.paddingY,
      width: textWidth,
      height: textHeight,
    };

    const top = hasText
      ? plan.paddingY + textHeight + plan.gap
      : plan.screenshotBox.top;

    const box: Rect = {
      left: plan.screenshotBox.left,
      top,
      width: plan.screenshotBox.width,
      height: plan.canvasHeight - top - plan.paddingY,
    };

    screenshotRect =
      screenshotFit === "cover"
        ? fillBox(box, config.screenshotScale)
        : fitInside(box, sourceWidth, sourceHeight, config.screenshotScale);
  }

  return {
    ...plan,
    textRect,
    screenshotRect,
    screenshotFit,
    cornerRadius: Math.round(
      Math.min(screenshotRect.width, screenshotRect.height) *
        config.cornerRadius,
    ),
  };
}

/**
 * The rect a covering screenshot is drawn into: the whole box, shrunk by
 * `scale`. Centred horizontally and anchored to the top, so when it is scaled
 * down the slack falls below the screenshot rather than splitting into a gap
 * above and below.
 */
export function fillBox(box: Rect, scale: number): Rect {
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));

  return {
    width,
    height,
    left: box.left + Math.round((box.width - width) / 2),
    top: box.top,
  };
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

/**
 * Aspect-preserving contain fit, centred in the box. `scale` shrinks the result
 * so the composition can breathe; it never stretches the source.
 */
export function fitInside(
  box: Rect,
  sourceWidth: number,
  sourceHeight: number,
  scale: number,
): Rect {
  const availableWidth = Math.max(1, Math.round(box.width * scale));
  const availableHeight = Math.max(1, Math.round(box.height * scale));
  const ratio = Math.min(
    availableWidth / sourceWidth,
    availableHeight / sourceHeight,
  );

  const width = Math.max(1, Math.round(sourceWidth * ratio));
  const height = Math.max(1, Math.round(sourceHeight * ratio));

  return {
    width,
    height,
    left: box.left + Math.round((box.width - width) / 2),
    top: box.top + Math.round((box.height - height) / 2),
  };
}
