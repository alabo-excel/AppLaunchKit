import { data } from "react-router";

import { buildExportZip } from "~/features/export/zip.server";
import { readWorkspace } from "~/features/storage/local-store.server";
import { sortedScreenshots } from "~/features/workspace/workspace.server";
import { getSessionId } from "~/lib/session.server";
import type { Route } from "./+types/export-zip";

/** Every generated asset for this workspace, laid out by store and device. */
export async function loader({ request, context }: Route.LoaderArgs) {
  const sessionId = getSessionId(context);

  const workspace = await readWorkspace(sessionId);
  const archive = await buildExportZip(
    sessionId,
    sortedScreenshots(workspace),
    workspace.assets,
  );

  if (!archive) {
    throw data("Nothing to export yet. Generate some assets first.", {
      status: 404,
    });
  }

  return new Response(new Uint8Array(archive.buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(archive.buffer.byteLength),
      "Content-Disposition": 'attachment; filename="applaunchkit-assets.zip"',
      "Cache-Control": "private, no-store",
    },
  });
}
