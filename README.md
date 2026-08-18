# Garnet habits

A wireframe garnet crystal, white (or species-colored) on black, driven by two
sliders over the real crystallographic form space:

- **Habit** sweeps d{110} -> d+n -> n{211} -> n+h -> {321}.
- **{321} bevel** pulls hexoctahedral bevels onto whatever is there, giving the
  d+h and d+n+h combinations — including the canonical "hexoctahedral bevels on a
  dodecahedron".

Every frame is a true crystal form computed from its Miller indices, not an
artistic interpolation between shapes.

Open `index.html` in a browser, or `npm start` and visit localhost:8080.
Run `npm test` for the geometry verification suite. See CLAUDE.md for
architecture and invariants.
