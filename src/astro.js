/* Umbra astronomy: small, dependable, no dependencies.
   Sun position: NOAA/Meeus low-precision. New moon: Meeus, Astronomical
   Algorithms ch. 49 (accurate to a few minutes). Sidereal time: IAU 1982. */
(function (g) {
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  function jd(date) { return date.getTime() / 86400000 + 2440587.5; }
  function fromJd(j) { return new Date((j - 2440587.5) * 86400000); }
  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }

  // Greenwich mean sidereal time in degrees.
  function gmst(j) {
    var T = (j - 2451545.0) / 36525;
    return norm360(280.46061837 + 360.98564736629 * (j - 2451545) + 0.000387933 * T * T - T * T * T / 38710000);
  }
  function lst(j, lonDeg) { return norm360(gmst(j) + lonDeg); }

  // Sun apparent RA/Dec in degrees.
  function sunRaDec(j) {
    var n = j - 2451545.0;
    var L = norm360(280.460 + 0.9856474 * n);
    var gA = norm360(357.528 + 0.9856003 * n) * D2R;
    var lam = (L + 1.915 * Math.sin(gA) + 0.020 * Math.sin(2 * gA)) * D2R;
    var eps = (23.439 - 0.0000004 * n) * D2R;
    var ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)) * R2D;
    var dec = Math.asin(Math.sin(eps) * Math.sin(lam)) * R2D;
    return { ra: norm360(ra), dec: dec };
  }

  // Equatorial to horizontal. Azimuth measured from north through east.
  function altAz(raDeg, decDeg, lstDeg, latDeg) {
    var H = (lstDeg - raDeg) * D2R, d = decDeg * D2R, p = latDeg * D2R;
    var sa = Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(H);
    var alt = Math.asin(Math.max(-1, Math.min(1, sa)));
    var az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H));
    return { alt: alt * R2D, az: norm360(az * R2D) };
  }

  function sunAltAz(date, lat, lon) {
    var j = jd(date), s = sunRaDec(j);
    return altAz(s.ra, s.dec, lst(j, lon), lat);
  }

  // Meeus ch. 49, true new moon for lunation k (integer).
  function newMoonJde(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var JDE = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var M = norm360(2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * D2R;
    var Mp = norm360(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * D2R;
    var F = norm360(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * D2R;
    var Om = norm360(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * D2R;
    var s = Math.sin;
    var c = -0.40720 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
      + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
      - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
      - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
      - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M)
      + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
      + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
      - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
    // Planetary arguments
    var A = [299.77 + 0.107408 * k - 0.009173 * T2, 251.88 + 0.016321 * k, 251.83 + 26.651886 * k,
      349.42 + 36.412478 * k, 84.66 + 18.206239 * k, 141.74 + 53.303771 * k, 207.14 + 2.453732 * k,
      154.84 + 7.306860 * k, 34.52 + 27.261239 * k, 207.19 + 0.121824 * k, 291.34 + 1.844379 * k,
      161.72 + 24.198154 * k, 239.56 + 25.513099 * k, 331.55 + 3.592518 * k];
    var co = [325, 165, 164, 126, 110, 62, 60, 56, 47, 42, 40, 37, 35, 23];
    var add = 0;
    for (var i = 0; i < 14; i++) add += co[i] * 1e-6 * Math.sin(norm360(A[i]) * D2R);
    return JDE + c + add; // TT; the ~70 s TT-UT gap is irrelevant here
  }

  // The next n new moons after a date.
  function nextNewMoons(from, n) {
    var k = Math.floor((from.getFullYear() + (from.getMonth() + 0.5) / 12 - 2000) * 12.3685) - 2;
    var out = [], j0 = jd(from);
    while (out.length < n) {
      var j = newMoonJde(k++);
      if (j > j0) out.push(fromJd(j));
    }
    return out;
  }

  // Fraction of the moon's disc lit, from its age in days (good to a few %).
  function moonLit(date, lastNew) {
    var age = (date - lastNew) / 86400000;
    return (1 - Math.cos(2 * Math.PI * age / 29.530588853)) / 2;
  }

  g.UmbraAstro = { jd: jd, fromJd: fromJd, gmst: gmst, lst: lst, sunRaDec: sunRaDec, altAz: altAz,
    sunAltAz: sunAltAz, newMoonJde: newMoonJde, nextNewMoons: nextNewMoons, moonLit: moonLit, D2R: D2R, R2D: R2D };
})(typeof window !== 'undefined' ? window : globalThis);
