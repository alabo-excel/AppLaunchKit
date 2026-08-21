import { z } from "zod";

import { TEMPLATE_KEYS, defaultTemplateConfig, type TemplateConfig } from "./types";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour, e.g. #111111");

export const templateConfigSchema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS).default(defaultTemplateConfig.templateKey),
  headline: z.string().max(140).default(defaultTemplateConfig.headline),

  fontFamily: z.string().min(1).max(60).default(defaultTemplateConfig.fontFamily),
  fontWeight: z
    .enum(["regular", "medium", "bold"])
    .default(defaultTemplateConfig.fontWeight),
  headlineScale: z.coerce
    .number()
    .min(0.02)
    .max(0.12)
    .default(defaultTemplateConfig.headlineScale),
  align: z
    .enum(["left", "center", "right"])
    .default(defaultTemplateConfig.align),

  backgroundColor: hexColor.default(defaultTemplateConfig.backgroundColor),
  textColor: hexColor.default(defaultTemplateConfig.textColor),

  screenshotFit: z
    .enum(["cover", "contain"])
    .default(defaultTemplateConfig.screenshotFit),
  screenshotScale: z.coerce
    .number()
    .min(0.4)
    .max(1)
    .default(defaultTemplateConfig.screenshotScale),
  cornerRadius: z.coerce
    .number()
    .min(0)
    .max(0.12)
    .default(defaultTemplateConfig.cornerRadius),
  // Not z.coerce.boolean(): that treats the string "false" as true, which is
  // exactly what form bodies and search params send.
  shadow: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value === "true" || value === "on" || value === "1"
          : value,
      z.boolean(),
    )
    .default(defaultTemplateConfig.shadow),
});

/**
 * Parses an untrusted config (form body, search params, or stored JSON) into a
 * complete config, falling back to defaults field by field.
 */
export function parseTemplateConfig(input: unknown): TemplateConfig {
  return templateConfigSchema.parse(input ?? {});
}
