import { useEffect, useMemo, useRef, useState } from "react";
import { Form, data, useFetcher, useNavigation } from "react-router";

import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "~/components/ui/card";
import { ProgressBar, Spinner } from "~/components/ui/spinner";
import { ColorInput, Field, Input, Select } from "~/components/ui/field";
import { readWorkspace, type StoredAsset, type StoredScreenshot } from "~/features/storage/local-store.server";
import {
  groupTargetsByPlatform,
  storeTargets,
} from "~/features/store/requirements";
import { PLATFORM_LABELS, type Platform, type StoreTarget } from "~/features/store/types";
import type { AssetValidation } from "~/features/store/validate";
import { templates } from "~/features/templates/registry";
import { parseTemplateConfig } from "~/features/templates/config.server";
import { defaultTemplateConfig, type TemplateConfig } from "~/features/templates/types";
import { MAX_SCREENSHOTS } from "~/features/workspace/limits";
import {
  clearAssets,
  deleteAsset,
  deleteScreenshot,
  generateAssets,
  moveScreenshot,
  setCaption,
  sortedScreenshots,
  uploadScreenshots,
  type GenerationSummary,
  type UploadOutcome,
} from "~/features/workspace/workspace.server";
import { cn } from "~/lib/cn";
import { formatBytes } from "~/lib/format";
import { getSessionId } from "~/lib/session.server";
import type { Route } from "./+types/home";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "AppLaunchKit — Turn your app screenshots into store-ready assets" },
    {
      name: "description",
      content:
        "Upload once. Generate every store asset you need for Google Play and the App Store. No account required.",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const workspace = await readWorkspace(getSessionId(context));

  return {
    screenshots: sortedScreenshots(workspace),
    assets: workspace.assets,
    style: { ...defaultTemplateConfig, ...workspace.style } as TemplateConfig,
    platforms: groupTargetsByPlatform(),
  };
}

type ActionResult = {
  error?: string;
  upload?: UploadOutcome;
  generation?: GenerationSummary;
  ok?: boolean;
};

type ActionReturn = ActionResult | ReturnType<typeof data<ActionResult>>;

export async function action({
  request,
  context,
}: Route.ActionArgs): Promise<ActionReturn> {
  const sessionId = getSessionId(context);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "upload") {
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return data({ error: "Choose at least one screenshot." }, { status: 400 });
    }

    return { upload: await uploadScreenshots(sessionId, files) };
  }

  if (intent === "delete-screenshot") {
    await deleteScreenshot(sessionId, String(formData.get("screenshotId")));
    return { ok: true };
  }

  if (intent === "move-screenshot") {
    await moveScreenshot(
      sessionId,
      String(formData.get("screenshotId")),
      formData.get("direction") === "up" ? "up" : "down",
    );
    return { ok: true };
  }

  if (intent === "caption") {
    await setCaption(
      sessionId,
      String(formData.get("screenshotId")),
      String(formData.get("caption") ?? ""),
    );
    return { ok: true };
  }

  if (intent === "delete-asset") {
    await deleteAsset(sessionId, String(formData.get("assetId")));
    return { ok: true };
  }

  if (intent === "clear-assets") {
    await clearAssets(sessionId);
    return { ok: true };
  }

  if (intent === "generate") {
    const config = parseTemplateConfig(Object.fromEntries(formData.entries()));
    const targetIds = formData.getAll("targetIds").map(String);
    return { generation: await generateAssets(sessionId, { targetIds, config }) };
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { screenshots, assets, style, platforms } = loaderData;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <p className="text-sm font-medium text-zinc-500">AppLaunchKit</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Turn your app screenshots into store-ready assets
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload your screenshots, pick the devices you need, and export the lot.
          No account required — your workspace lives in this browser for 7 days.
        </p>
      </header>

      {actionData?.error ? <Alert tone="error">{actionData.error}</Alert> : null}
      {actionData?.upload ? <UploadReport report={actionData.upload} /> : null}
      {actionData?.generation ? (
        <GenerationReport summary={actionData.generation} />
      ) : null}

      {screenshots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <ScreenshotPanel screenshots={screenshots} />
          <Editor
            screenshots={screenshots}
            platforms={platforms}
            initialStyle={style}
          />
        </div>
      )}

      <AssetGallery assets={assets} screenshots={screenshots} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

type PickedFile = { name: string; size: number };

function describeFiles(files: PickedFile[]): string {
  const bytes = files.reduce((total, file) => total + file.size, 0);
  return `${files.length} ${files.length === 1 ? "file" : "files"} · ${formatBytes(bytes)}`;
}

function UploadForm({ compact }: { compact?: boolean }) {
  const navigation = useNavigation();
  const uploading =
    navigation.formData?.get("intent") === "upload" &&
    navigation.state !== "idle";

  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  /**
   * The files actually in flight, read back off the pending submission. The
   * browser is still on this page while the POST runs, so naming them is more
   * useful than a bare spinner — and it stays accurate even if `picked` is
   * cleared underneath.
   */
  const inFlight = useMemo<PickedFile[]>(() => {
    if (!uploading || !navigation.formData) return [];
    return navigation.formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File)
      .filter((file) => file.size > 0)
      .map((file) => ({ name: file.name, size: file.size }));
  }, [uploading, navigation.formData]);

  // Reset once the upload lands, so the picker doesn't keep showing files that
  // have already been dealt with (accepted or rejected).
  const wasUploading = useRef(false);
  useEffect(() => {
    if (wasUploading.current && !uploading) {
      setPicked([]);
      if (inputRef.current) inputRef.current.value = "";
    }
    wasUploading.current = uploading;
  }, [uploading]);

  function readInput() {
    const files = [...(inputRef.current?.files ?? [])];
    setPicked(files.map((file) => ({ name: file.name, size: file.size })));
  }

  /**
   * Dropping onto the zone has to move the files into the input by hand.
   * The input is visually hidden, so it is never the drop target itself, and
   * assigning the DataTransfer's `FileList` is what makes the dropped files part
   * of the form submission.
   */
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (uploading || !inputRef.current || event.dataTransfer.files.length === 0) {
      return;
    }
    inputRef.current.files = event.dataTransfer.files;
    readInput();
  }

  const padding = compact ? "px-4 py-6" : "px-6 py-14";

  return (
    <Form
      method="post"
      encType="multipart/form-data"
      className="space-y-2"
      aria-busy={uploading}
    >
      <input type="hidden" name="intent" value="upload" />

      {/* The drop target is this wrapper, not the label: the status region below
          must not live inside a <label>, where it would become the file input's
          accessible name. Padding sits on the inner element so the whole area
          stays clickable. */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg border-2 border-dashed text-center text-sm transition-colors",
          uploading
            ? "border-zinc-300 dark:border-zinc-700"
            : "border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-800/50",
          dragging &&
            !uploading &&
            "border-zinc-900 bg-zinc-100 dark:border-zinc-200 dark:bg-zinc-800",
        )}
      >
        {uploading ? (
          <div
            role="status"
            aria-live="polite"
            className={cn("flex flex-col items-center gap-2", padding)}
          >
            <span className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300">
              <Spinner />
              {inFlight.length > 0
                ? `Uploading ${describeFiles(inFlight)}…`
                : "Uploading…"}
            </span>
            <ProgressBar className="max-w-xs" />
            <ul className="w-full space-y-0.5 text-xs text-zinc-500">
              {inFlight.map((file) => (
                <li key={file.name} className="truncate">
                  {file.name} · {formatBytes(file.size)}
                </li>
              ))}
            </ul>
            <span className="text-xs text-zinc-400">
              Reading dimensions and checking each file against the store limits.
            </span>
          </div>
        ) : (
          <label
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-1 text-zinc-600 dark:text-zinc-400",
              padding,
            )}
          >
            <span className="font-medium">
              {dragging
                ? "Drop to add"
                : compact
                  ? "Drop screenshots here"
                  : "Drop your screenshots here"}
            </span>
            <span className="text-xs">
              PNG, JPG or WEBP · up to 8MB each · {MAX_SCREENSHOTS} max
            </span>
            <input
              ref={inputRef}
              type="file"
              name="files"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={readInput}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {picked.length > 0 && !uploading ? (
        <div className="space-y-1 rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-800/50">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            Ready to upload · {describeFiles(picked)}
          </p>
          <ul className="space-y-0.5 text-zinc-500">
            {picked.map((file) => (
              <li key={file.name} className="truncate">
                {file.name} · {formatBytes(file.size)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Only `uploading` gates the button. Gating on an empty selection would
          make the form unusable before hydration, where `picked` is always empty. */}
      <Button type="submit" size="sm" className="w-full" disabled={uploading}>
        {uploading ? (
          <>
            <Spinner />
            Uploading…
          </>
        ) : picked.length > 0 ? (
          `Upload ${picked.length} ${picked.length === 1 ? "file" : "files"}`
        ) : (
          "Upload"
        )}
      </Button>
    </Form>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardBody className="space-y-4">
        <UploadForm />
        <p className="text-xs text-zinc-500">
          Screenshots are fitted into each store's composition, never stretched.
          A portrait phone screenshot becomes a properly composed tablet asset —
          no tablet required.
        </p>
      </CardBody>
    </Card>
  );
}

function UploadReport({ report }: { report: UploadOutcome }) {
  return (
    <div className="space-y-2">
      {report.uploaded > 0 ? (
        <Alert tone="success">
          Uploaded {report.uploaded}{" "}
          {report.uploaded === 1 ? "screenshot" : "screenshots"}.
        </Alert>
      ) : null}
      {report.warnings.map((warning) => (
        <Alert key={warning.fileName} tone="warning">
          <strong>{warning.fileName}</strong> — {warning.message}
        </Alert>
      ))}
      {report.rejected.map((rejection) => (
        <Alert key={rejection.fileName} tone="error">
          <strong>{rejection.fileName}</strong> — {rejection.message}
        </Alert>
      ))}
    </div>
  );
}

function GenerationReport({ summary }: { summary: GenerationSummary }) {
  return (
    <div className="space-y-2">
      {summary.generated > 0 ? (
        <Alert tone="success">
          Generated and validated {summary.generated}{" "}
          {summary.generated === 1 ? "asset" : "assets"}. Export them below.
        </Alert>
      ) : null}
      {summary.failures.map((failure) => (
        <Alert key={`${failure.label}-${failure.message}`} tone="error">
          <strong>{failure.label}</strong> — {failure.message}
        </Alert>
      ))}
      {summary.sample ? <ValidationList validation={summary.sample} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screenshots
// ---------------------------------------------------------------------------

function ScreenshotPanel({ screenshots }: { screenshots: StoredScreenshot[] }) {
  return (
    <Card className="self-start">
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Screenshots</CardTitle>
        <span className="text-xs text-zinc-500">
          {screenshots.length} / {MAX_SCREENSHOTS}
        </span>
      </CardHeader>
      <CardBody className="space-y-4">
        {screenshots.length < MAX_SCREENSHOTS ? <UploadForm compact /> : null}

        <ul className="space-y-3">
          {screenshots.map((screenshot, index) => (
            <li
              key={screenshot.id}
              className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <div className="flex gap-3">
                <img
                  src={`/screenshots/${screenshot.id}/file`}
                  alt={screenshot.fileName}
                  className="h-20 w-12 shrink-0 rounded border border-zinc-200 object-cover dark:border-zinc-700"
                />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="truncate font-medium" title={screenshot.fileName}>
                    {index + 1}. {screenshot.fileName}
                  </p>
                  <p className="mt-0.5 text-zinc-500">
                    {screenshot.width} × {screenshot.height}
                  </p>
                  <p className="text-zinc-500">
                    {screenshot.orientation} · {screenshot.format.toUpperCase()}{" "}
                    · {formatBytes(screenshot.fileSize)}
                  </p>
                </div>
              </div>

              <CaptionForm screenshot={screenshot} />

              <div className="flex items-center gap-1">
                <Form method="post">
                  <input type="hidden" name="intent" value="move-screenshot" />
                  <input type="hidden" name="screenshotId" value={screenshot.id} />
                  <input type="hidden" name="direction" value="up" />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    ↑
                  </Button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="move-screenshot" />
                  <input type="hidden" name="screenshotId" value={screenshot.id} />
                  <input type="hidden" name="direction" value="down" />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={index === screenshots.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </Button>
                </Form>
                <Form method="post" className="ml-auto">
                  <input type="hidden" name="intent" value="delete-screenshot" />
                  <input type="hidden" name="screenshotId" value={screenshot.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </Form>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/**
 * Per-screenshot headline. Generation uses each screenshot's own caption, so one
 * pass produces a correctly captioned set for the whole listing.
 */
function CaptionForm({ screenshot }: { screenshot: StoredScreenshot }) {
  const fetcher = useFetcher();
  const saving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post" className="flex items-center gap-1">
      <input type="hidden" name="intent" value="caption" />
      <input type="hidden" name="screenshotId" value={screenshot.id} />
      <Input
        name="caption"
        defaultValue={screenshot.caption}
        placeholder="Caption for this screenshot"
        maxLength={140}
        aria-label={`Caption for ${screenshot.fileName}`}
        className="h-8 text-xs"
      />
      <Button type="submit" variant="ghost" size="sm" disabled={saving}>
        {saving ? "…" : "Save"}
      </Button>
    </fetcher.Form>
  );
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

type PlatformGroup = ReturnType<typeof groupTargetsByPlatform>[number];

const DEFAULT_TARGET_IDS = storeTargets
  .filter(
    (target) =>
      target.platform === "google_play" && target.orientation === "portrait",
  )
  .map((target) => target.id);

function Editor({
  screenshots,
  platforms,
  initialStyle,
}: {
  screenshots: StoredScreenshot[];
  platforms: PlatformGroup[];
  initialStyle: TemplateConfig;
}) {
  const navigation = useNavigation();
  const generating =
    navigation.formData?.get("intent") === "generate" &&
    navigation.state !== "idle";

  const [config, setConfig] = useState<TemplateConfig>(initialStyle);
  const [previewScreenshotId, setPreviewScreenshotId] = useState(
    screenshots[0].id,
  );
  const [previewTargetId, setPreviewTargetId] = useState(
    DEFAULT_TARGET_IDS[0] ?? storeTargets[0].id,
  );
  const [selectedTargets, setSelectedTargets] = useState<string[]>(
    DEFAULT_TARGET_IDS,
  );

  useEffect(() => {
    if (!screenshots.some((item) => item.id === previewScreenshotId)) {
      setPreviewScreenshotId(screenshots[0].id);
    }
  }, [screenshots, previewScreenshotId]);

  const previewScreenshot = screenshots.find(
    (item) => item.id === previewScreenshotId,
  );
  const previewTarget = storeTargets.find(
    (target) => target.id === previewTargetId,
  );

  const previewUrl = useDebouncedPreviewUrl({
    screenshotId: previewScreenshotId,
    targetId: previewTargetId,
    config,
  });

  function set<K extends keyof TemplateConfig>(key: K, value: TemplateConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function toggleTarget(id: string, checked: boolean) {
    setSelectedTargets((current) =>
      checked
        ? current.includes(id)
          ? current
          : [...current, id]
        : current.filter((item) => item !== id),
    );
  }

  const jobCount = screenshots.length * selectedTargets.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <Card className="self-start">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Preview</CardTitle>
            {previewTarget ? (
              <span className="text-xs text-zinc-500">
                {previewTarget.targetWidth} × {previewTarget.targetHeight} ·{" "}
                {previewTarget.label} · {previewTarget.orientation}
              </span>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Previewing screenshot">
                <Select
                  value={previewScreenshotId}
                  onChange={(event) => setPreviewScreenshotId(event.target.value)}
                >
                  {screenshots.map((screenshot, index) => (
                    <option key={screenshot.id} value={screenshot.id}>
                      {index + 1}. {screenshot.fileName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Previewing device">
                <Select
                  value={previewTargetId}
                  onChange={(event) => setPreviewTargetId(event.target.value)}
                >
                  {storeTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {PLATFORM_LABELS[target.platform]} · {target.label} ·{" "}
                      {target.orientation}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="flex justify-center rounded-lg bg-zinc-50 p-4 dark:bg-zinc-950/40">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Generated asset preview"
                  className="max-h-[480px] w-auto rounded border border-zinc-200 shadow-sm dark:border-zinc-800"
                />
              ) : (
                <div className="flex h-72 items-center text-sm text-zinc-500">
                  Pick a device to preview.
                </div>
              )}
            </div>

            {previewScreenshot && !previewScreenshot.caption ? (
              <p className="text-xs text-zinc-500">
                This screenshot has no caption, so the shared headline is used.
                Give each screenshot its own caption on the left.
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Style</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              <Field label="Template">
                <Select
                  value={config.templateKey}
                  onChange={(event) =>
                    set(
                      "templateKey",
                      event.target.value as TemplateConfig["templateKey"],
                    )
                  }
                >
                  {templates.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label="Shared headline"
                hint="Used for any screenshot without its own caption."
              >
                <Input
                  value={config.headline}
                  maxLength={140}
                  placeholder="Put the Word First"
                  onChange={(event) => set("headline", event.target.value)}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight">
                  <Select
                    value={config.fontWeight}
                    onChange={(event) =>
                      set(
                        "fontWeight",
                        event.target.value as TemplateConfig["fontWeight"],
                      )
                    }
                  >
                    <option value="regular">Regular</option>
                    <option value="medium">Medium</option>
                    <option value="bold">Bold</option>
                  </Select>
                </Field>
                <Field label="Align">
                  <Select
                    value={config.align}
                    onChange={(event) =>
                      set("align", event.target.value as TemplateConfig["align"])
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </Select>
                </Field>
              </div>

              <RangeField
                label="Text size"
                min={0.02}
                max={0.12}
                step={0.002}
                value={config.headlineScale}
                onChange={(value) => set("headlineScale", value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Background">
                  <ColorInput
                    value={config.backgroundColor}
                    onChange={(event) =>
                      set("backgroundColor", event.target.value)
                    }
                  />
                </Field>
                <Field label="Text">
                  <ColorInput
                    value={config.textColor}
                    onChange={(event) => set("textColor", event.target.value)}
                  />
                </Field>
              </div>

              <Field
                label="Screenshot fit"
                hint={
                  config.screenshotFit === "cover"
                    ? "Fills the frame; whatever overflows is cropped from the bottom."
                    : "Shows the whole screenshot, with margins where the shapes differ."
                }
              >
                <Select
                  value={config.screenshotFit}
                  onChange={(event) =>
                    set(
                      "screenshotFit",
                      event.target.value as TemplateConfig["screenshotFit"],
                    )
                  }
                >
                  <option value="cover">Cover — fill the frame</option>
                  <option value="contain">Contain — fit it all in</option>
                </Select>
              </Field>

              <RangeField
                label="Screenshot size"
                min={0.4}
                max={1}
                step={0.01}
                value={config.screenshotScale}
                onChange={(value) => set("screenshotScale", value)}
              />

              <RangeField
                label="Corner radius"
                min={0}
                max={0.12}
                step={0.005}
                value={config.cornerRadius}
                onChange={(value) => set("cornerRadius", value)}
              />

              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={config.shadow}
                  onChange={(event) => set("shadow", event.target.checked)}
                  className="size-4 rounded border-zinc-300 dark:border-zinc-700"
                />
                Drop shadow
              </label>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>What to generate</CardTitle>
          <span className="text-xs text-zinc-500">
            {selectedTargets.length}{" "}
            {selectedTargets.length === 1 ? "device" : "devices"} ·{" "}
            {screenshots.length}{" "}
            {screenshots.length === 1 ? "screenshot" : "screenshots"} ={" "}
            {jobCount} {jobCount === 1 ? "asset" : "assets"}
          </span>
        </CardHeader>
        <CardBody>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="generate" />
            {/* The style panel is uncontrolled markup; mirror it into the body. */}
            <ConfigFields config={config} />

            <div className="grid gap-5 sm:grid-cols-2">
              {platforms.map((group) => (
                <fieldset key={group.platform} className="space-y-2">
                  <legend className="text-sm font-semibold">
                    {PLATFORM_LABELS[group.platform]}
                  </legend>
                  {group.devices.map((device) => (
                    <div key={device.deviceType} className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500">
                        {device.label}
                      </p>
                      {device.targets.map((target) => (
                        <TargetCheckbox
                          key={target.id}
                          target={target}
                          checked={selectedTargets.includes(target.id)}
                          onChange={(checked) => toggleTarget(target.id, checked)}
                        />
                      ))}
                    </div>
                  ))}
                </fieldset>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <Button type="submit" disabled={generating || jobCount === 0}>
                {generating
                  ? `Generating ${jobCount} assets…`
                  : `Generate ${jobCount} ${jobCount === 1 ? "asset" : "assets"}`}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTargets(storeTargets.map((t) => t.id))}
              >
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTargets([])}
              >
                Clear
              </Button>
            </div>
          </Form>
        </CardBody>
      </Card>
    </div>
  );
}

/** Mirrors the controlled style panel into whichever form is submitted. */
function ConfigFields({ config }: { config: TemplateConfig }) {
  return (
    <>
      {Object.entries(config).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={String(value)} />
      ))}
    </>
  );
}

function TargetCheckbox({
  target,
  checked,
  onChange,
}: {
  target: StoreTarget;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        name="targetIds"
        value={target.id}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 rounded border-zinc-300 dark:border-zinc-700"
      />
      <span className="capitalize">{target.orientation}</span>
      <span className="text-xs text-zinc-500">
        {target.targetWidth} × {target.targetHeight}
      </span>
    </label>
  );
}

function RangeField({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </span>
        <span className="text-xs text-zinc-500">{value.toFixed(3)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-zinc-900 dark:accent-zinc-100"
      />
    </div>
  );
}

/**
 * Builds the preview URL, debounced so dragging a slider doesn't queue a render
 * per pixel.
 */
function useDebouncedPreviewUrl(input: {
  screenshotId: string;
  targetId: string;
  config: TemplateConfig;
}): string | null {
  const target = useMemo(() => {
    if (!input.screenshotId || !input.targetId) return null;

    const params = new URLSearchParams({
      screenshotId: input.screenshotId,
      targetId: input.targetId,
    });
    for (const [key, value] of Object.entries(input.config)) {
      params.set(key, String(value));
    }
    return `/preview?${params.toString()}`;
  }, [input.screenshotId, input.targetId, input.config]);

  const [debounced, setDebounced] = useState(target);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setDebounced(target);
      return;
    }
    const timer = setTimeout(() => setDebounced(target), 350);
    return () => clearTimeout(timer);
  }, [target]);

  return debounced;
}

// ---------------------------------------------------------------------------
// Generated assets
// ---------------------------------------------------------------------------

function AssetGallery({
  assets,
  screenshots,
}: {
  assets: StoredAsset[];
  screenshots: StoredScreenshot[];
}) {
  if (assets.length === 0) return null;

  const position = new Map(
    screenshots.map((screenshot, index) => [screenshot.id, index + 1]),
  );

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Generated assets ({assets.length})</CardTitle>
        <div className="flex items-center gap-2">
          <a
            href="/export.zip"
            className="inline-flex h-8 items-center rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Export ZIP
          </a>
          <Form method="post">
            <input type="hidden" name="intent" value="clear-assets" />
            <Button type="submit" variant="ghost" size="sm">
              Clear all
            </Button>
          </Form>
        </div>
      </CardHeader>
      <CardBody>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="space-y-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800"
            >
              <img
                src={`/assets/${asset.id}/file`}
                alt=""
                className="w-full rounded border border-zinc-200 bg-zinc-50 object-contain dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="text-xs">
                <p className="font-medium">
                  Screenshot {position.get(asset.screenshotId) ?? "?"} ·{" "}
                  {asset.orientation}
                </p>
                <p className="text-zinc-500">
                  {asset.width} × {asset.height} · {formatBytes(asset.fileSize)}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={`/assets/${asset.id}/file?download=1`}
                  className="inline-flex h-8 items-center rounded-lg border border-zinc-300 px-2 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  PNG
                </a>
                <Form method="post" className="ml-auto">
                  <input type="hidden" name="intent" value="delete-asset" />
                  <input type="hidden" name="assetId" value={asset.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </Form>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function ValidationList({ validation }: { validation: AssetValidation }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset validation</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-1 text-sm">
          {validation.checks.map((check) => (
            <li key={check.label} className="flex items-baseline gap-2">
              <span className={check.ok ? "text-emerald-600" : "text-red-600"}>
                {check.ok ? "✓" : "✗"}
              </span>
              <span>{check.label}</span>
              {check.detail ? (
                <span className="text-xs text-zinc-500">{check.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
