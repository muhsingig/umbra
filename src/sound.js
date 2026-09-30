/* Opt-in sound, synthesised live: high-altitude wind that rises with scroll
   speed, prayer flags snapping in the gusts, and a soft shutter at 22:00 and
   02:00. Nothing plays until the visitor turns it on. */
(function () {
  var S = window.UmbraScene, api = S.api;
  var btn = document.getElementById('snd');
  if (!btn || !(window.AudioContext || window.webkitAudioContext)) { if (btn) btn.hidden = true; return; }
  var ac = null, master, windGain, windBand, flagGain, on = false, timer = null, flapT = 0;

  function noiseBuffer(sec) {
    var len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0), last = 0;
    for (var i = 0; i < len; i++) { var w = Math.random() * 2 - 1; last = (last + 0.035 * w) / 1.035; d[i] = last * 3.2 + w * 0.08; }
    return b;
  }
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    var buf = noiseBuffer(4);
    var src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    windBand = ac.createBiquadFilter(); windBand.type = 'bandpass'; windBand.frequency.value = 420; windBand.Q.value = 0.6;
    var low = ac.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 1400;
    windGain = ac.createGain(); windGain.gain.value = 0.35;
    src.connect(windBand); windBand.connect(low); low.connect(windGain); windGain.connect(master);
    var gust = ac.createOscillator(), gustAmt = ac.createGain(); gust.frequency.value = 0.07; gustAmt.gain.value = 160;
    gust.connect(gustAmt); gustAmt.connect(windBand.frequency); gust.start();
    // flags: bright noise, gated in short flaps
    var src2 = ac.createBufferSource(); src2.buffer = buf; src2.loop = true; src2.playbackRate.value = 1.7;
    var hi = ac.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 1600;
    flagGain = ac.createGain(); flagGain.gain.value = 0;
    src2.connect(hi); hi.connect(flagGain); flagGain.connect(master);
    src.start(); src2.start();
  }
  function shutter(open) {
    if (!on) return;
    var t = ac.currentTime, len = 0.05, b = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    [0, open ? 0.09 : 0.06].forEach(function (dt, k) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = b; f.type = 'bandpass'; f.frequency.value = k ? 2600 : 1800; f.Q.value = 3; g.gain.value = 0.5;
      s.connect(f); f.connect(g); g.connect(master); s.start(t + dt);
    });
  }
  function tick() {
    var sp = Math.min(api.speed || 0, 3), t = ac.currentTime;
    windGain.gain.setTargetAtTime(0.28 + sp * 0.22, t, 0.4);
    windBand.frequency.setTargetAtTime(380 + sp * 320, t, 0.5);
    if (t > flapT) {
      var amt = 0.035 + sp * 0.05, n = 2 + Math.floor(Math.random() * 4);
      for (var i = 0; i < n; i++) {
        var at = t + i * (0.05 + Math.random() * 0.05);
        flagGain.gain.setTargetAtTime(amt * (0.5 + Math.random()), at, 0.008);
        flagGain.gain.setTargetAtTime(0, at + 0.02, 0.03);
      }
      flapT = t + 0.35 + Math.random() * (1.6 - sp * 0.4);
    }
  }
  function set(v) {
    on = v; btn.setAttribute('aria-pressed', String(v));
    btn.querySelector('.snd__label').textContent = v ? 'Sound on' : 'Sound off';
    if (v) {
      if (!ac) build();
      ac.resume(); master.gain.setTargetAtTime(0.55, ac.currentTime, 0.8);
      clearInterval(timer); timer = setInterval(tick, 80);
    } else if (ac) {
      master.gain.setTargetAtTime(0, ac.currentTime, 0.25);
      clearInterval(timer); setTimeout(function () { if (!on) ac.suspend(); }, 900);
    }
  }
  btn.addEventListener('click', function () { set(!on); });
  document.addEventListener('umbra:shutter', function (e) { shutter(e.detail.open); });
  document.addEventListener('visibilitychange', function () { if (ac && on) { if (document.hidden) ac.suspend(); else ac.resume(); } });
})();
