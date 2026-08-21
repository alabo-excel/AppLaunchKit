import type { TemplateKey } from "./types";

export type TemplateMeta = {
  key: TemplateKey;
  name: string;
  description: string;
};

/**
 * Templates are render functions, so this registry lives in code rather than in
 * the database. The remaining PRD templates (Marketing, Device Mockup,
 * Gradient, Split) get added here as their layouts land.
 */
export const templates: TemplateMeta[] = [
  {
    key: "minimal",
    name: "Minimal",
    description:
      "Headline above a clean, screenshot-focused composition. Switches to a side-by-side layout on landscape tablet sizes.",
  },
];
