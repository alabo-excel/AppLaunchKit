import {
  createCookie,
  type MiddlewareFunction,
  type RouterContextProvider,
} from "react-router";

import { sessionContext } from "./context";
import { isValidId } from "./ids";
import {
  WORKSPACE_TTL_MS,
  sweepExpiredWorkspaces,
} from "~/features/storage/local-store.server";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Holds nothing but a random workspace id. There are no accounts, so this id is
 * the only thing tying a browser to its uploads.
 */
export const sessionCookie = createCookie("alk_session", {
  path: "/",
  httpOnly: true,
  sameSite: "lax",
  maxAge: SESSION_MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === "production",
});

async function readSessionId(request: Request): Promise<string | null> {
  const value = await sessionCookie.parse(request.headers.get("Cookie"));
  return isValidId(value) ? value : null;
}

/**
 * Puts a workspace id on the request context, minting one when the browser has
 * none.
 *
 * This has to happen in middleware rather than in the action that first needs
 * it: on a document POST the loaders revalidate inside the same request, where
 * `request.headers` still carries the old (absent) cookie. Setting the cookie
 * from the action alone would leave the loader looking at an empty workspace
 * right after a successful upload.
 */
export const sessionMiddleware: MiddlewareFunction<Response> = async (
  { request, context },
  next,
) => {
  const existing = await readSessionId(request);
  const sessionId = existing ?? crypto.randomUUID();
  context.set(sessionContext, sessionId);

  void maybeSweep();

  const response = await next();

  if (!existing) {
    response.headers.append(
      "Set-Cookie",
      await sessionCookie.serialize(sessionId),
    );
  }

  return response;
};

export function getSessionId(context: Readonly<RouterContextProvider>): string {
  const sessionId = context.get(sessionContext);
  if (!sessionId) {
    throw new Error(
      "Workspace id is missing from the request context. Is sessionMiddleware registered on the root route?",
    );
  }
  return sessionId;
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
let lastSweep = 0;

/**
 * Opportunistic cleanup of stale workspaces, at most hourly. Uploads are
 * people's unreleased screenshots, so nothing is kept past its TTL.
 */
async function maybeSweep(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;

  try {
    await sweepExpiredWorkspaces(WORKSPACE_TTL_MS);
  } catch {
    // Cleanup is best-effort; never fail a request over it.
  }
}
