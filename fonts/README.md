# Bundled fonts

The renderer draws headlines with Pango. By default it asks the host's
fontconfig for the family named in the template config (`Inter`), which means
output can differ between your laptop and your server.

To pin it, drop a font file here named after the family with spaces removed:

```
fonts/Inter.ttf
fonts/Inter.otf
```

`resolveFontFile()` in `app/features/render/render.server.ts` picks it up
automatically and passes it to Pango, so every environment renders identically.
Inter is available under the SIL Open Font License at
https://github.com/rsms/inter/releases.
