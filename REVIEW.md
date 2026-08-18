# Subagent review — crystallography + code

Two independent read-only reviewers examined `src/engine.js` and `test/verify.test.js`.
Every headline claim below was **re-verified in the main session** before being recorded
here. Baseline reviewed: commit `2e077d2`. Suite state at review time: 7/7 pass.

---

## Verdicts

**Crystallography: sound.** All four truncation radicals are exact, the V/E/F table is
correct, every shape is invariant under all 48 operations of m-3m, the endpoints are
genuinely pure forms, `shapeAt` is continuous across the t=1 seam, and the simultaneous
48-face nucleation is genuinely symmetry-required — not an artifact.

**Code: solid, with one critical defect.** The algorithm is well-conditioned and the
plane-pair attribution scheme is provably unambiguous as shipped. But the browser viewer
cannot load the engine at all.

---

## CRITICAL

### 1. The viewer is completely broken in a browser

`src/engine.js:79`

`index.html:35` loads the engine as a classic script. Nothing defines `module` in that
context, so line 79 (`module.exports = { shapeAt };`) throws `ReferenceError` **before**
line 81 sets `window.GarnetEngine`. `index.html:38` then throws `TypeError` destructuring
`undefined`. `npm test` passes because Node defines `module`, so the entire test suite is
blind to this.

Verified in main session by loading engine.js in a `vm` context with `window` but no
`module`:

```
THREW: ReferenceError: module is not defined
window.GarnetEngine is: undefined
index.html:38 THREW: TypeError: Cannot destructure property 'shapeAt' of ... as it is undefined
```

Fix — swap the order and guard both:

```js
if (typeof window !== 'undefined') window.GarnetEngine = { shapeAt };
if (typeof module !== 'undefined') module.exports = { shapeAt };
```

The guarded version was verified to load cleanly and expose `GarnetEngine`.

---

## MAJOR

### 2. CLAUDE.md documents the load-bearing nudge on the wrong endpoint

`src/engine.js:69-70`

CLAUDE.md says the nudges prevented "48 edges at t=0 instead of 24". The failure is real
and reproducible — but it happens at **t=2, from KH1**, not at t=0 from KN0.

Verified in main session:

```
shipped (all nudges)     t=0: 24  t=1: 48  t=2: 72  OK
NO nudges at all         t=0: 24  t=1: 48  t=2: 96  BROKEN
KN0 nudge removed only   t=0: 24  t=1: 48  t=2: 72  OK
KH1 nudge removed only   t=0: 24  t=1: 48  t=2: 96  BROKEN
```

The `*` vs `/` asymmetry is principled, not accidental: KN0/KH0 move outward to suppress a
nucleating form, KH1 moves inward to suppress a vanishing one. KN0 and KH1 are the two
*edge*-tangency endpoints, which are the sliver-prone ones — an edge tangency degenerates
to a finite-length zero-width face that survives the `len2` cull, whereas a point tangency
does not. So keeping all three is correct: `Math.hypot` precision is implementation-defined,
so KN0 passing unnudged today is not portable. **This is a documentation fix, not a code
fix.**

### 3. The 1e-7 attribution tolerance is coupled to the 1.000001 nudge with ~10x margin

`src/engine.js:55`, coupled to `:69-70`

The nudge is the only thing separating the tangent plane from the face plane (~1e-6
pre-scale). The tolerance must stay below it. Verified in main session:

```
tol=1e-6   t=0:24  t=2:96  BROKEN
tol=5e-7   t=0:24  t=2:72  OK
tol=1e-7   t=0:24  t=2:72  OK   <- shipped
tol=1e-10  t=0:24  t=2:72  OK
tol=1e-14  t=0:24  t=2:72  OK
```

The working window spans ~1e-14 to ~5e-7 and the shipped value sits within one decade of
its top edge. Reviewer reports `1e-10` is bit-identical to shipped output across all 41
ladder steps, which would recentre it with ~4 orders of margin each way. The suite does
catch a break here, so it cannot ship silently.

### 4. The suite asserts none of the crystallographic invariants CLAUDE.md claims

`test/verify.test.js:15-17`

Only edge counts are asserted; V, F, Euler, symmetry and form purity are never computed.
Reviewer demonstrated the constants are barely pinned — setting `KN0 := 1.20` (true value
1.154701, i.e. 4% wrong) still passes every asserted edge count, because an over-large KN0
merely delays nucleation. Only the inward constants are pinned.

Proposed additions, all verified to hold today so they can land green: V and F plus
`V-E+F=2` at every ladder step (stating the merge tolerance); point-group invariance under
all 48 signed permutations; form purity at endpoints (only `d` at t=0, `n` at t=1, `h` at
t=2); the face-polygon census; vertex-radius shell ratios; tangency-constant pinning via
presence/absence at `k*(1±1e-4)`; seam continuity; and planarity/convexity.

---

## MINOR

### 5. "Euler V-E+F=2 everywhere" is false in four narrow windows

`CLAUDE.md`; root cause `src/engine.js:49`

The `len2 < 1e-10` gate drops edges shorter than 1e-5. Inside a nucleation/extinction
window the emerging form's edges are culled although its faces have already split the
neighbouring form's vertices, so the wireframe has vertices for a polyhedron it has no
edges or faces for. Verified in main session:

```
t=0.00001    V/E/F=48/48/36   chi=36
t=0.00002    V/E/F=54/72/36   chi=18
t=0.999999   V/E/F=62/48/24   chi=38
t=1.00002    V/E/F=62/96/72   chi=38
t=1.999988   V/E/F=60/96/72   chi=36
```

Total broken measure ~5e-5 out of a domain of 2. The 41-step ladder never lands inside one
(chi=2 at all 401 uniform samples checked in the main session), so nothing user-visible
regresses — but the documented invariant is literally false for arbitrary t.

### 6. Pure {321} at t=2 is a legal form but not an observed garnet habit

`CLAUDE.md`, `src/engine.js:76-77`

{321} is confirmed as the standard hexoctahedron index for garnet, and d{110} → n{211} is
confirmed as the real dominant series — with habit correlating to composition
(dodecahedra grossular-rich, trapezohedra pyrope/almandine/spessartine-rich), which
corroborates the CLAUDE.md variety pairings. But the hexoctahedron alone is described in
the literature as a very rare form; it appears as small modifying bevels, most canonically
on d{110}, which this two-branch parameterization cannot produce (branch 2 drops the d
planes entirely). CLAUDE.md's backlog item for triple d+n+h combinations is the right fix.

Reviewer could not source the {311}-on-grossular claim — treat as unverified. Geometrically
it is coherent: `permsSigns([3,1,1])` yields 24 planes and {hll} is a deltoidal
icositetrahedron.

Sources cited: [mindat — Isometric System](https://www.mindat.org/article.php/2823/Crystallography%3A+The+Isometric+System),
[Britannica — Garnet](https://www.britannica.com/science/garnet),
[Geology is the Way — Garnet group](https://geologyistheway.com/minerals/garnet-group/).

### 7. Other confirmed minor items

- **`shapeAt` has no domain validation.** `shapeAt(NaN)`, `shapeAt(undefined)` and
  `shapeAt(11)` all return an *empty Map* — a blank canvas with no diagnostic.
  `shapeAt(-1)` silently returns the plain dodecahedron; `shapeAt(5)` the hexoctahedron.
  No NaN/Infinity ever escapes into output coordinates, so `sc = 1.7/0 = Infinity` is
  computed on the empty path but never applied.
- **The `src` field (`:29`, `:40`) is genuinely dead** — only write sites, no reads anywhere
  in `src/`, `test/` or `index.html`. Leftover from the abandoned provenance-tag approach.
  Costs a property on ~55k allocations per ladder build.
- **The test's displacement check is blind to NaN** (`test/verify.test.js:27-33`):
  `disp > worst` is false for NaN, so a corrupted persistent edge never registers. Injection
  test still reported the clean 0.0831 baseline. It does correctly catch a 5-unit teleport.
- **The 0.0025 coincidence threshold is the one genuinely fitted constant** — worst accepted
  distance 0.04006 against 0.05 allowed, only 1.25x margin.
- **The 0.01 length gate exempts 62% of fading edges** and is not load-bearing; dropping it
  to 0 tests 2.7x as many edges and still passes.
- **`L = 10` and the absolute tolerance cap the usable k range at roughly [0.2, 11]**,
  contradicting "engine handles arbitrary plane sets". Above k≈11 every face clips to
  nothing and an empty Map is returned with no error. Relevant to the backlog.

---

## Performance — do nothing

The 107ms ladder is ~80% JIT warm-up. Steady state is 21–24ms for all 41 shapes. Cost
split: clip phase 20.8ms (81%), attribution 4.8ms (19%) — so the dominant cost is the O(F²)
clip loop, not the per-edge attribution scan. The reviewer built the obvious
output-preserving optimization (cache per-vertex plane distances, skip clips with no
outside vertex), verified it bit-identical, and measured it **slower**: 32.6ms vs 25.2ms.
V8 handles the naive version better. The only free win is deleting the dead `src` property.

---

## Checked and found correct (negative results)

- All four truncation radicals are exact — re-derived independently from support functions,
  matching to ≤2e-16 relative. KN0 and KH1 match to 0 ulp.
- The full V/E/F table: 14/24/12, 62/96/36, 26/48/24, 74/144/72, 26/72/48 — reproduced
  exactly in the main session, and identical across merge tolerances from 1e-9 to 1e-2, so
  it is not a tolerance artifact.
- Face counts from `permsSigns`: 12/24/48 for {110}/{211}/{321}, correct by enumeration and
  by execution. The `-0` hazard is a non-issue: `String(-0) === "0"`, so the merge is right
  and intended.
- Every shape has full m-3m symmetry (max deviation 4.7e-15 to 2.3e-14).
- `shapeAt` is continuous at the t=1 seam; Hausdorff distance scales linearly to 1.69e-8,
  and shapeAt(1) matches the branch-2 limit to 4.9e-15. The maxR rescale removes a genuine
  similarity, not a shape difference — so it is load-bearing for seam continuity.
- Simultaneous 48-face {321} nucleation is symmetry-required: at KH0 the planes touch the
  trapezohedron at its 12 ⟨110⟩ vertices, 4 planes per vertex. The same happens at t=0 with
  24 {211} faces on the 24 dodecahedron edges — so t=0 is the numerically nastier of the two.
- The first-match `break` in attribution is never exercised ambiguously as shipped: across
  1010 t values including probes 1e-12 from the tangency endpoints, zero edges ever had more
  than one candidate plane. Accepted midpoint residuals max at 2.2e-15 while the nearest
  rejected plane is never closer than 1.0e-6. Ordering is deterministic by spec, not luck.
- The 0.9 `ref` threshold is safe for every normal generated (measured min |u| = 0.5774).
- `if (s === f) continue` is correct as written, but silently fragile — introduce any clone
  and every fader self-covers at distance 0, turning the check into a vacuous PASS.
- `STEPS = 40` correctly mirrors `index.html:43`.
- Returned edge arrays are freshly allocated, so callers cannot mutate engine internals.
