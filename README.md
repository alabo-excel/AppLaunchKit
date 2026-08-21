# AppLaunchKit

Turn your app screenshots into store-ready assets. Upload once, generate every
store asset you need for Google Play and the Apple App Store.

**No account, no database, no setup.** Clone it, `npm install`, `npm run dev`,
and the whole flow works.

```
upload screenshots → caption them → pick devices → generate → export ZIP
```

---

## Setup

```sh
npm install
npm run dev
```

That's it. There are no environment variables and no external services.

Node **22.22.0 or newer** is required by React Router v8. Older versions print a
warning on every command and may misbehave.

---

## Stack

| Concern          | Choice                                     |
| ---------------- | ------------------------------------------ |
| Framework        | React Router v8 (framework mode, SSR)      |
| Language         | TypeScript                                 |
| Styling          | Tailwind CSS v4                            |
| Image processing | Sharp (libvips + Pango for text)           |
| Archives         | fflate                                     |
| Validation       | zod                                        |

> The PRD names Next.js. The repo was already scaffolded with React Router v8
> framework mode, which covers the same ground — server loaders/actions, SSR,
> resource routes for image and archive responses — so it was kept rather than
> migrated.

---

## Where uploads live

There are no accounts, so a **workspace is a directory** keyed by a random id in
an httpOnly cookie:

```
.data/workspaces/{workspaceId}/
  workspace.json      screenshots, generated assets, last-used style
  originals/          uploaded screenshots
  generated/          rendered store assets
```

- The id is minted by root middleware, so a loader sees the workspace created by
  the very same request. Setting the cookie from the action alone would leave the
  page showing an empty workspace right after a successful upload.
- The id is checked against a strict UUID pattern before it is ever used as a
  path segment — it names a directory, so `../../etc` must never get through.
- Workspaces untouched for 7 days are swept (checked at most hourly, on request).
  Nothing here is meant to be permanent.
- Set `APPLAUNCHKIT_DATA_DIR` to move the directory elsewhere.

This is deliberately the smallest thing that works. Accounts, Postgres, and
object storage are what you add when uploads need to outlive a cookie — the
parked schema in `supabase/parked/` is the starting point for that.

---

## The asset engine, in isolation

The renderer depends on nothing but Sharp, so you can look at its output
directly:

```sh
npm run render:preview                          # synthesised placeholder source
npm run render:preview -- ./my-screenshot.png    # your own screenshot
```

It writes one PNG per store size into `.render-preview/` and prints the layout
mode and timing for each.

---

## How generation works

1. **Store targets** are declared in
   [`app/features/store/requirements.ts`](app/features/store/requirements.ts) —
   one entry per store/device/orientation, carrying both the size AppLaunchKit
   renders and the bounds the store accepts. One file to edit when a store
   changes a spec.
2. **Layout is resolution-independent.**
   [`layout.ts`](app/features/render/layout.ts) computes every position as a
   fraction of the canvas, so one style renders consistently at 1080×1920 and at
   2880×1620 — and the scaled-down preview is a faithful representation of the
   full-size asset rather than an approximation.
3. **The source is scaled, never stretched.** Its aspect ratio is always
   preserved. Two fits are available:
   - **Cover** (default) fills the frame and crops whatever overflows, anchored
     to the top so the app's own header survives and the bottom is what gets
     cut. This is the usual store-screenshot look.
   - **Contain** shows the whole screenshot, letterboxed where the shapes differ.

   How much a cover crop costs depends on how far the target's shape is from the
   source's. From a 9:16 phone screenshot: iPhone loses nothing, phone and
   Android tablets lose ~9%, and iPad — a 3:4 canvas — loses about a third off
   the bottom. Switch that run to Contain if you need the whole screen.

   Landscape targets always contain, whatever the setting: the box beside the
   headline is roughly square, so covering it with a tall phone screenshot would
   crop away half its height.
4. **Tablet composition adapts.** A portrait phone screenshot dropped into a
   landscape tablet canvas would become a thin sliver under a wide headline, so
   the layout switches to side-by-side and centres the headline and screenshot as
   one group. This is what makes a phone screenshot usable as a tablet asset
   without owning a tablet.
5. **One pass covers the listing.** Generate renders every screenshot against
   every selected device. Each screenshot contributes its own caption as the
   headline, so a single run produces a correctly captioned set — shared styling,
   per-screenshot text.
6. **Every asset is validated** against the target it was generated for
   (dimensions, bounds, orientation, format, file size) before it is stored. A
   render that fails validation is not saved.
7. **Regenerating replaces.** A second run for the same screenshot and device
   supersedes the old asset instead of stacking duplicates into the export.

---

## Export layout

```
google-play/
  phone-portrait/screenshot-1.png
  tablet-7-portrait/screenshot-1.png
  tablet-10-landscape/screenshot-1.png
apple/
  iphone-portrait/screenshot-1.png
MANIFEST.txt
```

`screenshot-N` follows the order you arranged in the editor. Orientation is part
of the folder name, unlike the PRD sketch: a `phone/` folder holding both
portrait and landscape assets can't name them both `screenshot-1.png`.

---

## Privacy

Uploads are unreleased app screenshots, so:

- Nothing is public. Every image and archive response is served by a route that
  requires the workspace cookie, with `Cache-Control: private, no-store`.
- One workspace cannot read another's files — an id from a different session is
  simply not found.
- Uploads are capped at 8MB, must decode as PNG/JPG/WEBP, and are limited to
  10 per workspace.
- Stale workspaces are deleted rather than kept.

---

## Layout

```
app/
  lib/            ids, session cookie + middleware, formatting, concurrency
  components/ui/  buttons, fields, cards, alerts
  features/
    store/        store targets + asset validation
    screenshots/  source image analysis and validation
    templates/    template registry, style type, style parsing
    render/       layout maths (pure) + the Sharp pipeline
    storage/      the on-disk workspace
    workspace/    uploads, captions, batch generation
    export/       ZIP assembly
  routes/
    home.tsx      the whole editor
    api/          preview, screenshot, asset, and ZIP responses
supabase/parked/  schema + RLS from the account-based version, kept for later
scripts/render-preview.mjs
```

Server-only modules use the `.server.ts` suffix so Sharp, zod, and the
filesystem layer never reach the browser bundle. Shared constants live in plain
modules (`limits.ts`, `requirements.ts`) for the same reason.

---

## Implemented / not yet

**Working end to end**

- Multi-file upload — drag-and-drop or file picker — with a pending-file list
  and a busy state naming each file as it uploads
- Dimension/format/size analysis with low-resolution warnings
- Reorder, delete, and per-screenshot captions
- Device picker across all 11 Google Play and App Store targets
- Minimal template with live server-rendered preview (debounced)
- Headline, weight, alignment, text size, colours, screenshot fit (cover or
  contain), screenshot size, corner radius, drop shadow — remembered between
  visits
- Batch generation (every screenshot × every selected device) with per-asset
  store validation
- Individual PNG download and ZIP export with a manifest

**Not yet built**

- Byte-level upload progress. The busy state is indeterminate, because a
  `<Form>` submission exposes no progress events — a real percentage needs an
  XHR-based upload.
- The other four templates: Marketing, Device Mockup, Gradient, Split
- Device frames and mockups
- Brand kits (logo, saved palettes)
- Store readiness score
- Accounts, projects that outlive a cookie, plans and billing
- Analytics

**Worth knowing**

- A template is a render function, so the registry lives in
  `app/features/templates/registry.ts` rather than in data.
- The store specs in `requirements.ts` reflect the requirements at the time of
  writing. **Verify them against the current Google Play and App Store
  documentation before you rely on them.** Apple now prefers the 6.9"/13" sizes
  (1320×2868 and 2064×2752); both those and the sizes seeded here are accepted.
- Headline text is drawn with whatever font the host's fontconfig resolves. Drop
  a file into `fonts/` to pin it — see [fonts/README.md](fonts/README.md).

---

## Commands

```sh
npm run dev             # dev server with HMR
npm run typecheck       # route typegen + tsc
npm run build           # production build
npm run start           # serve the build
npm run render:preview  # render sample assets to .render-preview/
```
