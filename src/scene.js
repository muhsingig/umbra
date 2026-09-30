/* Umbra scene conductor. Reads the worldflight track the engine sets up,
   turns scroll into a clock (18:24 to 05:58, 10-11 October 2026, Changthang),
   and drives the sky, the landscape planes, the lamps and the night map. */
(function () {
  var A = window.UmbraAstro, Sky = window.UmbraSky, Land = window.UmbraLand;
  var LAT = 32.78, LON = 78.96, TZ = 5.5, SIDEREAL = 15.04107;
  var BASE = Date.UTC(2026, 9, 10, 0, 0) - TZ * 3600e3;          // 00:00 IST, 10 Oct 2026
  var D2R = Math.PI / 180;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  // Under automation (the verification harness) frames are slow and must be exact: no smoothing, 1x pixels.
  var automated = !!navigator.webdriver;

  var root = document.querySelector('[data-sc-mode="worldflight"]');
  var scene = document.getElementById('scene');
  var canvas = document.getElementById('sky');
  var docEl = document.documentElement;

  var segs = [], run = 0;
  Array.prototype.forEach.call(root.querySelectorAll('[data-sc-segment]'), function (el) {
    var s = { el: el, w: parseFloat(el.getAttribute('data-sc-w')), h0: parseFloat(el.getAttribute('data-h0')), h1: parseFloat(el.getAttribute('data-h1')), key: el.getAttribute('data-key'), label: el.getAttribute('data-sc-waypoint') };
    s.c0 = run; run += s.w; s.c1 = run; segs.push(s);
  });
  var TOTAL = run;

  var KEYS = {
    wide: [[0, 5.5, -3, 0], [1.5, 8, 2, 1], [2.8, 12, 8, 1], [3.95, 18, 14, 0.6], [7.55, 18, 14, 0.6], [9.1, 12, 8, 0.95], [TOTAL, 5.5, 3, 1.05]],
    tall: [[0, 7, -2, 0], [1.5, 12, 1, 1], [2.8, 17, 4, 1], [3.95, 21, 6, 0.6], [7.55, 21, 6, 0.6], [9.1, 15, 3, 0.95], [TOTAL, 9, 2, 1.05]]
  };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function smooth(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }

  function segAt(t) {
    for (var i = 0; i < segs.length; i++) if (t < segs[i].c1 || i === segs.length - 1) return { i: i, s: segs[i], l: clamp((t - segs[i].c0) / segs[i].w, 0, 1) };
  }
  function hourAt(t) {
    var q = segAt(t), s = q.s, l = q.l;
    if (s.key === 'exposure') l = clamp((l - 0.07) / 0.86, 0, 1);
    return mix(s.h0, s.h1, l);
  }
  function camAt(t, tall) {
    var K = KEYS[tall ? 'tall' : 'wide'];
    for (var i = 0; i < K.length - 1; i++) {
      if (t <= K[i + 1][0] || i === K.length - 2) {
        var a = K[i], b = K[i + 1], u = smooth(a[0], b[0], t);
        return { pitch: mix(a[1], b[1], u), az: mix(a[2], b[2], u), crane: mix(a[3], b[3], u) };
      }
    }
  }
  function lstAtHour(h) { return A.lst(A.jd(new Date(BASE + h * 3600e3)), LON); }
  function limitFromSun(alt) {
    var k = [[-2, 0.5], [-6, 2.2], [-10, 3.9], [-13, 5.0], [-16, 6.1], [-18, 6.8], [-19.5, 7.8]];
    if (alt >= k[0][0]) return k[0][1];
    for (var i = 0; i < k.length - 1; i++) if (alt >= k[i + 1][0]) return mix(k[i][1], k[i + 1][1], (k[i][0] - alt) / (k[i][0] - k[i + 1][0]));
    return 7.8;
  }

  var PAL = {
    night: { mid: [6, 8, 14], midTop: [14, 17, 28], midDeep: [3, 4, 8], subj: [3, 4, 8], fg: [2, 3, 6], dome: [26, 30, 40], mist: [44, 56, 86, 0.10] },
    dusk: { mid: [19, 23, 38], midTop: [38, 45, 68], midDeep: [8, 10, 17], subj: [9, 11, 19], fg: [6, 7, 12], dome: [104, 112, 134], mist: [96, 116, 160, 0.30] },
    dawn: { mid: [23, 24, 40], midTop: [52, 50, 74], midDeep: [9, 10, 18], subj: [11, 12, 21], fg: [7, 8, 14], dome: [132, 124, 146], mist: [186, 150, 170, 0.36] }
  };
  function rgb(c) { return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; }

  function state(t, tall) {
    var q = segAt(t), key = q.s.key, l = q.l;
    var hour = hourAt(t);
    var date = new Date(BASE + hour * 3600e3);
    var lst = A.lst(A.jd(date), LON);
    var sun = A.sunAltAz(date, LAT, LON);
    var sa = sun.alt * D2R, sz = sun.az * D2R;
    var hEnd = clamp(hour, 22, 26);
    var pollution = key === 'skyglow' ? smooth(0.04, 0.3, l) : key === 'adjust' ? 1 - smooth(0, 0.45, l) : 0;
    var adapt = key === 'dusk' || key === 'skyglow' ? 5.3 : key === 'adjust' ? mix(4.4, 7.8, smooth(0.12, 0.95, l)) : 7.8;
    var limit = Math.min(limitFromSun(sun.alt), adapt);
    limit = mix(limit, Math.min(limit, 3.0), pollution);
    var trail = hour < 22 ? 0 : key === 'exposure' ? 1 : key === 'lodge' ? 1 - 0.55 * smooth(0.25, 1, l) : key === 'dawn' ? 0.45 * (1 - smooth(0, 0.6, l)) : 0;
    var red = key === 'adjust' ? smooth(0.05, 0.35, l) : key === 'exposure' || key === 'lodge' ? 1 : key === 'dawn' ? 1 - smooth(0.1, 0.55, l) : 0;
    var litDusk = hour < 24 ? smooth(-16, -3, sun.alt) : 0, litDawn = hour > 24 ? smooth(-16, -3, sun.alt) : 0;
    var cam = camAt(t, tall);
    return {
      t: t, key: key, index: q.i, l: l, hour: hour, lst: lst,
      M: Sky.eqToHor(lst, LAT), Me: Sky.eqToHor(lstAtHour(hEnd), LAT),
      sun: [Math.sin(sz) * Math.cos(sa), Math.cos(sz) * Math.cos(sa), Math.sin(sa)], sunAlt: sun.alt,
      pollution: pollution, limit: limit, mwVis: (key === 'dusk' || key === 'skyglow') ? 0 : smooth(5.6, 7.4, limit),
      trail: trail, trailSpan: (hEnd - 22) * SIDEREAL,
      red: red, litDusk: litDusk, litDawn: litDawn, cam: cam,
      exposure: 1.7, starGain: 1.15, faintGate: 1, airglow: 1 - smooth(-14, -4, sun.alt)
    };
  }

  // ---------------------------------------------------------------- setup --
  var sky = null, land = new Land(scene), geo = null, dpr = 1;
  var tNow = 0, tShown = -1, ptr = { x: 0, y: 0 }, ptrT = { x: 0, y: 0 }, lastPtr = { x: 0, y: 0 };
  var trackTop = 0, vh = innerHeight, lastInput = 0, lastFrame = 0, lastAmbient = 0, visible = true;
  var exp = { start: null, done: false };
  var hooks = [], wakeUntil = 0, speed = 0, lastTarget = null;
  var METEOR = { hour: 24.78, a: [20, 40], b: [6, 27], live: -1, liveStart: 0 };
  function dirOf(azAlt) { var a = azAlt[0] * D2R, h = azAlt[1] * D2R; return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)]; }
  var navLabel = document.getElementById('clock-label'), navClock = document.getElementById('clock-time'), navSun = document.getElementById('clock-sun');
  var railBtns = document.querySelectorAll('[data-go]');
  var scrims = Array.prototype.map.call(document.querySelectorAll('[data-scrim-for]'), function (el) { return { el: el, src: document.getElementById(el.getAttribute('data-scrim-for')), o: -1 }; });
  var copies = document.querySelectorAll('[data-sc-copy]');
  function syncInert() {
    for (var i = 0; i < copies.length; i++) {
      var off = (parseFloat(copies[i].style.opacity) || 0) < 0.5;
      if (copies[i].inert !== off) copies[i].inert = off;
    }
  }
  function mirrorScrims() {
    syncInert();
    for (var i = 0; i < scrims.length; i++) {
      var o = scrims[i].src.style.opacity; if (o !== scrims[i].o) { scrims[i].el.style.opacity = o; scrims[i].o = o; }
    }
  }

  function measure() {
    var W = scene.clientWidth, H = scene.clientHeight;
    var aspect = W / H, tall = aspect < 0.9;
    var vfov = aspect < 0.62 ? 74 : aspect < 0.9 ? 68 : aspect < 1.25 ? 62 : 58;
    var tanV = Math.tan(vfov / 2 * D2R), f = (H / 2) / tanV;
    return { W: W, H: H, tall: tall, tanV: tanV, tanH: tanV * aspect, f: f };
  }
  function resize(force) {
    var g2 = measure();
    if (!force && geo && g2.W === geo.W && Math.abs(g2.H - geo.H) < 2) return;
    geo = g2;
    dpr = automated ? 1 : Math.min(window.devicePixelRatio || 1, geo.W < 700 ? 1.5 : 1.75);
    canvas.width = Math.round(geo.W * dpr); canvas.height = Math.round(geo.H * dpr);
    land.build(geo);
    vh = innerHeight;
    trackTop = root.getBoundingClientRect().top + scrollY;
    tShown = -1;
  }

  function quantize(t) {
    var q = segAt(t), s = q.s;
    var at = { dusk: 0.25, skyglow: 0.6, adjust: 0.97, exposure: 0.97, lodge: 0.55, dawn: 0.92 }[s.key];
    return s.c0 + s.w * at;
  }

  var lastVars = {};
  function setVar(name, val) { if (lastVars[name] !== val) { scene.style.setProperty(name, val); lastVars[name] = val; } }
  function setDocVar(name, val) { if (lastVars['d' + name] !== val) { docEl.style.setProperty(name, val); lastVars['d' + name] = val; } }

  function fmtHour(h) { var m = Math.round(h * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }

  function paint(s, time) {
    var tall = geo.tall;
    var horizonY = geo.H / 2 + geo.f * Math.tan(s.cam.pitch * D2R);
    if (sky) {
      sky.render({
        cam: Sky.camera(s.cam.az, s.cam.pitch), tanH: geo.tanH, tanV: geo.tanV, M: s.M, Me: s.Me,
        sun: s.sun, sunAlt: s.sunAlt, pollution: s.pollution, mwVis: s.mwVis, trail: s.trail, trailSpan: s.trailSpan,
        time: time, exposure: s.exposure, airglow: s.airglow, limit: s.limit, dpr: dpr, starGain: s.starGain, faintGate: s.faintGate,
        metA: dirOf(METEOR.a), metB: dirOf(METEOR.b), met: (s.trail > 0 && Math.min(s.hour, 26) >= METEOR.hour && METEOR.live < 0) ? s.trail : 0, metLive: METEOR.live
      });
    }
    setVar('--hz', (horizonY / geo.H * 100).toFixed(1) + '%');
    land.place({ horizonY: horizonY, shift: -geo.f * Math.tan(s.cam.az * D2R), crane: s.cam.crane, ptr: ptr });

    // landscape light
    var n = PAL.night, dk = PAL.dusk, dw = PAL.dawn;
    function lit(k) { var c = mix3(n[k], dk[k], s.litDusk); return mix3(c, dw[k], s.litDawn); }
    var q2 = function (x) { return Math.round(x * 50) / 50; };
    setVar('--c-mid', rgb(lit('mid'))); setVar('--c-mid-top', rgb(lit('midTop'))); setVar('--c-mid-deep', rgb(lit('midDeep')));
    setVar('--c-subj', rgb(lit('subj'))); setVar('--c-fg', rgb(lit('fg'))); setVar('--c-dome', rgb(lit('dome')));
    var mm = mix(n.mist[3], dk.mist[3], s.litDusk); mm = mix(mm, dw.mist[3], s.litDawn);
    var mc = lit('mist');
    setVar('--c-mist', 'rgba(' + Math.round(mc[0]) + ',' + Math.round(mc[1]) + ',' + Math.round(mc[2]) + ',' + mm.toFixed(3) + ')');
    setVar('--u-lit', String(q2(Math.max(s.litDusk, s.litDawn))));
    setVar('--far-dusk', String(q2(s.litDusk))); setVar('--far-dawn', String(q2(s.litDawn)));
    var win = s.hour < 18.45 ? smooth(18.3, 18.45, s.hour) : s.hour > 29.7 ? 0.5 : 1;
    setVar('--win-a', String(q2(win))); setVar('--win-red', String(q2(s.red)));
    setVar('--lamp', String(q2(s.red * (s.hour > 20.2 && s.hour < 29.6 ? 1 : 0))));
    setDocVar('--u-red', String(q2(s.red)));
    setDocVar('--u-pos', (s.t / TOTAL).toFixed(4));

    // night map
    if (navClock) {
      navClock.textContent = fmtHour(s.hour);
      navSun.textContent = 'Sun ' + (s.sunAlt < 0 ? '−' : '') + Math.abs(Math.round(s.sunAlt)) + '°';
      if (navLabel.textContent !== segs[s.index].label) navLabel.textContent = segs[s.index].label;
      for (var i = 0; i < railBtns.length; i++) {
        var on = i === s.index;
        if ((railBtns[i].getAttribute('aria-current') === 'step') !== on) {
          if (on) railBtns[i].setAttribute('aria-current', 'step'); else railBtns[i].removeAttribute('aria-current');
        }
      }
    }
    mirrorScrims();
    lastState = s;
    for (var hk = 0; hk < hooks.length; hk++) hooks[hk](s, api);
    scene.setAttribute('data-sc-verify-state', [fmtHour(s.hour), s.pollution.toFixed(2), s.limit.toFixed(1), Math.round(s.trailSpan), s.cam.pitch.toFixed(1), q2(s.litDusk + s.litDawn)].join('|'));
  }

  // The shutter opens when the clock crosses 22:00 going forward and closes at 02:00;
  // the elapsed wall time is the visitor's own exposure.
  var prevHour = null, lastState = null;
  function exposureClock(s, now) {
    if (reduce) return;
    var h = s.hour, p = prevHour; prevHour = h;
    if (h < 22.02) { exp.start = null; exp.done = false; return; }
    if (exp.start === null && !exp.done && p !== null && p < 22.02) { exp.start = now; document.dispatchEvent(new CustomEvent('umbra:shutter', { detail: { open: true } })); }
    if (p !== null && p < METEOR.hour && h >= METEOR.hour && h < 26) { METEOR.live = 0; METEOR.liveStart = now; wakeUntil = Math.max(wakeUntil, now + 1400); document.dispatchEvent(new CustomEvent('umbra:meteor')); }
    if (exp.start !== null && !exp.done && h >= 25.98) {
      exp.done = true;
      document.dispatchEvent(new CustomEvent('umbra:shutter', { detail: { open: false } }));
      document.dispatchEvent(new CustomEvent('umbra:exposed', { detail: { seconds: (now - exp.start) / 1000 } }));
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || !geo) return;
    syncInert(); mirrorScrims();
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.1) : 1 / 60; lastFrame = now;
    var target = clamp((scrollY - trackTop) / vh, 0, TOTAL);
    if (lastTarget !== null) speed += (Math.abs(target - lastTarget) / dt - speed) * 0.12;
    lastTarget = target;
    if (METEOR.live >= 0) { METEOR.live = (now - METEOR.liveStart) / 1100; if (METEOR.live >= 1) METEOR.live = -1; }
    if (reduce) tNow = quantize(target);
    else if (automated) { tNow = target; ptr.x = ptrT.x; ptr.y = ptrT.y; }
    else {
      var k = 1 - Math.pow(1 - 0.13, dt * 60);
      tNow += (target - tNow) * k;
      if (Math.abs(target - tNow) < 1e-4) tNow = target;
      ptr.x += (ptrT.x - ptr.x) * (1 - Math.pow(1 - 0.06, dt * 60));
      ptr.y += (ptrT.y - ptr.y) * (1 - Math.pow(1 - 0.06, dt * 60));
    }
    var moving = Math.abs(tNow - tShown) > 1e-5 || Math.abs(ptr.x - lastPtr.x) > 1e-4 || Math.abs(ptr.y - lastPtr.y) > 1e-4;
    if (moving || now < wakeUntil) lastInput = now;
    moving = moving || now < wakeUntil;
    // Ambient (twinkle, lake ripple) at full rate while moving, 20 fps when idle, none under reduced motion.
    var ambientDue = !reduce && now - lastAmbient > (now - lastInput < 1200 ? 0 : 50);
    if (!moving && !ambientDue && tShown >= 0) return;
    lastAmbient = now;
    var s = state(tNow, geo.tall);
    exposureClock(s, now);
    paint(s, reduce ? 0 : now / 1000);
    tShown = tNow; lastPtr.x = ptr.x; lastPtr.y = ptr.y;
  }

  function start(mwImg, stars) {
    window.UmbraNamedAll = stars;
    try { sky = new Sky(canvas, { stars: stars, mwImg: mwImg, faint: matchMedia('(max-width: 700px)').matches ? 6000 : 9000 }); }
    catch (e) { sky = null; scene.classList.add('no-gl'); console.warn('[umbra] sky renderer unavailable:', e.message); }
    resize(true);
    tNow = clamp((scrollY - trackTop) / vh, 0, TOTAL);
    requestAnimationFrame(function (now) { frame(now); requestAnimationFrame(function () { scene.classList.add('is-ready'); }); });
  }

  // Data is inlined by the build as base64; decode once.
  function decodeStars(b64) {
    var bin = atob(b64), n = bin.length, bytes = new Uint8Array(n);
    for (var i = 0; i < n; i++) bytes[i] = bin.charCodeAt(i);
    return new Float32Array(bytes.buffer);
  }

  // Rebuild only once a new size has held; a transient resize (a full-page capture,
  // a rotating phone mid-animation) should not tear the landscape down.
  window.addEventListener('resize', function () { clearTimeout(resize.t); resize.t = setTimeout(function () { resize(false); }, 450); });
  // Under automation, paint synchronously on scroll so the published state matches the frame.
  if (automated) window.addEventListener('scroll', function () { if (geo) { tNow = clamp((scrollY - trackTop) / vh, 0, TOTAL); var s = state(tNow, geo.tall); exposureClock(s, performance.now()); paint(s, performance.now() / 1000); tShown = tNow; } }, { passive: true });
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; lastFrame = 0; });
  if (finePointer && !reduce) {
    window.addEventListener('pointermove', function (e) {
      ptrT.x = clamp(e.clientX / innerWidth * 2 - 1, -1, 1); ptrT.y = clamp(e.clientY / innerHeight * 2 - 1, -1, 1);
    }, { passive: true });
  }

  function project(raDeg, decDeg, st, cam) {
    var a = raDeg * D2R, d = decDeg * D2R, M = st.M;
    var e0 = Math.cos(d) * Math.cos(a), e1 = Math.cos(d) * Math.sin(a), e2 = Math.sin(d);
    var h = [M[0] * e0 + M[3] * e1 + M[6] * e2, M[1] * e0 + M[4] * e1 + M[7] * e2, M[2] * e0 + M[5] * e1 + M[8] * e2];
    return projectHor(h, cam);
  }
  function projectHor(h, cam) {
    var vx = h[0] * cam.R[0] + h[1] * cam.R[1] + h[2] * cam.R[2], vy = h[0] * cam.U[0] + h[1] * cam.U[1] + h[2] * cam.U[2], vz = h[0] * cam.F[0] + h[1] * cam.F[1] + h[2] * cam.F[2];
    if (vz <= 0.01) return null;
    return { x: (vx / vz / geo.tanH + 1) / 2 * geo.W, y: (1 - vy / vz / geo.tanV) / 2 * geo.H, alt: Math.asin(Math.max(-1, Math.min(1, h[2]))) / D2R };
  }
  var api = {
    get geo() { return geo; }, get state() { return lastState; }, get reduce() { return reduce; }, get automated() { return automated; },
    get speed() { return speed; }, get land() { return land; }, get sky() { return sky; },
    camera: function (st) { return Sky.camera(st.cam.az, st.cam.pitch); },
    project: project, stateAt: function (t) { return state(t, geo.tall); },
    onFrame: function (fn) { hooks.push(fn); },
    wake: function (ms) { wakeUntil = Math.max(wakeUntil, performance.now() + ms); },
    repaint: function () { tShown = -1; },
    // Render one still of the finished exposure into a 2D context (sync part only: sky).
    paintSky: function (st, ctx, w, h) { paint(st, 0); ctx.drawImage(canvas, 0, 0, w, h); },
    exposureEndT: function () { var s = segs[3]; return s.c0 + s.w * 0.95; }
  };
  window.UmbraScene = {
    api: api,
    segments: segs, total: TOTAL,
    scrollToSegment: function (i, at) {
      var s = segs[i], t = i === 0 ? 0 : i === segs.length - 1 ? TOTAL : s.c0 + s.w * (at == null ? 0.4 : at);
      window.scrollTo({ top: trackTop + t * vh, behavior: reduce ? 'auto' : 'smooth' });
    },
    boot: function () {
      var img = new Image();
      img.onload = function () { start(img, decodeStars(document.getElementById('umbra-stars').textContent.trim())); };
      img.onerror = function () { scene.classList.add('no-gl'); resize(true); requestAnimationFrame(frame); };
      img.src = document.getElementById('umbra-mw').getAttribute('data-src');
    }
  };
})();
