# skramz.org design tokens — 90s DIY Zine Brutalism

Source of truth: `src/index.css` (`@theme` block). Keep this file in sync
with the CSS when tokens change.

## Fonts

- UI + body: `Courier New`, `ui-monospace`, `SFMono-Regular`, `Menlo`,
  monospace (`--font-zine`). Monospace everywhere; no webfont downloads
  (lightweight DOM budget).

## Colors

| Token          | Value     | Use                          |
| -------------- | --------- | ---------------------------- |
| `--color-ink`  | `#0a0a0a` | Text, borders, print layer    |
| `--color-paper`| `#fafafa` | Page background               |
| `--color-acid` | `#c8ff00` | Neon accent, sparingly (links, highlights) |

Strict black-on-white print base; the acid accent is the only color.

## Corners

- Corner radius is always `0` (`--radius-zine: 0px`). Sharp corners, no
  rounding anywhere.

## Texture

- `.zine-halftone`: radial-gradient dot grid (`6px` tile), `currentcolor`
  dots — photocopied/halftone print feel for image treatments.
- `.zine-border`: `3px` solid ink border, radius `0`.

## Layout

- Root `App` component holds the persistent player slot + nav above the
  route outlet; client-side navigation never unmounts the player
  (uninterrupted audio). See `src/App.tsx` and `src/App.test.tsx`.
- `PlayerSlot` (`src/PlayerSlot.tsx`) is deliberately stateless — no hooks,
  no mount counting. Persistence is structural (slot lives outside the
  route outlet); the test asserts the same DOM node survives navigation.
