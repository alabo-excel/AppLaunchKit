import { renderAsset } from "~/features/render/render.server";
import {
  MAX_UPLOAD_BYTES,
  UnsupportedImageError,
  analyzeImage,
  extensionFor,
  validateSource,
} from "~/features/screenshots/analyze.server";
import {
  readOriginal,
  readWorkspace,
  removeGenerated,
  removeOriginal,
  updateWorkspace,
  writeGenerated,
  writeOriginal,
  type StoredAsset,
  type StoredScreenshot,
  type Workspace,
} from "~/features/storage/local-store.server";
import { resolveStoreTargets } from "~/features/store/requirements";
import type { StoreTarget } from "~/features/store/types";
import { validateGeneratedAsset, type AssetValidation } from "~/features/store/validate";
import type { TemplateConfig } from "~/features/templates/types";
import { mapWithConcurrency } from "~/lib/concurrency";
import { MAX_SCREENSHOTS, RENDER_CONCURRENCY } from "./limits";

export type UploadOutcome = {
  uploaded: number;
  rejected: { fileName: string; message: string }[];
  warnings: { fileName: string; message: string }[];
};

export function sortedScreenshots(workspace: Workspace): StoredScreenshot[] {
  return [...workspace.screenshots].sort((a, b) => a.sortOrder - b.sortOrder);
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

export async function uploadScreenshots(
  sessionId: string,
  files: File[],
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: 0, rejected: [], warnings: [] };

  // Decode and write the files first — that part is slow and touches no shared
  // state. The cap and the ordering are then decided under the manifest lock, so
  // two uploads landing at once can't both believe there is room for one more.
  type Candidate = {
    fileName: string;
    screenshot: Omit<StoredScreenshot, "sortOrder">;
  };
  const candidates: Candidate[] = [];

  for (const file of files) {
    if (file.size === 0) continue;

    if (candidates.length >= MAX_SCREENSHOTS) {
      outcome.rejected.push({
        fileName: file.name,
        message: `You can add up to ${MAX_SCREENSHOTS} screenshots at a time.`,
      });
      continue;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      outcome.rejected.push({
        fileName: file.name,
        message: `This file is too large. The limit is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
      });
      continue;
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let analysis;
    try {
      analysis = await analyzeImage(buffer);
    } catch (error) {
      outcome.rejected.push({
        fileName: file.name,
        message:
          error instanceof UnsupportedImageError
            ? error.message
            : "We couldn't read this image.",
      });
      continue;
    }

    const validation = validateSource(analysis);
    if (!validation.valid) {
      outcome.rejected.push({
        fileName: file.name,
        message:
          validation.issues.find((issue) => issue.level === "error")?.message ??
          "This screenshot can't be used.",
      });
      continue;
    }
    const warning = validation.issues.find((issue) => issue.level === "warning");
    if (warning) {
      outcome.warnings.push({ fileName: file.name, message: warning.message });
    }

    const screenshotId = crypto.randomUUID();
    const extension = extensionFor(analysis.format);

    try {
      await writeOriginal(sessionId, screenshotId, extension, buffer);
    } catch {
      outcome.rejected.push({
        fileName: file.name,
        message: "Your upload couldn't be saved. Please try again.",
      });
      continue;
    }

    candidates.push({
      fileName: file.name,
      screenshot: {
        id: screenshotId,
        fileName: file.name,
        extension,
        width: analysis.width,
        height: analysis.height,
        format: analysis.format,
        fileSize: analysis.fileSize,
        orientation: analysis.orientation,
        caption: "",
      },
    });
  }

  if (candidates.length === 0) return outcome;

  const { result } = await updateWorkspace(sessionId, (workspace) => {
    const overflow: Candidate[] = [];
    let remaining = MAX_SCREENSHOTS - workspace.screenshots.length;
    let nextSortOrder =
      workspace.screenshots.reduce(
        (max, item) => Math.max(max, item.sortOrder),
        -1,
      ) + 1;

    for (const candidate of candidates) {
      if (remaining <= 0) {
        overflow.push(candidate);
        continue;
      }
      workspace.screenshots.push({
        ...candidate.screenshot,
        sortOrder: nextSortOrder++,
      });
      remaining -= 1;
      outcome.uploaded += 1;
    }

    return overflow;
  });

  // Anything that didn't fit never made it into the manifest, so its file would
  // otherwise be orphaned on disk.
  for (const candidate of result) {
    await removeOriginal(sessionId, candidate.screenshot);
    outcome.rejected.push({
      fileName: candidate.fileName,
      message: `This workspace holds up to ${MAX_SCREENSHOTS} screenshots. Delete one to add another.`,
    });
  }

  return outcome;
}

export async function deleteScreenshot(
  sessionId: string,
  screenshotId: string,
): Promise<void> {
  const { result } = await updateWorkspace(sessionId, (workspace) => {
    const screenshot = workspace.screenshots.find(
      (item) => item.id === screenshotId,
    );
    if (!screenshot) return null;

    const orphanedAssets = workspace.assets.filter(
      (asset) => asset.screenshotId === screenshotId,
    );

    workspace.screenshots = workspace.screenshots.filter(
      (item) => item.id !== screenshotId,
    );
    workspace.assets = workspace.assets.filter(
      (asset) => asset.screenshotId !== screenshotId,
    );

    return { screenshot, orphanedAssets };
  });

  if (!result) return;

  await removeOriginal(sessionId, result.screenshot);
  for (const asset of result.orphanedAssets) {
    await removeGenerated(sessionId, asset.id);
  }
}

export async function moveScreenshot(
  sessionId: string,
  screenshotId: string,
  direction: "up" | "down",
): Promise<void> {
  await updateWorkspace(sessionId, (workspace) => {
    const ordered = sortedScreenshots(workspace);
    const index = ordered.findIndex((item) => item.id === screenshotId);
    if (index === -1) return;

    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;

    const current = ordered[index];
    const neighbour = ordered[swapWith];
    const currentOrder = current.sortOrder;
    current.sortOrder = neighbour.sortOrder;
    neighbour.sortOrder = currentOrder;
  });
}

export async function setCaption(
  sessionId: string,
  screenshotId: string,
  caption: string,
): Promise<void> {
  await updateWorkspace(sessionId, (workspace) => {
    const screenshot = workspace.screenshots.find(
      (item) => item.id === screenshotId,
    );
    if (screenshot) screenshot.caption = caption.trim().slice(0, 140);
  });
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerationSummary = {
  generated: number;
  failures: { label: string; message: string }[];
  /** Validation for one representative asset, shown as proof of readiness. */
  sample: AssetValidation | null;
};

/**
 * Renders every screenshot for every selected target.
 *
 * The shared style comes from the editor; each screenshot contributes its own
 * caption as the headline, so one pass produces a complete, per-screenshot
 * caption-correct set for the whole store listing.
 */
export async function generateAssets(
  sessionId: string,
  input: { targetIds: string[]; config: TemplateConfig },
): Promise<GenerationSummary> {
  const targets = resolveStoreTargets(input.targetIds);
  if (targets.length === 0) {
    return {
      generated: 0,
      failures: [{ label: "Devices", message: "Select at least one device." }],
      sample: null,
    };
  }

  const workspace = await readWorkspace(sessionId);
  const screenshots = sortedScreenshots(workspace);

  if (screenshots.length === 0) {
    return {
      generated: 0,
      failures: [
        { label: "Screenshots", message: "Upload a screenshot first." },
      ],
      sample: null,
    };
  }

  const jobs = screenshots.flatMap((screenshot) =>
    targets.map((target) => ({ screenshot, target })),
  );

  const outcomes = await mapWithConcurrency(
    jobs,
    RENDER_CONCURRENCY,
    async ({ screenshot, target }) => {
      const label = `${screenshot.fileName} → ${target.label} ${target.orientation}`;
      try {
        return await renderOne(sessionId, screenshot, target, input.config);
      } catch (error) {
        return {
          ok: false as const,
          label,
          message:
            error instanceof Error && error.message
              ? error.message
              : "We couldn't generate this asset.",
        };
      }
    },
  );

  const created: StoredAsset[] = [];
  const failures: GenerationSummary["failures"] = [];
  let sample: AssetValidation | null = null;

  for (const outcome of outcomes) {
    if (outcome.ok) {
      created.push(outcome.asset);
      sample ??= outcome.validation;
    } else {
      failures.push({ label: outcome.label, message: outcome.message });
    }
  }

  if (created.length > 0) {
    const replaced = await updateWorkspace(sessionId, (current) => {
      // Regenerating a screenshot/target pair replaces the old asset rather
      // than stacking duplicates into the export.
      const incoming = new Set(
        created.map((asset) => `${asset.screenshotId}:${asset.targetId}`),
      );
      const superseded = current.assets.filter((asset) =>
        incoming.has(`${asset.screenshotId}:${asset.targetId}`),
      );

      current.assets = current.assets.filter(
        (asset) => !incoming.has(`${asset.screenshotId}:${asset.targetId}`),
      );
      current.assets.push(...created);
      current.style = input.config;

      return superseded;
    });

    for (const asset of replaced.result) {
      await removeGenerated(sessionId, asset.id);
    }
  }

  return { generated: created.length, failures, sample };
}

type RenderOutcome =
  | { ok: true; asset: StoredAsset; validation: AssetValidation }
  | { ok: false; label: string; message: string };

async function renderOne(
  sessionId: string,
  screenshot: StoredScreenshot,
  target: StoreTarget,
  config: TemplateConfig,
): Promise<RenderOutcome> {
  const label = `${screenshot.fileName} → ${target.label} ${target.orientation}`;
  const source = await readOriginal(sessionId, screenshot);

  const rendered = await renderAsset({
    source,
    width: target.targetWidth,
    height: target.targetHeight,
    // A screenshot's own caption wins over the shared placeholder headline.
    config: { ...config, headline: screenshot.caption || config.headline },
  });

  const validation = validateGeneratedAsset(
    {
      width: rendered.width,
      height: rendered.height,
      format: "png",
      fileSize: rendered.buffer.byteLength,
    },
    target,
  );

  if (!validation.ready) {
    const failed = validation.checks.find((check) => !check.ok);
    return {
      ok: false,
      label,
      message: `Failed store validation: ${failed?.label ?? "unknown check"}.`,
    };
  }

  const assetId = crypto.randomUUID();
  await writeGenerated(sessionId, assetId, rendered.buffer);

  return {
    ok: true,
    validation,
    asset: {
      id: assetId,
      screenshotId: screenshot.id,
      targetId: target.id,
      platform: target.platform,
      deviceType: target.deviceType,
      orientation: target.orientation,
      templateKey: config.templateKey,
      width: rendered.width,
      height: rendered.height,
      fileSize: rendered.buffer.byteLength,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function deleteAsset(
  sessionId: string,
  assetId: string,
): Promise<void> {
  const { result } = await updateWorkspace(sessionId, (workspace) => {
    const asset = workspace.assets.find((item) => item.id === assetId);
    if (!asset) return null;
    workspace.assets = workspace.assets.filter((item) => item.id !== assetId);
    return asset;
  });

  if (result) await removeGenerated(sessionId, result.id);
}

export async function clearAssets(sessionId: string): Promise<void> {
  const { result } = await updateWorkspace(sessionId, (workspace) => {
    const assets = workspace.assets;
    workspace.assets = [];
    return assets;
  });

  for (const asset of result) {
    await removeGenerated(sessionId, asset.id);
  }
}
