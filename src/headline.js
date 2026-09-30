/* The headline is made of stars. On arrival, points of light leave real stars
   and assemble "Come for the dark."; as the visitor scrolls, the letters come
   apart and every point flies back up to a real star in tonight's sky.
   Scroll back and they reassemble. Off under reduced motion. */
(function () {
  var S = window.UmbraScene, api = S.api;
  var h1 = document.querySelector('.c-hero .d1'), para = document.querySelector('.c-hero .p');
  var cv = document.getElementById('dust');
  if (!h1 || !cv || api.reduce) return;
  var ctx = cv.getContext('2d');
  var parts = [], targets = [], dpr = 1, ready = false, sprite = null;
  var intro = { on: false, t0: 0, dur: 2600 };
  var DISSOLVE_END = 0.95; // track position (vh) where the last letter has become a star

  function rnd(i) { var x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function makeSprite() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(236,241,255,0.9)');
    gr.addColorStop(0.45, 'rgba(200,215,255,0.22)'); gr.addColorStop(1, 'rgba(200,215,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  }

  // Sample the headline exactly where it sits: each character drawn at its own laid-out box.
  function sample() {
    var r = h1.getBoundingClientRect(), cs = getComputedStyle(h1);
    if (r.width < 10) return [];
    var size = parseFloat(cs.fontSize), off = document.createElement('canvas');
    off.width = Math.ceil(r.width + 20); off.height = Math.ceil(r.height + 20);
    var g = off.getContext('2d');
    g.font = cs.fontWeight + ' ' + size + 'px ' + cs.fontFamily;
    try { g.fontStretch = 'expanded'; } catch (e) {}
    g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
    var asc = g.measureText('Hg').fontBoundingBoxAscent || size * 0.9;
    var walker = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT), node, range = document.createRange();
    while ((node = walker.nextNode())) {
      for (var i = 0; i < node.length; i++) {
        var ch = node.data[i]; if (/\s/.test(ch)) continue;
        range.setStart(node, i); range.setEnd(node, i + 1);
        var cr = range.getClientRects()[0]; if (!cr) continue;
        g.save(); g.translate(cr.left - r.left + 10, cr.top - r.top + 10 + asc);
        var w = g.measureText(ch).width; if (w > 0) g.scale(cr.width / w, 1);
        g.fillText(ch, 0, 0); g.restore();
      }
    }
    var step = Math.max(2, Math.round(size / 30)), data = g.getImageData(0, 0, off.width, off.height).data, pts = [];
    for (var y = 0; y < off.height; y += step) for (var x = 0; x < off.width; x += step) {
      if (data[(y * off.width + x) * 4 + 3] > 120) pts.push([r.left + x - 10, r.top + y - 10]);
    }
    var cap = innerWidth < 700 ? 1300 : 2400;
    for (var k = pts.length - 1; k > 0; k--) { var j = Math.floor(rnd(k + 3) * (k + 1)); var tmp = pts[k]; pts[k] = pts[j]; pts[j] = tmp; }
    return { pts: pts.slice(0, cap), step: step, left: r.left, width: r.width };
  }

  // Real stars that are up and in frame at the end of the dissolve become the targets.
  function pickTargets() {
    var st = api.stateAt(DISSOLVE_END), cam = api.camera(st), list = window.UmbraNamedAll || [], out = [];
    for (var i = 0; i < list.length; i += 4) {
      if (list[i + 2] > 5.2) continue;
      var p = api.project(list[i], list[i + 1], st, cam);
      if (p && p.alt > 4 && p.x > 8 && p.x < api.geo.W - 8 && p.y > 70 && p.y < api.geo.H * 0.8) out.push({ ra: list[i], dec: list[i + 1], mag: list[i + 2] });
    }
    return out;
  }

  function build() {
    var s = sample(); if (!s.pts || !s.pts.length) return;
    targets = pickTargets(); if (!targets.length) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr);
    parts = s.pts.map(function (p, i) {
      var tgt = targets[Math.floor(rnd(i + 11) * targets.length)];
      var xn = (p[0] - s.left) / Math.max(s.width, 1);
      return { hx: p[0], hy: p[1], tgt: tgt, delay: 0.5 * (xn * 0.75 + rnd(i + 5) * 0.25), curl: (rnd(i + 7) - 0.5) * 160, r: s.step * (0.55 + rnd(i) * 0.35) };
    });
    ready = true;
  }

  function drawAt(st, now) {
    var W = innerWidth, H = innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var q = Math.min(Math.max(st.t / DISSOLVE_END, 0), 1);
    var introP = intro.on ? Math.min((now - intro.t0) / intro.dur, 1) : 1;
    if (!intro.on && q <= 0.0005) { h1.style.visibility = ''; return; }
    if (q >= 1) { h1.style.visibility = 'hidden'; return; }
    h1.style.visibility = intro.on && introP < 1 ? 'hidden' : q > 0.0005 ? 'hidden' : '';
    var cam = api.camera(st);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i], sp = p.tgt.sp;
      if (sp === undefined || p.tgt.stamp !== st.t) { p.tgt.sp = sp = api.project(p.tgt.ra, p.tgt.dec, st, cam); p.tgt.stamp = st.t; }
      if (!sp) continue;
      var e, a, rad;
      if (intro.on && introP < 1) {
        var li = Math.min(Math.max((introP - (0.5 - p.delay)) / 0.5, 0), 1); e = 1 - easeOut(li);
      } else {
        var qi = Math.min(Math.max((q - p.delay) / 0.5, 0), 1); e = ease(qi);
      }
      var x = p.hx + (sp.x - p.hx) * e + Math.sin(e * Math.PI) * p.curl;
      var y = p.hy + (sp.y - p.hy) * e - Math.sin(e * Math.PI) * 60;
      a = (1 - e) * 0.9 + e * 0.35 * (1 - Math.max(0, (e - 0.85) / 0.15));
      if (intro.on && introP > 0.85) a *= 1 - (introP - 0.85) / 0.15;
      rad = p.r * (1 - e) + 1.3 * e;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      var d = rad * (2.1 + e * 1.4); ctx.drawImage(sprite, x - d, y - d, d * 2, d * 2);
    }
    ctx.globalAlpha = 1;
    if (intro.on && introP >= 0.85 && !h1.classList.contains('is-lit')) { h1.classList.add('is-lit'); if (para) para.classList.add('is-lit'); }
    if (intro.on && introP >= 1) { intro.on = false; h1.style.visibility = ''; }
  }

  api.onFrame(function (st) {
    if (!ready) return;
    drawAt(st, performance.now());
    if (intro.on) api.wake(120);
  });

  function start() {
    sprite = makeSprite(); build();
    if (!ready) { document.documentElement.classList.remove('u-arriving'); return; }
    var st = api.state;
    function reveal() { document.documentElement.classList.remove('u-arriving'); }
    // The arrival: only for a fresh visit at the top, never for automation (frames must be exact).
    if (!api.automated && st && st.t < 0.02) {
      intro.on = true; intro.t0 = performance.now() + 250;
      api.wake(intro.dur + 800);
    } else reveal();
    api.repaint();
  }
  var tries = 0;
  (function wait() {
    if (api.state && api.geo && document.fonts && document.fonts.status === 'loaded') { start(); return; }
    if (tries++ < 100) setTimeout(wait, 60); else document.documentElement.classList.remove('u-arriving');
  })();
  var rb; window.addEventListener('resize', function () { clearTimeout(rb); rb = setTimeout(function () { ready = false; if (api.state && api.state.t < 0.05) build(); api.repaint(); }, 500); });
})();
