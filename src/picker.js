/* Tap a star. The telescope in the scene swings to it, and a card says what it
   is, how far, and when the light now reaching your eye set out.
   Distances: HYG v4.1 (Hipparcos-based), CC BY-SA 4.0. */
(function () {
  var S = window.UmbraScene, api = S.api;
  var NAMED = JSON.parse(document.getElementById('umbra-named').textContent);
  var ring = document.getElementById('pick-ring'), card = document.getElementById('pick'), hover = document.getElementById('pick-hover');
  var nameEl = document.getElementById('pick-name'), kindEl = document.getElementById('pick-kind'), distEl = document.getElementById('pick-dist'), lightEl = document.getElementById('pick-light');
  var scene = document.getElementById('scene'), closeBtn = document.getElementById('pick-close'), nextBtns = document.querySelectorAll('[data-next-star]');
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var sel = null, hov = null, lastVisible = [], cycle = -1, tubeNow = 124;
  var YEAR = 2026;

  // Anchors for "when the light left". Clause form, so they read after "when" or "before/after".
  var ANCHORS = [
    [2023, 'Chandrayaan-3 landed near the Moon’s south pole'], [2014, 'Mangalyaan reached Mars'], [2008, 'Chandrayaan-1 launched'],
    [2001, 'Wikipedia went online'], [1990, 'the Hubble Space Telescope launched'], [1977, 'the Voyager probes launched'],
    [1969, 'people first walked on the Moon'], [1957, 'Sputnik launched'], [1947, 'India became independent'],
    [1928, 'penicillin was discovered'], [1915, 'Einstein published general relativity'], [1903, 'the Wright brothers first flew'],
    [1889, 'the Eiffel Tower was finished'], [1859, 'Darwin published On the Origin of Species'], [1781, 'William Herschel discovered Uranus'],
    [1724, 'Jai Singh II began the Jantar Mantar in Delhi'], [1687, 'Newton published the Principia'], [1653, 'the Taj Mahal was completed'],
    [1609, 'Galileo first turned a telescope to the sky'], [1543, 'Copernicus put the Sun at the centre'], [1498, 'Vasco da Gama reached Calicut'],
    [1336, 'the Vijayanagara Empire was founded'], [1150, 'Bhaskara II wrote the Siddhanta Shiromani'],
    [1054, 'astronomers recorded the supernova that made the Crab Nebula'], [1010, 'the Brihadeeswarar Temple was completed'],
    [800, 'Charlemagne was crowned'], [628, 'Brahmagupta wrote the Brahmasphutasiddhanta'], [537, 'the Hagia Sophia was completed'],
    [499, 'Aryabhata wrote the Aryabhatiya'], [-326, 'Alexander reached the Indus'], [-432, 'the Parthenon was completed'],
    [-776, 'the first recorded Olympic Games were held'], [-2560, 'the Great Pyramid of Giza was finished']
  ];
  function yearText(y) { return y < 0 ? Math.abs(y).toLocaleString('en-US') + ' BCE' : y < 1000 ? y + ' CE' : String(y); }
  function lightLine(ly) {
    var y = Math.round(YEAR - ly), best = null, bd = 1e9;
    ANCHORS.forEach(function (a) { var d = Math.abs(y - a[0]); if (d < bd) { bd = d; best = a; } });
    var span = Math.max(12, Math.abs(YEAR - y) * 0.12);
    var head = ly < 40 ? 'The light reaching your eye tonight left ' : 'The light reaching your eye tonight left around ';
    if (!best || bd > span) return head + yearText(y) + '.';
    if (bd <= 1) return head + yearText(y) + ', the year ' + best[1] + '.';
    return head + yearText(y) + ', ' + bd + ' years ' + (y < best[0] ? 'before ' : 'after ') + best[1] + '.';
  }
  function distText(ly) {
    var n = ly < 100 ? Math.round(ly * (ly < 20 ? 10 : 1)) / (ly < 20 ? 10 : 1) : Number(ly.toPrecision(3));
    return (ly < 20 ? '' : 'About ') + n.toLocaleString('en-US') + ' light-years away.';
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function visibleNow(st) {
    var cam = api.camera(st), out = [];
    for (var i = 0; i < NAMED.length; i++) {
      var s = NAMED[i];
      if (s[2] > st.limit - 0.2) continue;
      var p = api.project(s[0], s[1], st, cam);
      if (!p || p.alt < 3 || p.x < 12 || p.x > api.geo.W - 12 || p.y < 80 || p.y > api.geo.H - 20) continue;
      out.push({ i: i, x: p.x, y: p.y, mag: s[2] });
    }
    return out;
  }
  function nearest(x, y, radius) {
    var best = null, bd = radius * radius;
    lastVisible.forEach(function (v) {
      var dx = v.x - x, dy = v.y - y, d = dx * dx + dy * dy - (4 - v.mag) * 30;
      if (d < bd) { bd = d; best = v; }
    });
    return best;
  }

  function open(i) {
    var s = NAMED[i];
    sel = i;
    nameEl.textContent = s[3];
    kindEl.textContent = cap(s[6]) + ' in ' + s[5];
    distEl.textContent = distText(s[4]);
    lightEl.textContent = lightLine(s[4]);
    card.hidden = false; ring.hidden = false;
    card.classList.remove('is-in'); void card.offsetWidth; card.classList.add('is-in');
    api.wake(1600); api.repaint();
  }
  function close() { sel = null; card.hidden = true; ring.hidden = true; api.wake(1600); api.repaint(); }

  scene.addEventListener('click', function (e) {
    if (!api.state) return;
    var v = nearest(e.clientX, e.clientY, fine ? 26 : 40);
    hover.hidden = true;
    if (v) open(v.i); else if (sel !== null) close();
  });
  if (fine) scene.addEventListener('pointermove', function (e) {
    var v = nearest(e.clientX, e.clientY, 22);
    hov = v ? v.i : null;
    scene.style.cursor = v ? 'pointer' : '';
    if (v && v.i !== sel) { hover.textContent = NAMED[v.i][3]; hover.style.transform = 'translate3d(' + (v.x + 12) + 'px,' + (v.y - 26) + 'px,0)'; hover.hidden = false; }
    else hover.hidden = true;
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sel !== null) close(); });
  // Keyboard and touch path: step through the brightest named stars in view.
  Array.prototype.forEach.call(nextBtns, function (b) {
    b.addEventListener('click', function () {
      var list = lastVisible.slice().sort(function (a, c) { return a.mag - c.mag; }).slice(0, 12);
      if (!list.length) return;
      cycle = (cycle + 1) % list.length; open(list[cycle].i);
    });
  });

  api.onFrame(function (st) {
    lastVisible = visibleNow(st);
    // Where should the telescope point: the chosen star, else Polaris when it is up.
    var aimAt = sel !== null ? NAMED[sel] : null, cam = api.camera(st), piv = api.land.pivotScreen(), target = 124;
    if (!aimAt) { for (var k = 0; k < NAMED.length; k++) if (NAMED[k][3] === 'Polaris') { aimAt = NAMED[k]; break; } }
    var sp = aimAt ? api.project(aimAt[0], aimAt[1], st, cam) : null;
    if (sp && piv && (sel !== null || st.limit > 3.5)) target = Math.max(28, Math.min(152, Math.atan2(piv.y - sp.y, sp.x - piv.x) * 180 / Math.PI));
    var k2 = api.reduce ? 1 : 0.07;
    tubeNow += (target - tubeNow) * k2;
    if (Math.abs(target - tubeNow) > 0.05) api.wake(200);
    api.land.setTube(tubeNow);

    if (sel === null) return;
    var s = NAMED[sel], p = api.project(s[0], s[1], st, cam);
    if (!p || p.alt < 1 || p.x < 0 || p.x > api.geo.W || p.y < 60 || p.y > api.geo.H) { close(); return; }
    ring.style.transform = 'translate3d(' + p.x.toFixed(1) + 'px,' + p.y.toFixed(1) + 'px,0)';
    var cw = card.offsetWidth, ch = card.offsetHeight, W = api.geo.W, H = api.geo.H;
    var cx = p.x + 30, cy = p.y - ch / 2;
    if (cx + cw > W - 12) cx = p.x - 30 - cw;
    if (cx < 12) { cx = Math.max(12, Math.min(W - cw - 12, p.x - cw / 2)); cy = p.y + 34; if (cy + ch > H - 12) cy = p.y - 34 - ch; }
    cy = Math.max(84, Math.min(H - ch - 12, cy));
    card.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
  });
})();
