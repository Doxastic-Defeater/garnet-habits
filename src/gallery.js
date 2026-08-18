/* Garnet habits — gallery tiles.
   Classic script, no modules, no deps. Renders the seven reachable habits into
   #gallery-mount, each on its own small canvas driven by window.GarnetEngine.

   The projection (rotP, perspective, depth alpha/linewidth) is a copy of the
   viewer's in index.html, not a reach into viewer internals. Shapes are computed
   once per tile and cached; only the projection runs per frame, on one shared
   rAF loop that idles when the page is hidden or the gallery is off-screen. */
(function () {
  'use strict';

  // (t, m) verified against the engine: formsPresent(shapeAt(t, m)) yields
  // exactly `key`, with the edge count from the CLAUDE.md V/E/F table.
  // Titles and captions are copied verbatim from the `habits` map in index.html.
  var TILES = [
    { key: 'd',   t: 0,   m: 0,
      title: 'Dodecahedron d{110}',
      sym: '{110}', vef: '14 / 24 / 12',
      caption: 'favored by grossular, andradite, uvarovite' },
    { key: 'dn',  t: 0.5, m: 0,
      title: 'Combination d{110} + n{211}',
      sym: '{110} + {211}', vef: '62 / 96 / 36',
      caption: 'the classic garnet: almandine, pyrope, grossular' },
    { key: 'n',   t: 1,   m: 0,
      title: 'Trapezohedron n{211}',
      sym: '{211}', vef: '26 / 48 / 24',
      caption: 'favored by almandine, spessartine, pyrope' },
    { key: 'nh',  t: 1.5, m: 0,
      title: 'Combination n{211} + {321}',
      sym: '{211} + {321}', vef: '74 / 144 / 72',
      caption: 'spessartine and andradite with hexoctahedral faces' },
    { key: 'h',   t: 2,   m: 0,
      title: 'Hexoctahedron {321}',
      sym: '{321}', vef: '26 / 72 / 48',
      caption: 'rare: melanite andradite' },
    { key: 'dh',  t: 0,   m: 0.5,
      title: 'Combination d{110} + {321}',
      sym: '{110} + {321}', vef: '62 / 120 / 60',
      caption: 'dodecahedron with hexoctahedral bevels — melanite andradite' },
    { key: 'dnh', t: 0.5, m: 0.3,
      title: 'Combination d{110} + n{211} + {321}',
      sym: '{110} + {211} + {321}', vef: '110 / 192 / 84',
      caption: 'the classic d+n habit with hexoctahedral bevels' }
  ];

  var SIZE = 320;    // canvas backing px (CSS width is 100% of the tile)
  var CAM = 5.2;     // same perspective camera as the viewer
  var SPIN = 0.25;   // quarter of the viewer's rotation rate
  var FPS = 30;      // half the viewer's frame rate — the tiles barely move

  function init() {
    var engine = window.GarnetEngine;
    if (!engine || typeof engine.shapeAt !== 'function') {
      console.warn('gallery.js: window.GarnetEngine not found — gallery not rendered.');
      return;
    }
    var mount = document.getElementById('gallery-mount');
    if (!mount) return;

    // --------------------------------------------------------------- links

    // Slider step is 0.005, so 3 decimals is lossless; trim trailing zeros.
    function fmt(x) { return (+x.toFixed(3)).toString(); }

    // URL contract: ?t=&m=&v= with defaults omitted. Relative, and it drops any
    // stale query so the plain href works with JavaScript-driven state off.
    function hrefFor(t, m) {
      var q = [];
      if (t !== 0) q.push('t=' + fmt(t));
      if (m !== 0) q.push('m=' + fmt(m));
      var base = location.pathname.split('/').pop() || './';
      return base + (q.length ? '?' + q.join('&') : '') + '#viewer';
    }

    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    function activate(ev, t, m) {
      if (ev.defaultPrevented) return;
      if (ev.button && ev.button !== 0) return;
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var V = window.GarnetViewer;
      if (!V || typeof V.setState !== 'function') return;  // fall through to href
      V.setState({ t: t, m: m });
      ev.preventDefault();
      var sec = document.getElementById('viewer');
      if (sec && sec.scrollIntoView) {
        sec.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      }
    }

    // --------------------------------------------------------------- build

    var tiles = [];
    var frag = document.createDocumentFragment();

    for (var i = 0; i < TILES.length; i++) {
      var spec = TILES[i];
      var href = hrefFor(spec.t, spec.m);
      var label = 'Open ' + spec.title + ' in the viewer';

      var el = document.createElement('div');
      el.className = 'tile';

      var cLink = document.createElement('a');
      cLink.className = 'tile-canvas-link';
      cLink.href = href;
      cLink.setAttribute('aria-label', label);
      cLink.style.display = 'block';
      cLink.tabIndex = -1;               // the "Open in viewer" link is the tab stop

      var canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', spec.title + ' wireframe');
      cLink.appendChild(canvas);
      el.appendChild(cLink);

      var title = document.createElement('div');
      title.className = 'tile-title';
      title.textContent = spec.title;
      el.appendChild(title);

      var sym = document.createElement('div');
      sym.className = 'tile-sym';
      sym.textContent = spec.sym;
      el.appendChild(sym);

      var vef = document.createElement('div');
      vef.className = 'tile-vef';
      vef.textContent = 'V/E/F ' + spec.vef;
      el.appendChild(vef);

      var cap = document.createElement('p');
      cap.className = 'tile-caption';
      cap.textContent = spec.caption;
      el.appendChild(cap);

      var link = document.createElement('a');
      link.className = 'tile-link';
      link.href = href;
      link.textContent = 'Open in viewer';
      link.setAttribute('aria-label', label);
      el.appendChild(link);

      (function (t, m) {
        var go = function (ev) { activate(ev, t, m); };
        cLink.addEventListener('click', go);
        link.addEventListener('click', go);
      })(spec.t, spec.m);

      var ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // Compute the shape once; the frame loop only re-projects it.
      var segs = [];
      var shape = engine.shapeAt(spec.t, spec.m);
      shape.forEach(function (s) { segs.push(s); });

      tiles.push({ ctx: ctx, segs: segs });
      frag.appendChild(el);
    }

    mount.appendChild(frag);

    // -------------------------------------------------------------- render

    function rotP(v, cy, sy, cx, sx) {
      var x1 = v[0]*cy + v[2]*sy, z1 = -v[0]*sy + v[2]*cy;
      return [x1, v[1]*cx - z1*sx, v[1]*sx + z1*cx];
    }

    var scale = SIZE * 0.74, lwk = SIZE / 560;

    function drawTile(tile, cy, sy, cx, sx) {
      var ctx = tile.ctx, segs = tile.segs;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.lineCap = 'round';
      for (var i = 0; i < segs.length; i++) {
        var p1 = rotP(segs[i][0], cy, sy, cx, sx), p2 = rotP(segs[i][1], cy, sy, cx, sx);
        var dt = Math.max(0, Math.min(1, ((p1[2]+p2[2])/2 + 1.8) / 3.6));
        var alpha = 0.2 + 0.75*dt;
        if (alpha < 0.01) continue;
        ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(3) + ')';
        ctx.lineWidth = (1.8 + 2.2*dt) * lwk;
        var s1 = scale / (CAM - p1[2]), s2 = scale / (CAM - p2[2]);
        ctx.beginPath();
        ctx.moveTo(SIZE/2 + p1[0]*s1, SIZE/2 - p1[1]*s1);
        ctx.lineTo(SIZE/2 + p2[0]*s2, SIZE/2 - p2[1]*s2);
        ctx.stroke();
      }
    }

    var rx = 0.4, ry = 0.2;

    function drawAll() {
      var cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
      for (var i = 0; i < tiles.length; i++) drawTile(tiles[i], cy, sy, cx, sx);
    }

    drawAll();
    if (reduce) return;   // static tiles, no loop at all

    var raf = 0, last = 0, onScreen = true;

    function tick(ts) {
      raf = requestAnimationFrame(tick);
      var dt = ts - last;
      if (dt < 1000/FPS) return;
      last = ts;
      var step = Math.min(100, dt) / 16.7;
      ry += 0.006 * SPIN * step;
      rx += 0.0025 * SPIN * step;
      drawAll();
    }

    function start() {
      if (raf) return;
      last = 0;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    }
    function sync() {
      if (onScreen && !document.hidden) start(); else stop();
    }

    document.addEventListener('visibilitychange', sync);

    // Start optimistically: the observer's first callback corrects `onScreen`
    // within a frame or two, and where IntersectionObserver never delivers
    // (or does not exist) the tiles keep working.
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        sync();
      }, { rootMargin: '120px' }).observe(mount);
    }
    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
