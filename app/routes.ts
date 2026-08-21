import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Resource routes: raw image and archive responses, no UI.
  route("preview", "routes/api/preview.ts"),
  route("screenshots/:screenshotId/file", "routes/api/screenshot-file.ts"),
  route("assets/:assetId/file", "routes/api/asset-file.ts"),
  route("export.zip", "routes/api/export-zip.ts"),
] satisfies RouteConfig;
