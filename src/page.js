/* Umbra page behaviour: the night map, the new-moon planner, the request form,
   and the line that reports how long the visitor's exposure took. */
(function () {
  var A = window.UmbraAstro, S = window.UmbraScene;
  var TZ = 5.5 * 3600e3;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Night map
  Array.prototype.forEach.call(document.querySelectorAll('[data-go]'), function (b) {
    b.addEventListener('click', function () { S.scrollToSegment(parseInt(b.getAttribute('data-go'), 10)); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-hold]'), function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault(); S.scrollToSegment(S.segments.length - 1);
      // Hand keyboard focus to the planner once the dawn block is actually there.
      var dawn = document.getElementById('cp-dawn'), tries = 0;
      (function wait() {
        if (!dawn.inert && parseFloat(dawn.style.opacity) > 0.9) { var c = document.querySelector('.moon[aria-checked="true"]'); if (c) c.focus({ preventScroll: true }); }
        else if (tries++ < 60) setTimeout(wait, 100);
      })();
    });
  });

  // Exposure result, measured on the visitor's own scroll.
  var res = document.getElementById('exp-result');
  document.addEventListener('umbra:exposed', function (e) {
    var s = Math.max(1, Math.round(e.detail.seconds));
    res.textContent = 'Four hours of sky. You made it in ' + s + (s === 1 ? ' second.' : ' seconds.');
  });

  // Planner: the next six new moons inside the October to April season.
  function ist(d) { return new Date(d.getTime() + TZ); }
  function dayLabel(d) { return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
  function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
  var all = A.nextNewMoons(addDays(new Date(), -1), 14), windows = [];
  all.forEach(function (nm) {
    var local = ist(nm), mo = local.getUTCMonth();
    if (windows.length >= 6 || !(mo >= 9 || mo <= 3)) return;
    var nmDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    var arrive = addDays(nmDay, -1), leave = addDays(nmDay, 2), lit = 0;
    for (var k = -1; k <= 1; k++) {
      var midnight = new Date(nmDay.getTime() + (k + 1) * 86400000 - TZ); // local midnight after night k
      lit = Math.max(lit, A.moonLit(midnight, nm));
    }
    windows.push({ nm: local, arrive: arrive, leave: leave, lit: lit, thisPage: local.getUTCFullYear() === 2026 && mo === 9 && local.getUTCDate() === 10 });
  });

  var list = document.getElementById('moons'), summary = document.getElementById('moon-summary');
  var chosen = 0;
  function range(w) {
    var a = w.arrive, b = w.leave;
    return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + MONTHS[b.getUTCMonth()] : dayLabel(a) + ' – ' + dayLabel(b);
  }
  windows.forEach(function (w, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'moon'; b.setAttribute('role', 'radio'); b.id = 'moon-' + i;
    b.setAttribute('aria-checked', i === 0 ? 'true' : 'false'); b.tabIndex = i === 0 ? 0 : -1;
    b.innerHTML = '<span class="moon__range">' + range(w) + '</span><span class="moon__note">' +
      (w.thisPage ? 'The night on this page' : 'New moon ' + dayLabel(w.nm) + (w.nm.getUTCFullYear() !== windows[0].nm.getUTCFullYear() ? ' ' + w.nm.getUTCFullYear() : '')) + '</span>';
    b.addEventListener('click', function () { pick(i, true); });
    list.appendChild(b);
  });
  list.addEventListener('keydown', function (e) {
    var d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); pick((chosen + d + windows.length) % windows.length, true);
  });
  function pick(i, focus) {
    chosen = i;
    Array.prototype.forEach.call(list.children, function (b, k) { b.setAttribute('aria-checked', k === i ? 'true' : 'false'); b.tabIndex = k === i ? 0 : -1; });
    if (focus) list.children[i].focus();
    var w = windows[i], pct = Math.max(1, Math.round(w.lit * 100));
    summary.textContent = 'Arrive ' + dayLabel(w.arrive) + ', leave ' + dayLabel(w.leave) + '. The moon is at most ' + pct + '% lit on your nights.';
    status.textContent = '';
  }

  // Request form. Nothing leaves the page: Umbra is a concept lodge.
  var form = document.getElementById('hold'), status = document.getElementById('hold-status');
  pick(0, false);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.elements.name, email = form.elements.email, guests = form.elements.guests;
    [name, email].forEach(function (f) { f.removeAttribute('aria-invalid'); });
    if (!name.value.trim()) { name.setAttribute('aria-invalid', 'true'); status.textContent = 'Add your name so we know who the nights are for.'; name.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { email.setAttribute('aria-invalid', 'true'); status.textContent = 'That email address looks incomplete. Check it and try again.'; email.focus(); return; }
    var w = windows[chosen], g = guests.value;
    status.textContent = 'Held on this page: ' + range(w) + ' for ' + g + (g === '1' ? ' guest' : ' guests') + ', under ' + name.value.trim().split(/\s+/)[0] + '. Umbra is a concept lodge, so no request was sent.';
  });
})();
