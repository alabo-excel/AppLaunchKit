import { defaultTemplateConfig, type TemplateConfig, type TemplateKey } from "./types";

export type TemplateMeta = {
  key: TemplateKey;
  name: string;
  description: string;
  config: TemplateConfig;
};

function starter(
  key: TemplateKey,
  name: string,
  description: string,
  overrides: Partial<TemplateConfig>,
): TemplateMeta {
  return { key, name, description, config: { ...defaultTemplateConfig, ...overrides, templateKey: key } };
}

export const templates: TemplateMeta[] = [
  starter("minimal", "Minimal", "A clean headline with an edge-to-edge screenshot.", {}),
  starter("studio", "Soft Studio", "A floating screen on soft lavender. Great for everyday apps.", {
    headline: "Make room for better days",
    backgroundColor: "#EDE9FE", textColor: "#312E81",
    screenshotFit: "contain", framePadding: 0.08, cornerRadius: 0.055, shadow: true,
    headlineScale: 0.065,
  }),
  starter("midnight", "Midnight", "An elegant dark canvas for a focused product showcase.", {
    headline: "Your world. In focus.",
    backgroundColor: "#101827", textColor: "#F8FAFC",
    screenshotFit: "contain", framePadding: 0.09, cornerRadius: 0.07, shadow: true,
    headlineScale: 0.07,
  }),
  starter("bold", "Bold Launch", "Big type and electric lime for a confident first impression.", {
    headline: "Big ideas. One app.",
    backgroundColor: "#D9F95F", textColor: "#18220B",
    align: "left", headlineScale: 0.095,
    framePadding: 0.045, cornerRadius: 0.025,
  }),
  starter("editorial", "Warm Editorial", "Warm paper tones and quiet typography for a personal touch.", {
    headline: "A little more intentional",
    backgroundColor: "#F5EBDD", textColor: "#663D2E",
    align: "left", fontWeight: "medium", headlineScale: 0.065,
    screenshotFit: "contain", framePadding: 0.1, cornerRadius: 0.035, shadow: true,
  }),
];

/** Apply the complete style while retaining the user's shared copy. */
export function applyTemplate(key: TemplateKey, current: TemplateConfig): TemplateConfig {
  const template = templates.find((item) => item.key === key);
  if (!template) return current;
  return { ...template.config, headline: current.headline || template.config.headline };
}
