import { data } from "react-router";

import {
  readGenerated,
  readWorkspace,
} from "~/features/storage/local-store.server";
import { deviceDir, PLATFORM_DIRS, type Platform } from "~/features/store/types";
import { getSessionId } from "~/lib/session.server";
import type { Route } from "./+types/asset-file";

/**
 * Streams one generated asset. The asset must belong to this browser's
 * workspace, so an id from another session is simply not found.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const sessionId = getSessionId(context);

  const workspace = await readWorkspace(sessionId);
  const asset = workspace.assets.find((item) => item.id === params.assetId);
  if (!asset) throw data("Asset not found", { status: 404 });

  const buffer = await readGenerated(sessionId, asset.id);
  const asDownload = new URL(request.url).searchParams.get("download") === "1";
  const platform = PLATFORM_DIRS[asset.platform as Platform] ?? asset.platform;
  const fileName = `${platform}-${deviceDir(asset.deviceType)}-${asset.orientation}-${asset.width}x${asset.height}.png`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `${asDownload ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
