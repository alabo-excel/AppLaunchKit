import { data } from "react-router";

import { mimeTypeFor, type SupportedFormat } from "~/features/screenshots/analyze.server";
import {
  readOriginal,
  readWorkspace,
} from "~/features/storage/local-store.server";
import { getSessionId } from "~/lib/session.server";
import type { Route } from "./+types/screenshot-file";

/** Serves an uploaded screenshot back for thumbnails in the editor. */
export async function loader({ params, context }: Route.LoaderArgs) {
  const sessionId = getSessionId(context);

  const workspace = await readWorkspace(sessionId);
  const screenshot = workspace.screenshots.find(
    (item) => item.id === params.screenshotId,
  );
  if (!screenshot) throw data("Screenshot not found", { status: 404 });

  const buffer = await readOriginal(sessionId, screenshot);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeTypeFor(screenshot.format as SupportedFormat),
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
