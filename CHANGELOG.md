# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-08-18

### Added

- GitHub Pages site: the viewer as the landing page, then a live gallery of the
  seven habits, a guide to the sliders and the (a,b) form space, "How it works",
  engine API docs and references.
- Permalinks — the shape state lives in the URL as `?t=&m=&v=` — plus preset chips
  for the seven habits, a Copy link button and Save PNG.
- `404.html`, `favicon.svg`, `.nojekyll` and OG/Twitter card metadata.
- `tools/region-map.js` → `assets/region-map.svg` and `tools/og-card.js` →
  `assets/og.png`: deterministic, zero-dependency generators that re-derive their
  content from the engine and fail if it disagrees.
- `tools/serve.js`, a zero-dependency static server for local development.
- `.github/workflows/test.yml` — `npm test` on node 18 and 20, plus a job that
  regenerates `assets/` and fails if the committed output is stale.

### Changed

- `site.css` extracted from `index.html`; the page is now a header, six sections
  and a footer rather than a single bare canvas.
- README rewritten: live demo, sliders, habit table, local run, engine usage,
  design notes, citation.

## [1.0.0] — 2026-08-17

### Added

- Two-parameter form space: `formAt(a, b)` over the unit square, with the d{110},
  n{211} and {321} plane sets in every combination they can occur in, and a
  "{321} bevel" slider reaching d+h and d+n+h.
- 13-check invariant suite (`npm test`): V/E/F and χ, m-3m symmetry, form purity,
  the face census, vertex shells, tangency-constant pinning at k(1 ± 1e-4), seam
  and 2D continuity, `RangeError` domain semantics, a `vm` load smoke test and
  golden-path fixtures against the pre-1.0 engine.
- MIT license.

### Fixed

- The viewer could not load the engine in a browser at all: `module.exports` threw
  before `window.GarnetEngine` was set. Exports are now guarded and ordered, and
  the `vm` smoke check covers it.
- Attribution tolerance 1e-7 → 1e-10, recentring it in its working window;
  verified bit-identical across a 21×21 grid and the 41-step ladder.
- `RangeError` on `NaN`/`undefined`/`Infinity`/out-of-range input instead of a
  silently empty shape; dead `src` field removed; NaN-guard on the displacement
  check.
- CLAUDE.md corrected: the load-bearing nudge was documented on the wrong endpoint,
  and χ = 2 is now stated with its scope rather than as an invariant.

[1.1.0]: https://github.com/Doxastic-Defeater/garnet-habits/releases/tag/v1.1.0
[1.0.0]: https://github.com/Doxastic-Defeater/garnet-habits/releases/tag/v1.0.0
