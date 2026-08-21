/**
 * Shared limits. Kept out of `workspace.server.ts` so the editor UI can display
 * them without pulling the server module into the browser bundle.
 */

/** Keeps one anonymous workspace from becoming a free image host. */
export const MAX_SCREENSHOTS = 10;

/** Renders in parallel. Above ~4, libvips threads fight for the same cores. */
export const RENDER_CONCURRENCY = 4;
