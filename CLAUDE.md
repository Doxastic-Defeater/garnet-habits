# Garnet habits — continuous crystallographic form space

Interactive wireframe visualization of garnet crystal habits. A single "habit"
slider sweeps the real morphological series of the isometric garnet forms:
d{110} rhombic dodecahedron -> d+n combinations -> n{211} trapezohedron ->
n+h combinations -> {321} hexoctahedron. Every slider position is a true
crystal form computed from its Miller indices, not an artistic interpolation.

## Commands

- `npm test` — geometry verification suite (must pass before any engine change ships)
- `npm start` — serve at http://localhost:8080 (or just open index.html)

## Architecture

- `src/engine.js` — pure geometry, no DOM. `shapeAt(t)` for t in [0,2] returns
  a Map of edge-key -> [[x,y,z],[x,y,z]]. Forms are built by Sutherland-Hodgman
  clipping of each face plane against all other half-spaces. Edge keys are
  plane-pair identities ("d3|n17"), which is what makes smooth morphing possible.
- `index.html` — viewer. Precomputes a 41-step ladder of forms at load, then
  renders by crossfading adjacent steps: shared edge keys lerp, keys present in
  only one step fade in/out (these are nucleating/vanishing edges and are
  provably coincident with their replacements — see test suite).

## Crystallography invariants

The table below is verified correct — but the suite asserts **edge counts only**.
V, F, Euler, symmetry and form purity are never computed, so most of this section
is documentation, not enforcement. Concretely: setting KN0 := 1.20 (true value
1.154701, 4% wrong) still passes every asserted count, because an over-large KN0
merely delays nucleation. Only the inward constants are pinned.

| t   | form                    | V/E/F        |
|-----|-------------------------|--------------|
| 0   | d{110} dodecahedron     | 14/24/12     |
| 0.5 | d+n combination         | 62/96/36     |
| 1   | n{211} trapezohedron    | 26/48/24     |
| 1.5 | n+h combination         | 74/144/72    |
| 2   | {321} hexoctahedron     | 26/72/48     |

Euler V−E+F=2 holds at every step of the 41-step ladder — but not literally
everywhere. The `len2 < 1e-10` cull in clipShape drops the emerging form's edges
inside four ~1e-5-wide windows around t = 0, 1, 2, where its faces have already
split the neighbouring form's vertices; the wireframe then has vertices for a
polyhedron it has no edges or faces for. χ hits 36 at t=1e-5, 38 at t=1−1e-6.
Total broken measure ~5e-5 out of a domain of 2, and the ladder never samples
inside one — so nothing user-visible regresses, but don't call it an invariant
for arbitrary t.

Truncation ranges use exact radicals: {211} spans k = 2/sqrt(3) (tangent to d)
down to sqrt(3)/2 (d vanishes); {321} spans 5*sqrt(6)/(3*sqrt(14)) down to
3*sqrt(6)/(2*sqrt(14)). All four re-derived and confirmed exact to ≤2e-16.

The 1.000001 nudge factors are load-bearing at **KH1 / t=2**, not at t=0:
removing KH1's alone gives 96 edges instead of 72. Removing KN0's or KH0's
changes no asserted value today — but keep all three. KN0 and KH1 are the two
*edge*-tangency endpoints, which are the sliver-prone ones (an edge tangency
degenerates to a finite-length zero-width face that survives the cull; a point
tangency collapses to a point and does not), and Math.hypot precision is
implementation-defined, so KN0 surviving unnudged here is not portable. The
`*` vs `/` asymmetry is deliberate: KN0/KH0 move outward to suppress a
nucleating form, KH1 inward to suppress a vanishing one.

The attribution tolerance at engine.js:55 is coupled to these nudges — it must
stay below the ~1e-6 separation they create. Working window is ~1e-14 to ~5e-7;
1e-7 sits within one decade of the top edge, and 1e-6 breaks t=2.

## Hard-won lessons (do not regress)

1. Never match morph edges by spatial proximity/greedy assignment — it
   teleports edges when edge counts collapse (was 1.5–2.9 unit jumps). Edge
   identity comes from plane pairs.
2. Edge->plane-pair attribution must be geometric (midpoint-on-plane test),
   not provenance tags threaded through the clipper (tags go stale after
   successive clips).
3. The face-count jump at t≈1.0 ({321} nucleation, 24->72 faces at once) is
   correct physics — symmetry demands all 48 faces nucleate simultaneously at
   zero area. Don't "fix" it.

## Backlog

- Third zone or blend weights for triple combinations (d+n+h) and {311}
  icositetrahedron (seen on grossular). Engine handles arbitrary plane sets.
- Drag-to-rotate / inertia on the canvas.
- Face-shaded rendering mode (translucent faces + edges), per-variety RI-ish look.
- Export current form as OBJ/STL.
- Suggested review workflow: use subagents — one crystallography reviewer
  (verify invariants above + literature), one code reviewer (perf, degeneracy,
  numerical edge cases). This mirrors how the project was originally built.

## Context

Built for Scott (Ventura, CA — gemology/mineralogy background). Variety colors:
pyrope, almandine, spessartine, hessonite, demantoid, uvarovite, tuned for
black background. Labels pair each habit with the species that favor it.
