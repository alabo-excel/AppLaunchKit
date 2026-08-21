import { data } from "react-router";

import { renderAsset } from "~/features/render/render.server";
import {
  readOriginal,
  readWorkspace,
} from "~/features/storage/local-store.server";
import { getStoreTarget } from "~/features/store/requirements";
import { parseTemplateConfig } from "~/features/templates/config.server";
import { getSessionId } from "~/lib/session.server";
import type { Route } from "./+types/preview";

/** Short side of the preview render. Small enough to feel instant. */
const PREVIEW_SHORT_SIDE = 520;

/**
 * Renders the current editor settings at reduced resolution.
 *
 * Layout is computed from fractions of the canvas, so a scaled-down render is a
 * faithful preview of the full-size asset rather than an approximation.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const sessionId = getSessionId(context);

  const url = new URL(request.url);
  const screenshotId = url.searchParams.get("screenshotId");
  const targetId = url.searchParams.get("targetId");

  if (!screenshotId || !targetId) {
    throw data("Missing screenshotId or targetId", { status: 400 });
  }

  const target = getStoreTarget(targetId);
  if (!target) throw data("Unknown device", { status: 404 });

  const workspace = await readWorkspace(sessionId);
  const screenshot = workspace.screenshots.find(
    (item) => item.id === screenshotId,
  );
  if (!screenshot) throw data("Screenshot not found", { status: 404 });

  const config = parseTemplateConfig(
    Object.fromEntries(url.searchParams.entries()),
  );

  const scale = Math.min(
    1,
    PREVIEW_SHORT_SIDE / Math.min(target.targetWidth, target.targetHeight),
  );

  const source = await readOriginal(sessionId, screenshot);
  const rendered = await renderAsset({
    source,
    width: Math.max(1, Math.round(target.targetWidth * scale)),
    height: Math.max(1, Math.round(target.targetHeight * scale)),
    config: { ...config, headline: screenshot.caption || config.headline },
  });

  return new Response(new Uint8Array(rendered.buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(rendered.buffer.byteLength),
      // Contains the user's unreleased screenshots — never cache it anywhere.
      "Cache-Control": "private, no-store",
    },
  });
}
