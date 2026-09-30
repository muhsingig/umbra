/* Keep your photograph: the finished four-hour exposure, with the landscape,
   stamped with where, when, and how long the visitor took to make it. */
(function () {
  var S = window.UmbraScene, api = S.api;
  var btns = document.querySelectorAll('[data-keep]'), note = document.getElementById('keep-note');
  var seconds = null, downloads = null;
  document.addEventListener('umbra:exposed', function (e) { seconds = Math.max(1, Math.round(e.detail.seconds)); });

  function show(on) { Array.prototype.forEach.call(btns, function (b) { b.hidden = !on; }); }
  show(false);
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('downloads').then(function (d) { downloads = d; show(!!d); }).catch(function () { show(false); });
  }

  function svgImage(svg, vars) {
    var src = new XMLSerializer().serializeToString(svg).replace(/var\((--[\w-]+)\)/g, function (m, n) { return vars.getPropertyValue(n).trim() || '#000'; });
    if (src.indexOf('xmlns=') < 0) src = src.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); });
  }
  function planeOffset(el) { var m = new DOMMatrixReadOnly(getComputedStyle(el).transform); return [m.m41, m.m42]; }

  async function compose() {
    var geo = api.geo, W = geo.W, H = geo.H, k = Math.max(1, Math.min(2, 2400 / W));
    var out = document.createElement('canvas'); out.width = Math.round(W * k); out.height = Math.round(H * k + 120 * k);
    var g = out.getContext('2d');
    var keepT = api.state ? api.state.t : 0;
    var st = api.stateAt(api.exposureEndT());
    st.trail = 1;
    api.paintSky(st, g, out.width, Math.round(H * k));        // sync: sky and the planes placed for that frame
    var scene = document.getElementById('scene'), vars = getComputedStyle(scene);
    g.save(); g.scale(k, k);
    var far = scene.querySelectorAll('[data-plane="far"] canvas'), fo = planeOffset(scene.querySelector('[data-plane="far"]'));
    Array.prototype.forEach.call(far, function (c) {
      var o = parseFloat(getComputedStyle(c).opacity); if (!(o > 0.01)) return;
      g.globalAlpha = o; g.drawImage(c, fo[0] + (parseFloat(c.style.left) || 0), fo[1] + (parseFloat(c.style.top) || 0), parseFloat(c.style.width), parseFloat(c.style.height));
    });
    g.globalAlpha = 1;
    for (var name of ['mid', 'subj']) {
      var plane = scene.querySelector('[data-plane="' + name + '"]'), svg = plane.querySelector('svg'), off = planeOffset(plane);
      try { var im = await svgImage(svg, vars); g.drawImage(im, off[0], off[1]); } catch (e) {}
      Array.prototype.forEach.call(plane.querySelectorAll('.win, .lamp'), function (d) {
        var o = parseFloat(getComputedStyle(d).opacity); if (!(o > 0.01)) return;
        var x = off[0] + parseFloat(d.style.left), y = off[1] + parseFloat(d.style.top);
        var gr = g.createRadialGradient(x, y, 0, x, y, 7); gr.addColorStop(0, 'rgba(255,90,60,' + o + ')'); gr.addColorStop(1, 'rgba(255,60,40,0)');
        g.fillStyle = gr; g.fillRect(x - 7, y - 7, 14, 14);
      });
    }
    g.restore();
    // caption plate
    var y0 = Math.round(H * k);
    g.fillStyle = '#05070d'; g.fillRect(0, y0, out.width, out.height - y0);
    g.fillStyle = '#edf0f7'; g.font = '500 ' + Math.round(22 * k) + 'px "Archivo Variable", Arial, sans-serif';
    try { g.letterSpacing = (0.3 * 22 * k) + 'px'; } catch (e) {}
    g.fillText('UMBRA', 40 * k, y0 + 52 * k);
    try { g.letterSpacing = '0px'; } catch (e) {}
    g.fillStyle = '#c6cddb'; g.font = Math.round(15 * k) + 'px "Geist Mono", ui-monospace, monospace';
    g.fillText('Changthang, Ladakh · 32.8° N 79.0° E · 10–11 October 2026 · 22:00 to 02:00 IST', 40 * k, y0 + 80 * k);
    g.fillText(seconds ? 'A four-hour exposure, made in ' + seconds + (seconds === 1 ? ' second' : ' seconds') + ' of scrolling.' : 'A four-hour exposure, made by scrolling.', 40 * k, y0 + 102 * k);
    api.repaint();                                            // put the live view back
    void keepT;
    return new Promise(function (res) { out.toBlob(res, 'image/png'); });
  }

  Array.prototype.forEach.call(btns, function (b) {
    b.addEventListener('click', async function () {
      if (!downloads) return;
      b.disabled = true; if (note) note.textContent = 'Developing your photograph…';
      try {
        var blob = await compose();
        await downloads.save({ filename: 'umbra-star-trails-10-oct-2026.png', data: blob });
        if (note) note.textContent = 'Saved. Four hours of sky, yours to keep.';
      } catch (e) {
        if (note) note.textContent = e && e.code === 'declined' ? '' : 'The photograph could not be saved here.';
      }
      b.disabled = false;
    });
  });
})();
