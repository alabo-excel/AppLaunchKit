import { createContext } from "react-router";

/**
 * This browser's workspace id. Set by `sessionMiddleware` on every request so
 * loaders and actions in the same request agree on it — including the request
 * that creates it.
 */
export const sessionContext = createContext<string | null>(null);
