/* Umbra sky renderer (WebGL2).
   Horizon frame: x east, y north, z up. Camera looks along (azimuth, pitch).
   Star trails are integrated analytically: a prefix sum of the star map along
   right ascension, so any exposure length costs the same eight texel reads per
   pixel and scrolling backwards simply un-exposes. */
(function (g) {
  var D2R = Math.PI / 180;

  var SKY_VS = '#version 300 es\n' +
    'in vec2 aPos; out vec2 vNdc;\n' +
    'void main(){ vNdc = aPos; gl_Position = vec4(aPos,0.,1.); }';

  var SKY_FS = '#version 300 es\n' +
    'precision highp float; precision highp int;\n' +
    'in vec2 vNdc; out vec4 o;\n' +
    'uniform vec3 uR, uU, uF;            // camera basis in horizon frame\n' +
    'uniform vec2 uTan;                  // tan(hfov/2), tan(vfov/2)\n' +
    'uniform mat3 uM;                    // equatorial -> horizon, now\n' +
    'uniform mat3 uMe;                   // equatorial -> horizon, at exposure end\n' +
    'uniform vec3 uSun;                  // sun direction, horizon frame\n' +
    'uniform float uSunAlt;              // degrees\n' +
    'uniform float uPollution, uMwVis, uTrail, uTrailSpan, uTime, uExposure, uAirglow, uMwLod;\n' +
    'uniform sampler2D uMw;\n' +
    'uniform highp sampler2D uTrailTex;\n' +
    'uniform vec4 uTrailDim;             // cols, rows, decMin, decStep\n' +
    'uniform vec2 uRes;\n' +
    'uniform vec3 uMetA, uMetB; uniform float uMet, uMetLive;\n' +
    'const float PI = 3.14159265;\n' +
    'float h12(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }\n' +
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);\n' +
    '  return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }\n' +
    // Prefix-sum read with linear interpolation along RA; wraps.
    'vec2 pref(float c, int r){ float n = uTrailDim.x; c = mod(c, n); float i0 = floor(c); float fr = c - i0;\n' +
    '  int a = int(i0); int b = int(mod(i0 + 1., n));\n' +
    '  vec2 va = texelFetch(uTrailTex, ivec2(a, r), 0).rg; vec2 vb = texelFetch(uTrailTex, ivec2(b, r), 0).rg;\n' +
    '  if (b == 0) vb += texelFetch(uTrailTex, ivec2(int(n) - 1, r), 0).rg; // wrap: add row total\n' +
    '  return mix(va, vb, fr); }\n' +
    'vec2 windowSum(float cEnd, float span, int r){\n' +
    '  float n = uTrailDim.x; vec2 total = texelFetch(uTrailTex, ivec2(int(n) - 1, r), 0).rg;\n' +
    '  if (span >= n) return total;\n' +
    '  float cStart = cEnd - span; float ce = mod(cEnd, n); float cs = mod(cStart, n);\n' +
    '  vec2 s = pref(ce, r) - pref(cs, r); if (cs > ce) s += total; return max(s, vec2(0.)); }\n' +
    'vec3 trailAt(vec3 d){\n' +
    '  vec3 e = transpose(uMe) * d; float dec = degrees(asin(clamp(e.z,-1.,1.)));\n' +
    '  float ra = degrees(atan(e.y, e.x)); if (ra < 0.) ra += 360.;\n' +
    '  float rowf = (dec - uTrailDim.z) / uTrailDim.w - 0.5; if (rowf < 0. || rowf > uTrailDim.y - 2.) return vec3(0.);\n' +
    '  int r0 = int(floor(rowf)); float fr = rowf - float(r0);\n' +
    '  float cEnd = ra / 360. * uTrailDim.x; float span = uTrailSpan / 360. * uTrailDim.x;\n' +
    '  vec2 s = mix(windowSum(cEnd, span, r0), windowSum(cEnd, span, r0 + 1), fr);\n' +
    '  float L = s.x; float tint = s.y / max(L, 1e-5);\n' +
    '  vec3 cool = vec3(0.72, 0.84, 1.0), warm = vec3(1.0, 0.78, 0.52);\n' +
    '  return mix(cool, warm, clamp(tint, 0., 1.)) * L; }\n' +
    'float meteor(vec3 d){\n' +
    '  vec3 n = normalize(cross(uMetA, uMetB)); float off = asin(clamp(dot(d, n), -1., 1.));\n' +
    '  vec3 p = normalize(d - n * dot(d, n)); float tot = acos(clamp(dot(uMetA, uMetB), -1., 1.));\n' +
    '  float u = acos(clamp(dot(uMetA, p), -1., 1.)) / tot; if (dot(cross(uMetA, p), n) < 0.) u = -u;\n' +
    '  if (u < 0. || u > 1.) return 0.;\n' +
    '  float w = radians(0.045) * (0.5 + sin(3.14159 * u));\n' +
    '  float core = exp(-off * off / (2. * w * w)) + 0.25 * exp(-off * off / (18. * w * w));\n' +
    '  float persist = uMet * pow(sin(3.14159 * u), 0.8) * 0.8;\n' +
    '  float live = 0.; if (uMetLive >= 0.) { float head = uMetLive * 1.2; live = (u <= head ? exp(-(head - u) * 4.) : 0.) * (1. - smoothstep(0.7, 1., uMetLive)) * 3.; }\n' +
    '  return core * (persist + live); }\n' +
    'vec3 sky(vec3 d, bool refl){\n' +
    '  float alt = asin(clamp(d.z, -1., 1.));\n' +
    '  float up = max(d.z, 0.);\n' +
    '  float t = smoothstep(-19., 1., uSunAlt);            // twilight amount\n' +
    '  float tw = pow(t, 2.2);\n' +
    '  vec3 night = mix(vec3(0.007,0.009,0.018), vec3(0.0025,0.0035,0.008), pow(up, 0.45));\n' +
    '  night += vec3(0.004,0.009,0.005) * uAirglow * exp(-abs(alt) / 0.16);\n' +
    '  vec3 hz = vec3(0.30,0.40,0.62), zn = vec3(0.07,0.14,0.34);\n' +
    '  vec3 col = night + tw * mix(hz, zn, pow(up, 0.55)) * 1.25;\n' +
    '  vec2 sh = normalize(uSun.xy + 1e-5); vec2 dh = normalize(d.xy + 1e-5);\n' +
    '  float cg = dot(sh, dh);\n' +
    '  float band = exp(-max(alt, 0.) / 0.13);\n' +
    '  float warmAmt = smoothstep(-16., -1., uSunAlt);\n' +
    '  col += vec3(1.0, 0.38, 0.12) * pow(max(cg, 0.), 1.8) * band * warmAmt * 1.5;\n' +
    '  col += vec3(0.55, 0.30, 0.42) * pow(max(cg, 0.), 1.2) * exp(-max(alt,0.)/0.4) * warmAmt * 0.35;\n' +
    '  col += vec3(0.85, 0.55, 0.62) * pow(max(-cg, 0.), 3.) * exp(-max(alt,0.)/0.22) * warmAmt * 0.18;  // belt of Venus\n' +
    '  // skyglow of a lit city: orange dome, grey wash\n' +
    '  float city = 0.45 + 0.75 * smoothstep(-0.5, 0.7, dot(normalize(d.xy + 1e-5), normalize(uF.xy + 1e-5) * mat2(0.,1.,-1.,0.)) );\n' +
    '  col += uPollution * (vec3(0.42,0.22,0.08) * exp(-max(alt,0.) / 0.30) * city + vec3(0.06,0.05,0.045));\n' +
    '  float dark = (1. - smoothstep(-19., -11., uSunAlt)) * (1. - uPollution);\n' +
    '  vec3 e = transpose(uM) * d;\n' +
    '  float ra = atan(e.y, e.x); if (ra < 0.) ra += 2.*PI; float dec = asin(clamp(e.z,-1.,1.));\n' +
    '  float mw = textureLod(uMw, vec2(ra / (2.*PI), (PI*0.5 - dec) / PI), uMwLod).r;\n' +
    '  float mott = 0.75 + 0.5 * vnoise(vec2(ra, dec) * 90.);\n' +
    '  float ext = smoothstep(-0.02, 0.28, alt);\n' +
    '  col += vec3(0.80, 0.84, 1.0) * (mw * 0.07 + mw * mw * 0.22) * mott * dark * uMwVis * ext;\n' +
    '  col += trailAt(d) * uTrail * ext * 0.55;\n' +
    '  col += vec3(0.8, 1.0, 0.86) * meteor(d) * ext;\n' +
    '  return col; }\n' +
    'void main(){\n' +
    '  vec3 d = normalize(uF + vNdc.x * uTan.x * uR + vNdc.y * uTan.y * uU);\n' +
    '  vec3 col;\n' +
    '  if (d.z >= 0.) { col = sky(d, false); }\n' +
    '  else {\n' +
    '    float depth = clamp(-d.z * 12., 0., 1.);\n' +
    '    vec2 q = gl_FragCoord.xy / uRes.y;\n' +
    '    float rip = (vnoise(vec2(q.x * 40., q.y * 260. - uTime * 0.6)) - 0.5) * (0.004 + depth * 0.01);\n' +
    '    vec3 m = normalize(vec3(d.x + rip, d.y, -d.z));\n' +
    '    col = sky(m, true) * mix(0.62, 0.3, depth) + vec3(0.004,0.006,0.012);\n' +
    '  }\n' +
    '  col = 1. - exp(-col * uExposure);\n' +
    '  col = pow(col, vec3(1./2.2));\n' +
    '  col += (h12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.;\n' +
    '  o = vec4(col, 1.);\n' +
    '}';

  var STAR_VS = '#version 300 es\n' +
    'in vec4 aStar;   // ra(rad), dec(rad), mag, bv\n' +
    'uniform mat3 uM; uniform vec3 uR, uU, uF; uniform vec2 uTan;\n' +
    'uniform float uLimit, uDpr, uMirror, uTime, uGain, uFaintGate;\n' +
    'out vec3 vCol; out float vA; out float vSig; out float vHalf;\n' +
    'float h1(float n){ return fract(sin(n) * 43758.5453); }\n' +
    'void main(){\n' +
    '  vec3 e = vec3(cos(aStar.y)*cos(aStar.x), cos(aStar.y)*sin(aStar.x), sin(aStar.y));\n' +
    '  vec3 h = uM * e;\n' +
    '  if (uMirror > 0.5) h.z = -h.z;\n' +
    '  vec3 v = vec3(dot(h,uR), dot(h,uU), dot(h,uF));\n' +
    '  float alt = asin(clamp(abs(h.z),-1.,1.));\n' +
    '  if (v.z <= 0.001 || (uMirror < 0.5 && h.z < -0.01) || (uMirror > 0.5 && h.z > 0.01)) { gl_Position = vec4(2.,2.,2.,1.); gl_PointSize = 0.; vA = 0.; vCol = vec3(0.); vSig = 1.; vHalf = 1.; return; }\n' +
    '  vec2 ndc = vec2(v.x / v.z / uTan.x, v.y / v.z / uTan.y);\n' +
    '  gl_Position = vec4(ndc, 0., 1.);\n' +
    '  float mag = aStar.z + (1. - smoothstep(0., 0.35, alt)) * 1.4;            // extinction\n' +
    '  float flux = pow(10., -0.4 * (mag - 1.0));\n' +
    '  float vis = smoothstep(uLimit + 0.35, uLimit - 0.55, mag);\n' +
    '  vis *= mix(1., uFaintGate, step(6.05, aStar.z));\n' +
    '  float tw = 1. + 0.28 * (1. - smoothstep(0.05, 0.6, alt)) * sin(uTime * (3. + h1(aStar.x*91.) * 5.) + h1(aStar.y*37.) * 6.28);\n' +
    '  vA = clamp(pow(flux, 0.38) * uGain * 1.9, 0., 1.7) * vis * tw * (uMirror > 0.5 ? 0.42 : 1.);\n' +
    '  float bv = clamp(aStar.w, -0.3, 1.9);\n' +
    '  vec3 blue = vec3(0.66, 0.78, 1.0), white = vec3(1.0, 0.97, 0.93), orange = vec3(1.0, 0.72, 0.46);\n' +
    '  vCol = bv < 0.5 ? mix(blue, white, (bv + 0.3) / 0.8) : mix(white, orange, (bv - 0.5) / 1.4);\n' +
    '  vSig = (0.62 + 1.05 * pow(min(flux, 6.), 0.33)) * uDpr;\n' +
    '  float bright = smoothstep(0.35, 3., flux);\n' +
    '  gl_PointSize = ceil(vSig * (6. + 14. * bright)) + 2.;\n' +
    '  vHalf = gl_PointSize * 0.5;\n' +
    '}';

  var STAR_FS = '#version 300 es\n' +
    'precision mediump float; in vec3 vCol; in float vA; in float vSig; in float vHalf; out vec4 o;\n' +
    'void main(){ vec2 p = (gl_PointCoord - 0.5) * 2. * vHalf; float r2 = dot(p,p);\n' +
    '  float core = exp(-r2 / (2. * vSig * vSig));\n' +
    '  float halo = exp(-sqrt(r2) / (vSig * 2.4)) * 0.16 * smoothstep(0.9, 1.6, vA);\n' +
    '  float a = (core + halo) * vA; o = vec4(vCol * a, a); }';

  function compile(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(gl, vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // Star trail map: prefix sums along RA, two channels (flux, flux*warmth).
  function buildTrailMap(stars) {
    var NC = 2880, NR = 800, DEC0 = 10, DSTEP = 0.1, CSTEP = 360 / NC;
    var buf = new Float32Array(NC * NR * 2);
    for (var i = 0; i < stars.length; i += 4) {
      var ra = stars[i], dec = stars[i + 1], mag = stars[i + 2], bv = stars[i + 3];
      if (mag > 5.4 || dec < DEC0 - 1) continue;
      var b = Math.pow(Math.pow(10, -0.4 * (mag - 1.0)), 0.55);
      var warm = Math.min(Math.max((bv - 0.1) / 1.4, 0), 1);
      var sd = 0.055 + 0.05 * Math.min(b, 1);
      var cosd = Math.max(Math.cos(dec * D2R), 0.02);
      var sra = Math.min(sd / cosd, 30);
      var r0 = Math.floor((dec - 3 * sd - DEC0) / DSTEP), r1 = Math.ceil((dec + 3 * sd - DEC0) / DSTEP);
      var c0 = Math.floor((ra - 3 * sra) / CSTEP), c1 = Math.ceil((ra + 3 * sra) / CSTEP);
      var wsum = 0, wc = [];
      for (var c = c0; c <= c1; c++) { var dx = (c + 0.5) * CSTEP - ra; var w = Math.exp(-dx * dx / (2 * sra * sra)); wc.push(w); wsum += w; }
      if (wsum <= 0) continue;
      for (var r = r0; r <= r1; r++) {
        if (r < 0 || r >= NR) continue;
        var dy = DEC0 + (r + 0.5) * DSTEP - dec;
        var wr = Math.exp(-dy * dy / (2 * sd * sd)) * b;
        if (wr < 1e-4) continue;
        for (var k = 0; k < wc.length; k++) {
          var cc = ((c0 + k) % NC + NC) % NC;
          var v = wr * wc[k] / wsum, idx = (r * NC + cc) * 2;
          buf[idx] += v; buf[idx + 1] += v * warm;
        }
      }
    }
    for (var rr = 0; rr < NR; rr++) {
      var a = 0, bb = 0, base = rr * NC * 2;
      for (var c2 = 0; c2 < NC; c2++) { a += buf[base + c2 * 2]; bb += buf[base + c2 * 2 + 1]; buf[base + c2 * 2] = a; buf[base + c2 * 2 + 1] = bb; }
    }
    return { data: buf, cols: NC, rows: NR, dec0: DEC0, step: DSTEP };
  }

  // Faint stars below the catalogue limit, clustered along the Milky Way.
  function faintField(mwImg, n) {
    var cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
    var cx = cv.getContext('2d'); cx.drawImage(mwImg, 0, 0, 512, 256);
    var px = cx.getImageData(0, 0, 512, 256).data;
    var rnd = mulberry(20261010), out = new Float32Array(n * 4), k = 0, guard = 0;
    while (k < n && guard++ < n * 40) {
      var u = rnd(), z = rnd() * 1.32 - 0.32;           // dec above about -19 deg
      var ra = u * 360, dec = Math.asin(z) / D2R;
      var ix = Math.min(511, Math.floor(u * 512)), iy = Math.min(255, Math.floor((90 - dec) / 180 * 256));
      var dens = px[(iy * 512 + ix) * 4] / 255;
      if (rnd() > 0.22 + 0.78 * dens) continue;
      var mag = 6.1 + Math.pow(rnd(), 0.55) * 2.6;
      out[k * 4] = ra * D2R; out[k * 4 + 1] = dec * D2R; out[k * 4 + 2] = mag; out[k * 4 + 3] = 0.2 + rnd() * 1.1; k++;
    }
    return out.subarray(0, k * 4);
  }

  function Sky(canvas, opts) {
    var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2 unavailable');
    this.gl = gl; this.canvas = canvas;
    this.skyP = program(gl, SKY_VS, SKY_FS);
    this.starP = program(gl, STAR_VS, STAR_FS);

    this.quad = gl.createVertexArray(); gl.bindVertexArray(this.quad);
    var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var la = gl.getAttribLocation(this.skyP.p, 'aPos'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);

    // catalogue stars (deg -> rad) plus the faint field
    var cat = opts.stars, faint = faintField(opts.mwImg, opts.faint || 9000);
    var all = new Float32Array(cat.length + faint.length);
    for (var i = 0; i < cat.length; i += 4) { all[i] = cat[i] * D2R; all[i + 1] = cat[i + 1] * D2R; all[i + 2] = cat[i + 2]; all[i + 3] = cat[i + 3]; }
    all.set(faint, cat.length);
    this.nStars = all.length / 4;
    this.starVao = gl.createVertexArray(); gl.bindVertexArray(this.starVao);
    var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, all, gl.STATIC_DRAW);
    var sa = gl.getAttribLocation(this.starP.p, 'aStar'); gl.enableVertexAttribArray(sa); gl.vertexAttribPointer(sa, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // Milky Way map
    this.mwTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.mwTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, opts.mwImg);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // trail prefix map
    var tm = buildTrailMap(cat);
    this.trailDim = [tm.cols, tm.rows, tm.dec0, tm.step];
    this.trailTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.trailTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, tm.cols, tm.rows, 0, gl.RG, gl.FLOAT, tm.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  // Equatorial -> horizon rotation for a local sidereal time and latitude.
  Sky.eqToHor = function (lstDeg, latDeg) {
    var L = lstDeg * D2R, p = latDeg * D2R, sL = Math.sin(L), cL = Math.cos(L), sp = Math.sin(p), cp = Math.cos(p);
    // rows: east, north, up. Returned column-major for GLSL.
    var r = [[-sL, cL, 0], [-sp * cL, -sp * sL, cp], [cp * cL, cp * sL, sp]];
    return new Float32Array([r[0][0], r[1][0], r[2][0], r[0][1], r[1][1], r[2][1], r[0][2], r[1][2], r[2][2]]);
  };

  Sky.camera = function (azDeg, pitchDeg) {
    var a = azDeg * D2R, p = pitchDeg * D2R;
    var F = [Math.sin(a) * Math.cos(p), Math.cos(a) * Math.cos(p), Math.sin(p)];
    var R = [Math.cos(a), -Math.sin(a), 0];
    var U = [-Math.sin(a) * Math.sin(p), -Math.cos(a) * Math.sin(p), Math.cos(p)];
    return { F: F, R: R, U: U };
  };

  Sky.prototype.render = function (s) {
    var gl = this.gl, c = this.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.disable(gl.BLEND);
    var P = this.skyP; gl.useProgram(P.p);
    gl.uniform3fv(P.u.uR, s.cam.R); gl.uniform3fv(P.u.uU, s.cam.U); gl.uniform3fv(P.u.uF, s.cam.F);
    gl.uniform2f(P.u.uTan, s.tanH, s.tanV);
    gl.uniformMatrix3fv(P.u.uM, false, s.M); gl.uniformMatrix3fv(P.u.uMe, false, s.Me);
    gl.uniform3fv(P.u.uSun, s.sun); gl.uniform1f(P.u.uSunAlt, s.sunAlt);
    gl.uniform1f(P.u.uPollution, s.pollution); gl.uniform1f(P.u.uMwVis, s.mwVis);
    gl.uniform1f(P.u.uTrail, s.trail); gl.uniform1f(P.u.uTrailSpan, s.trailSpan);
    gl.uniform1f(P.u.uTime, s.time); gl.uniform1f(P.u.uExposure, s.exposure); gl.uniform1f(P.u.uAirglow, s.airglow);
    gl.uniform3fv(P.u.uMetA, s.metA || [0, 1, 0]); gl.uniform3fv(P.u.uMetB, s.metB || [0, 1, 0.1]); gl.uniform1f(P.u.uMet, s.met || 0); gl.uniform1f(P.u.uMetLive, s.metLive == null ? -1 : s.metLive);
    gl.uniform4fv(P.u.uTrailDim, this.trailDim); gl.uniform1f(P.u.uMwLod, Math.max(0, Math.log2((2 * s.tanV / c.height) / (2 * Math.PI / 2048)))); gl.uniform2f(P.u.uRes, c.width, c.height);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.mwTex); gl.uniform1i(P.u.uMw, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.trailTex); gl.uniform1i(P.u.uTrailTex, 1);
    gl.bindVertexArray(this.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    var S = this.starP; gl.useProgram(S.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniformMatrix3fv(S.u.uM, false, s.M);
    gl.uniform3fv(S.u.uR, s.cam.R); gl.uniform3fv(S.u.uU, s.cam.U); gl.uniform3fv(S.u.uF, s.cam.F);
    gl.uniform2f(S.u.uTan, s.tanH, s.tanV);
    gl.uniform1f(S.u.uLimit, s.limit); gl.uniform1f(S.u.uDpr, s.dpr); gl.uniform1f(S.u.uTime, s.time);
    gl.uniform1f(S.u.uGain, s.starGain); gl.uniform1f(S.u.uFaintGate, s.faintGate);
    gl.bindVertexArray(this.starVao);
    gl.uniform1f(S.u.uMirror, 0); gl.drawArrays(gl.POINTS, 0, this.nStars);
    gl.uniform1f(S.u.uMirror, 1); gl.drawArrays(gl.POINTS, 0, this.nStars);
    gl.bindVertexArray(null);
  };

  g.UmbraSky = Sky;
})(window);
