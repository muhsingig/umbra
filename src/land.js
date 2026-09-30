/* Umbra landscape planes. Everything is authored in world angles (azimuth,
   altitude in degrees) and projected with the same focal length as the sky, so
   the ridges, the lake shore and the silhouettes sit exactly on the horizon the
   renderer draws. Back to front: far range (canvas, three lighting states),
   near shore with the lodge (SVG), observer and telescope (SVG), foreground
   mound and prayer flags (SVG). */
(function (g) {
  var D2R = Math.PI / 180, NS = 'http://www.w3.org/2000/svg';

  function fract(x) { return x - Math.floor(x); }
  function hash1(i) { return fract(Math.sin(i * 127.1 + 311.7) * 43758.5453); }
  function hash2(i, j) { return fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453); }
  function sm(t) { return t * t * (3 - 2 * t); }
  function n1(x) { var i = Math.floor(x), f = x - i; return hash1(i) + (hash1(i + 1) - hash1(i)) * sm(f); }
  function n2(x, y) {
    var i = Math.floor(x), j = Math.floor(y), fx = sm(x - i), fy = sm(y - j);
    var a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm1(x) { return n1(x) * 0.5 + n1(x * 2.03 + 7) * 0.25 + n1(x * 4.1 + 3) * 0.125 + n1(x * 8.3 + 11) * 0.0625; }
  function ridge(x) { var v = 1 - Math.abs(2 * n1(x) - 1); return v * v; }
  function smoothstep(a, b, x) { var t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); }
  function el(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  // Far Himalayan range: height in degrees above the horizon, by azimuth.
  function farH(az) {
    var h = 1.0 + 0.9 * fbm1(az * 0.045 + 3.1);
    h += 3.1 * ridge(az * 0.028 + 1.7) + 1.5 * ridge(az * 0.071 + 5.2) + 0.55 * ridge(az * 0.17 + 9.1) + 0.2 * ridge(az * 0.43 + 2.2);
    h += 2.6 * Math.exp(-Math.pow((az - 12) / 6.5, 2)) + 1.6 * Math.exp(-Math.pow((az - 38) / 8, 2));
    h *= 1.28 * (0.5 + 0.5 * smoothstep(-26, 2, az));
    return h;
  }
  // Near shore: negative dips below the horizon and lets the lake show.
  function midH(az) {
    var h = -3.3 + 3.9 * smoothstep(8, 25, az) + 3.2 * smoothstep(-36, -62, az);
    h += 0.9 * (fbm1(az * 0.06 + 20) - 0.5) + 0.3 * (fbm1(az * 0.25 + 3) - 0.5) + 0.08 * (n1(az * 1.3) - 0.5);
    h -= 0.35 * Math.exp(-Math.pow((az - 46) / 6, 2));
    return h;
  }

  function Land(root) {
    this.root = root;
    this.far = root.querySelector('[data-plane="far"]');
    this.mid = root.querySelector('[data-plane="mid"]');
    this.subj = root.querySelector('[data-plane="subj"]');
    this.fg = root.querySelector('[data-plane="fg"]');
  }

  Land.prototype.build = function (geo) {
    this.geo = geo;
    var W = geo.W, H = geo.H, f = geo.f;
    this.m = Math.round(W * 0.1 + 60 + f * 0.3); // covers the camera's azimuth pan plus pointer parallax
    this.buildFar(W, H, f);
    this.buildMid(W, H, f);
    this.buildSubject(W, H, f, geo.tall);
    this.buildFg(W, H, f, geo.tall);
  };

  Land.prototype.xOf = function (az) { return this.m + this.geo.W / 2 + this.geo.f * Math.tan(az * D2R); };
  Land.prototype.azOf = function (x) { return Math.atan((x - this.m - this.geo.W / 2) / this.geo.f) / D2R; };

  Land.prototype.buildFar = function (W, H, f) {
    var PW = W + 2 * this.m, PH = Math.ceil(f * Math.tan(15 * D2R)) + 6, Y0 = PH - 3;
    this.farY0 = Y0;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var cw = Math.round(PW * dpr), ch = Math.round(PH * dpr);
    var names = ['night', 'dusk', 'dawn'], ctxs = [], imgs = [];
    this.far.innerHTML = '';
    for (var k = 0; k < 3; k++) {
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      c.style.width = PW + 'px'; c.style.height = PH + 'px'; c.className = 'far far--' + names[k];
      this.far.appendChild(c); var cx = c.getContext('2d'); ctxs.push(cx); imgs.push(cx.createImageData(cw, ch));
    }
    this.farCanvases = this.far.querySelectorAll('canvas');
    var fd = f * dpr, W0 = (this.m + W / 2) * dpr, Y0d = Y0 * dpr;
    var pal = {
      night: { rock: [8, 11, 19], snow: [44, 52, 74], haze: [12, 16, 28], lit: [0, 0, 0] },
      dusk: { rock: [24, 29, 47], snow: [88, 100, 138], haze: [52, 64, 98], lit: [206, 150, 170] },
      dawn: { rock: [27, 29, 47], snow: [80, 88, 122], haze: [86, 82, 114], lit: [236, 172, 150] }
    };
    var P = [pal.night, pal.dusk, pal.dawn];
    for (var x = 0; x < cw; x++) {
      var az = Math.atan((x - W0) / fd) / D2R;
      var h = farH(az), slope = (farH(az + 0.08) - farH(az - 0.08)) / 0.16;
      var top = Y0d - fd * Math.tan(h * D2R);
      var snowLine = 4.2 + 1.4 * n1(az * 0.11 + 4);
      var y0 = Math.max(0, Math.floor(top));
      for (var y = y0; y < ch; y++) {
        var cover = Math.min(1, y + 1 - top);
        if (cover <= 0) continue;
        var alt = Math.atan((Y0d - y) / fd) / D2R;
        var depth = h - alt;
        var streak = n2(az * 1.35, alt * 0.55) * 0.7 + n2(az * 4.1, alt * 2.2) * 0.3;
        var snow = smoothstep(snowLine - 0.5, snowLine + 0.4, alt + (streak - 0.5) * 1.6);
        snow *= smoothstep(0.18, 0.5, streak + depth * 0.05);
        snow = Math.min(1, snow * (0.75 + 0.5 * n2(az * 9, alt * 9)));
        var rim = Math.exp(-depth / 0.12) * 0.5;
        var haze = Math.exp(-Math.max(alt, 0) / 1.6) * 0.62;
        var idx = (y * cw + x) * 4;
        for (var k2 = 0; k2 < 3; k2++) {
          var p = P[k2];
          var litAmt = k2 === 1 ? smoothstep(0.05, 0.6, slope) : k2 === 2 ? smoothstep(0.05, 0.6, -slope) : 0;
          litAmt *= smoothstep(3, 10, alt) * snow;
          var d = imgs[k2].data;
          for (var ch3 = 0; ch3 < 3; ch3++) {
            var v = p.rock[ch3] + (p.snow[ch3] - p.rock[ch3]) * snow;
            v += (p.lit[ch3] - v) * litAmt * 0.85;
            v += (p.snow[ch3] - v) * rim * 0.35;
            v += (p.haze[ch3] - v) * haze;
            d[idx + ch3] = v;
          }
          d[idx + 3] = 255 * cover;
        }
      }
    }
    for (var k3 = 0; k3 < 3; k3++) {
      ctxs[k3].putImageData(imgs[k3], 0, 0);
      // The still lake mirrors the range: a flipped, dimmed copy hung from the shore line.
      var rc = document.createElement('canvas'); rc.width = cw; rc.height = ch;
      rc.style.width = PW + 'px'; rc.style.height = PH + 'px'; rc.style.top = (Y0 + 1) + 'px';
      rc.className = 'far far--refl far--' + names[k3];
      var rx = rc.getContext('2d'); rx.translate(0, ch); rx.scale(1, -1); rx.drawImage(ctxs[k3].canvas, 0, -3 * dpr);
      this.far.appendChild(rc);
    }
    this.far.style.width = PW + 'px'; this.far.style.height = (2 * PH) + 'px';
  };

  Land.prototype.buildMid = function (W, H, f) {
    var PW = W + 2 * this.m, top = Math.ceil(f * Math.tan(3.2 * D2R)) + 4, PH = top + Math.ceil(H * 1.1);
    this.midY0 = top;
    var svg = el('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH, 'aria-hidden': 'true' });
    var self = this, pts = [], x;
    for (x = -4; x <= PW + 4; x += 3) {
      var az = this.azOf(x);
      pts.push(x.toFixed(1) + ',' + (top - f * Math.tan(midH(az) * D2R)).toFixed(1));
    }
    var d = 'M' + pts.join(' L') + ' L' + (PW + 4) + ',' + PH + ' L-4,' + PH + ' Z';
    var defs = el('defs', {});
    var grad = el('linearGradient', { id: 'midg', x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el('stop', { offset: '0', 'stop-color': 'var(--c-mid-top)' }));
    grad.appendChild(el('stop', { offset: String(Math.min(0.2, (f * 0.06) / PH)), 'stop-color': 'var(--c-mid)' }));
    grad.appendChild(el('stop', { offset: '1', 'stop-color': 'var(--c-mid-deep)' }));
    defs.appendChild(grad); svg.appendChild(defs);
    svg.appendChild(el('path', { d: d, fill: 'url(#midg)' }));

    // The lodge: low cabins and one observatory dome on the eastern shoulder.
    var ppd = f * D2R, lights = [];
    function base(az) { return top - f * Math.tan((midH(az) - 0.08) * D2R); }
    var cabins = [[24.2, 1.2], [25.9, 1.0], [30.2, 1.3], [31.9, 0.9], [33.4, 1.1]];
    cabins.forEach(function (c, i) {
      var x0 = self.xOf(c[0]), w = c[1] * ppd, y = base(c[0] + c[1] / 2), hgt = 0.42 * ppd, roof = 0.2 * ppd;
      svg.appendChild(el('path', { d: 'M' + x0 + ',' + (y + 4) + ' L' + x0 + ',' + (y - hgt) + ' L' + (x0 + w / 2) + ',' + (y - hgt - roof) + ' L' + (x0 + w) + ',' + (y - hgt) + ' L' + (x0 + w) + ',' + (y + 4) + ' Z', fill: 'var(--c-mid)' }));
      lights.push({ x: x0 + w * (i % 2 ? 0.3 : 0.62), y: y - hgt * 0.45, s: 1 });
      if (i === 2) lights.push({ x: x0 + w * 0.22, y: y - hgt * 0.45, s: 0.7 });
    });
    var dz = 28.1, dx = this.xOf(dz), dy = base(dz), dr = 0.62 * ppd, drum = 0.38 * ppd;
    svg.appendChild(el('path', { d: 'M' + (dx - dr) + ',' + (dy + 4) + ' L' + (dx - dr) + ',' + (dy - drum) + ' A' + dr + ',' + dr + ' 0 0 1 ' + (dx + dr) + ',' + (dy - drum) + ' L' + (dx + dr) + ',' + (dy + 4) + ' Z', fill: 'var(--c-dome)' }));
    svg.appendChild(el('path', { d: 'M' + (dx - dr * 0.12) + ',' + (dy - drum - dr * 0.99) + ' L' + (dx + dr * 0.12) + ',' + (dy - drum - dr * 0.99) + ' L' + (dx + dr * 0.14) + ',' + (dy - drum) + ' L' + (dx - dr * 0.14) + ',' + (dy - drum) + ' Z', fill: 'var(--c-mid)' }));
    lights.push({ x: dx, y: dy - drum - dr * 0.45, s: 0.55 });

    this.mid.innerHTML = '';
    this.mid.appendChild(svg);
    lights.forEach(function (L) {
      var s = document.createElement('i'); s.className = 'win';
      s.style.left = L.x + 'px'; s.style.top = L.y + 'px'; s.style.setProperty('--s', L.s);
      self.mid.appendChild(s);
    });
    this.mid.style.width = PW + 'px'; this.mid.style.height = PH + 'px';
  };

  // Observer and a 16-inch Dobsonian, drawn in degrees (y up) then scaled.
  Land.prototype.buildSubject = function (W, H, f, tall) {
    var PW = W + 2 * this.m, Y0 = Math.round(H * 0.4), PH = Math.round(H * 1.45);
    this.subjY0 = Y0;
    var ppd = f * D2R;
    var baseAz = tall ? 1.5 : 15.5, baseAlt = tall ? -7.2 : -5.6;
    var ox = this.xOf(baseAz), oy = Y0 - f * Math.tan(baseAlt * D2R);
    var svg = el('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH, 'aria-hidden': 'true' });
    var gg = el('g', { transform: 'translate(' + ox.toFixed(1) + ',' + oy.toFixed(1) + ') scale(' + ppd.toFixed(3) + ',' + (-ppd).toFixed(3) + ')', fill: 'var(--c-subj)' });
    svg.appendChild(gg);
    function poly(p) { gg.appendChild(el('path', { d: 'M' + p.map(function (q) { return q[0].toFixed(3) + ',' + q[1].toFixed(3); }).join(' L') + ' Z' })); }
    function ell(cx, cy, rx, ry, rot) { gg.appendChild(el('ellipse', { cx: cx, cy: cy, rx: rx, ry: ry, transform: 'rotate(' + (rot || 0) + ' ' + cx + ' ' + cy + ')' })); }

    // near ground: a knoll the observer stands on, falling away to the left to show the lake
    function gy(x) { return -8.5 * smoothstep(-5, -27, x) - 3.2 * smoothstep(11, 34, x) + 0.16 * (n1(x * 0.9 + 3) - 0.5) + 0.05 * (n1(x * 4.1) - 0.5); }
    var rock = [], x;
    for (x = -60; x <= 60; x += 0.3) rock.push([x, gy(x)]);
    rock.push([60, -80], [-60, -80]);
    poly(rock);
    // a few boulders on the knoll
    [[-3.6, 0.55, 0.5], [9.2, 0.7, 0.45], [12.4, 0.45, 0.35], [-9.5, 0.8, 0.6]].forEach(function (b) { ell(b[0], gy(b[0]) + b[2] * 0.4, b[1] * 1.6, b[2], 0); });
    // grass tufts on the rock
    for (var k = 0; k < 34; k++) {
      var gx = -14 + hash1(k + 40) * 40, g0 = gy(gx) - 0.05;
      for (var b = 0; b < 5; b++) {
        var bl = 0.35 + hash1(k * 7 + b) * 0.45, lean = (hash1(k * 3 + b) - 0.5) * 0.5;
        poly([[gx + b * 0.05 - 0.04, g0], [gx + b * 0.05 + lean, g0 + bl], [gx + b * 0.05 + 0.04, g0]]);
      }
    }
    // Dobsonian: ground board, rocker box, tube on its trunnion.
    poly([[-2.5, -0.05], [2.5, -0.05], [2.4, 0.3], [-2.4, 0.3]]);
    poly([[-2.05, 0.3], [2.05, 0.3], [2.05, 2.75], [0.75, 2.75], [0.5, 2.2], [-0.5, 2.2], [-0.75, 2.75], [-2.05, 2.75]]);
    var th = 124 * D2R, ux = Math.cos(th), uy = Math.sin(th), vx = -uy, vy = ux, px = 0, py = 2.7;
    function tubeSeg(a, b, r) { poly([[px + ux * a + vx * r, py + uy * a + vy * r], [px + ux * b + vx * r, py + uy * b + vy * r], [px + ux * b - vx * r, py + uy * b - vy * r], [px + ux * a - vx * r, py + uy * a - vy * r]]); }
    // The tube lives in its own group so it can slew to whatever the visitor picks.
    var tubeG = el('g', {}); gg.appendChild(tubeG);
    var host = gg; gg = tubeG;
    tubeSeg(-3.6, 8.4, 1.1);
    tubeSeg(7.7, 8.6, 1.22);
    tubeSeg(-3.7, -3.1, 1.17);
    ell(px, py, 0.95, 0.95, 0);
    // finder and focuser
    poly([[px + ux * 5.8 + vx * 1.3, py + uy * 5.8 + vy * 1.3], [px + ux * 7.6 + vx * 1.3, py + uy * 7.6 + vy * 1.3], [px + ux * 7.6 + vx * 1.85, py + uy * 7.6 + vy * 1.85], [px + ux * 5.8 + vx * 1.85, py + uy * 5.8 + vy * 1.85]]);
    poly([[px + ux * 6.6 - vx * 1.2, py + uy * 6.6 - vy * 1.2], [px + ux * 7.2 - vx * 1.2, py + uy * 7.2 - vy * 1.2], [px + ux * 7.2 - vx * 2.0, py + uy * 7.2 - vy * 2.0], [px + ux * 6.6 - vx * 2.0, py + uy * 6.6 - vy * 2.0]]);

    gg = host;
    this.tube = tubeG; this.tubeBase = 124; this.tubeAngle = 124;
    this.pivot = { x: ox, y: oy - 2.7 * ppd };
    // Observer, facing the telescope, head tipped back to the sky.
    var P = 4.3;
    function T(pts) { return pts.map(function (q) { return [q[0] + P, q[1]]; }); }
    poly(T([[-1.0, 0.0], [0.25, 0.0], [0.3, 0.45], [-0.55, 0.52], [-1.05, 0.3]]));
    poly(T([[0.05, 0.0], [1.15, 0.0], [1.2, 0.3], [0.85, 0.5], [0.05, 0.45]]));
    poly(T([[-0.58, 0.4], [-0.02, 0.4], [0.12, 3.0], [0.05, 5.4], [-0.78, 5.4], [-0.72, 3.0]]));
    poly(T([[0.12, 0.4], [0.72, 0.4], [0.78, 3.0], [0.88, 5.4], [0.02, 5.4], [0.1, 3.0]]));
    poly(T([[-0.98, 5.0], [-1.12, 6.4], [-1.1, 8.3], [-0.86, 9.25], [-0.3, 9.62], [0.55, 9.62], [0.98, 9.05], [1.12, 7.8], [1.08, 6.2], [0.98, 5.0]]));
    poly(T([[0.58, 9.35], [1.18, 9.0], [1.4, 7.6], [1.32, 6.05], [0.9, 5.95], [0.88, 7.3], [0.6, 8.5]]));
    poly(T([[-0.72, 9.2], [-1.3, 8.7], [-1.62, 7.5], [-1.95, 6.9], [-1.7, 6.62], [-1.28, 7.1], [-0.95, 7.9]]));
    poly(T([[-0.34, 9.45], [0.36, 9.45], [0.34, 10.05], [-0.36, 10.05]]));
    ell(P - 0.12, 10.62, 0.6, 0.7, 28);
    ell(P + 0.05, 10.92, 0.66, 0.5, 28);
    ell(P + 0.42, 11.38, 0.22, 0.22, 0);
    poly(T([[-0.6, 10.6], [-0.86, 10.95], [-0.58, 11.02]]));

    this.subj.innerHTML = '';
    this.subj.appendChild(svg);
    var lamp = document.createElement('i'); lamp.className = 'lamp';
    lamp.style.left = (ox + (P - 0.55) * ppd) + 'px'; lamp.style.top = (oy - 11.05 * ppd) + 'px';
    this.subj.appendChild(lamp);
    this.subj.style.width = PW + 'px'; this.subj.style.height = PH + 'px';
  };

  Land.prototype.buildFg = function (W, H, f, tall) {
    var PW = W + 2 * this.m, Y0 = Math.round(H * 0.45), PH = Math.round(H * 1.5);
    this.fgY0 = Y0;
    var m = this.m, svg = el('svg', { width: PW, height: PH, viewBox: '0 0 ' + PW + ' ' + PH, 'aria-hidden': 'true' });
    var u = tall ? W * 1.15 : Math.min(W, H * 1.8); // horizontal unit, so the mound keeps its shape on wide screens
    function X(fx) { return m + fx * u; }
    var s = H / 900;
    var pts = [], x;
    var reach = tall ? 0.62 : 0.46;
    for (x = -0.08; x <= reach; x += 0.004) {
      var yy = Y0 + H * (0.19 - 0.075 * Math.exp(-Math.pow((x - 0.13) / 0.11, 2)) + 0.5 * Math.pow(Math.max(x - reach * 0.55, 0) / reach, 1.8));
      yy += H * 0.006 * (n1(x * 60) - 0.5);
      pts.push([X(x), yy]);
    }
    var d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' L') + ' L' + X(reach) + ',' + PH + ' L' + X(-0.1) + ',' + PH + ' Z';
    var g0 = el('g', { fill: 'var(--c-fg)' });
    g0.appendChild(el('path', { d: d }));
    // grass
    var grass = el('g', { stroke: 'var(--c-fg)', 'stroke-width': Math.max(1, 1.3 * s), fill: 'none', 'stroke-linecap': 'round' });
    for (var k = 0; k < 70; k++) {
      var p = pts[Math.floor(hash1(k + 9) * (pts.length - 1))];
      for (var b = 0; b < 7; b++) {
        var hgt = (10 + hash1(k * 11 + b) * 24) * s, lean = (hash1(k * 5 + b) - 0.5) * 18 * s;
        grass.appendChild(el('path', { d: 'M' + (p[0] + b * 1.6 * s).toFixed(1) + ',' + (p[1] + 2) + ' Q' + (p[0] + lean * 0.3).toFixed(1) + ',' + (p[1] - hgt * 0.6).toFixed(1) + ' ' + (p[0] + lean + b).toFixed(1) + ',' + (p[1] - hgt).toFixed(1) }));
      }
    }
    svg.appendChild(g0); svg.appendChild(grass);

    // Prayer flags: a pole on the mound, a line sagging down to the left edge.
    var poleX = X(tall ? 0.2 : 0.19), poleBase = Y0 + H * 0.135, poleTop = Y0 - H * (tall ? 0.015 : 0.03);
    svg.appendChild(el('path', { d: 'M' + (poleX - 1.6 * s) + ',' + poleBase + ' L' + (poleX - 1.1 * s) + ',' + poleTop + ' L' + (poleX + 1.1 * s) + ',' + poleTop + ' L' + (poleX + 1.6 * s) + ',' + poleBase + ' Z', fill: 'var(--c-fg)' }));
    var ex = X(-0.1), ey = Y0 + H * 0.2, cx = (poleX + ex) / 2, cy = Math.max(poleTop, ey) + H * 0.045;
    svg.appendChild(el('path', { d: 'M' + poleX + ',' + poleTop + ' Q' + cx + ',' + cy + ' ' + ex + ',' + ey, stroke: 'var(--c-fg)', 'stroke-width': Math.max(1, 1.1 * s), fill: 'none' }));
    var colours = ['--flag-b', '--flag-w', '--flag-r', '--flag-g', '--flag-y'];
    var flags = el('g', { class: 'flags' });
    var n = tall ? 13 : 19, fw = Math.max(9, 15 * s), fh = fw * 1.3;
    for (var i = 0; i < n; i++) {
      var t = 0.04 + i * (0.92 / n);
      var qx = (1 - t) * (1 - t) * poleX + 2 * (1 - t) * t * cx + t * t * ex;
      var qy = (1 - t) * (1 - t) * poleTop + 2 * (1 - t) * t * cy + t * t * ey;
      var dx = 2 * (1 - t) * (cx - poleX) + 2 * t * (ex - cx), dy = 2 * (1 - t) * (cy - poleTop) + 2 * t * (ey - cy);
      var slope = dy / dx;
      var fl = el('g', { transform: 'translate(' + qx.toFixed(1) + ',' + qy.toFixed(1) + ') skewY(' + (Math.atan(slope) / D2R).toFixed(1) + ')' });
      var inner = el('path', { class: 'flag', d: 'M' + (-fw / 2) + ',0 L' + (fw / 2) + ',0 L' + (fw / 2 - 1) + ',' + fh + ' L' + (-fw / 2 + 2) + ',' + (fh - 1.5) + ' Z', style: '--fc: var(' + colours[i % 5] + '); animation-delay: ' + (-hash1(i) * 4).toFixed(2) + 's' });
      fl.appendChild(inner); flags.appendChild(fl);
    }
    svg.appendChild(flags);
    this.fg.innerHTML = '';
    this.fg.appendChild(svg);
    this.fg.style.width = PW + 'px'; this.fg.style.height = PH + 'px';
  };

  // cam: horizonY (px), shift (px, from camera azimuth), crane (0..1), ptr {x,y}
  Land.prototype.place = function (cam) {
    var f = this.geo.f, m = this.m, sx = cam.shift, px = cam.ptr.x, py = cam.ptr.y;
    function tr(e, x, y) { e.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0)'; }
    tr(this.far, -m + sx + px * 3, cam.horizonY - this.farY0 + py * 1);
    tr(this.mid, -m + sx + px * 8, cam.horizonY - this.midY0 + cam.crane * f * 0.014 + py * 3);
    var stx = -m + sx + px * 18, sty = cam.horizonY - this.subjY0 + cam.crane * f * 0.095 + py * 7;
    tr(this.subj, stx, sty); this.subjT = [stx, sty];
    tr(this.fg, -m + sx + px * 30, cam.horizonY - this.fgY0 + cam.crane * f * 0.2 + py * 12);
  };

  // Screen position of the telescope's pivot, and a way to swing the tube (math angle, degrees, 90 = straight up).
  Land.prototype.pivotScreen = function () { return this.subjT ? { x: this.pivot.x + this.subjT[0], y: this.pivot.y + this.subjT[1] } : null; };
  Land.prototype.setTube = function (deg) {
    if (!this.tube || Math.abs(deg - this.tubeAngle) < 0.05) return;
    this.tubeAngle = deg;
    this.tube.setAttribute('transform', 'rotate(' + (deg - this.tubeBase).toFixed(2) + ' 0 2.7)');
  };

  g.UmbraLand = Land;
})(window);
