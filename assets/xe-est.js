/* Eletrostático: comportamento das seções (anatomia 3D, campo eletrostático, varredura).
   Cada seção se liga pelo atributo data-xe, então funciona igual no protótipo e nas seções do Shopify. */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function clamp(v, a, b) { return Math.min(Math.max(v, a), b); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function webglOk() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  }

  /* ---------------- anatomia ---------------- */
  function initAnatomia(root) {
    if (!window.THREE || !window.XEModel || !webglOk()) { root.classList.add('no-webgl'); return; }
    var stage = root.querySelector('.xe-ana__stage');
    var canvas = root.querySelector('.xe-ana__canvas');
    var steps = [].slice.call(root.querySelectorAll('.xe-ana__step'));
    var rail = [].slice.call(root.querySelectorAll('.xe-ana__rail button'));
    var labels = {};
    [].slice.call(root.querySelectorAll('.xe-ana__label')).forEach(function (l) { labels[l.dataset.k] = l; });
    var hint = root.querySelector('.xe-ana__hint');
    var FOCUS = [null, 'est', 'mid', 'bass', 'pcb', null];
    var EXPLODE = [0, 1, 1, 1, 1, 0];
    // rotação do fone em cada passo, para o grupo em foco ficar de frente
    var ROT = [[0.2, -0.55, 0.05], [0.15, -0.95, 0.05], [0.35, -0.6, 0.0], [0.05, -0.35, 0.05], [0.45, -0.5, 0.0], [0.1, -1.4, 0.0]];

    var dpr = devicePixelRatio || 1;
    // resolução limitada: acima de 1.5x o ganho visual é mínimo e o custo de GPU dobra
    var prMax = Math.min(dpr, innerWidth < 768 ? 1.25 : 1.5), prMin = 0.75, pr = prMax;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: dpr < 1.5, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(pr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    var scene = new THREE.Scene();
    scene.environment = XEModel.studioEnvironment(renderer, false);
    var cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    var key = new THREE.DirectionalLight(0xfff3e0, 2.4); key.position.set(-3, 4, 5); scene.add(key);
    var rim = new THREE.DirectionalLight(0xc9dbff, 1.6); rim.position.set(4, 1, -4); scene.add(rim);
    var gold = new THREE.PointLight(0xd9b46a, 2.5, 6, 2); gold.position.set(1.2, -0.4, 1.4); scene.add(gold);
    scene.add(new THREE.HemisphereLight(0x8899aa, 0x111111, 0.6));

    var logo = new Image();
    var model = null, pivot = new THREE.Group();
    scene.add(pivot);
    logo.onload = logo.onerror = function () {
      model = XEModel.buildIEM({ logo: logo, cable: true, shellOpacity: 0.42, lite: true });
      // centraliza o volume do fone no pivô
      var box = new THREE.Box3().setFromObject(model.groups.shell), c = box.getCenter(new THREE.Vector3());
      model.root.position.sub(c);
      pivot.add(model.root);
      // compila os shaders antes do primeiro quadro para não travar no início do scroll
      if (renderer.compile) renderer.compile(scene, cam);
      resize(); wake();
    };
    logo.src = root.dataset.logo || 'assets/logo-branco.png';

    var state = { p: 0, step: -1, explode: 0, rot: ROT[0].slice(), mx: 0, my: 0 };
    var sw = 0, sh = 0;
    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      // no celular a barra de endereço muda a altura a todo scroll; só redimensiona quando muda de verdade
      if (Math.abs(w - sw) < 1 && Math.abs(h - sh) < 80 && sw) return;
      sw = w; sh = h;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      var mobile = w < 768;
      cam.fov = mobile ? 40 : 30;
      cam.position.set(0, 0.2, mobile ? 10.5 : 9.2);
      cam.lookAt(0, 0, 0);
      cam.updateProjectionMatrix();
      // no desktop o fone fica à direita do texto; no celular, acima do texto
      pivot.position.set(mobile ? 0 : 1.25, mobile ? 1.15 : 0.3, 0);
      pivot.scale.setScalar(mobile ? 0.78 : 0.92);
    }
    var rz = 0;
    addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { resize(); wake(); }, 120); });

    function progress() {
      var r = root.getBoundingClientRect();
      return clamp(-r.top / Math.max(r.height - innerHeight, 1), 0, 1);
    }
    function setStep(i) {
      if (i === state.step) return;
      state.step = i;
      steps.forEach(function (s, k) { s.classList.toggle('is-on', k === i); });
      rail.forEach(function (b, k) { b.classList.toggle('is-on', k === i); b.setAttribute('aria-current', k === i ? 'step' : 'false'); });
      if (model) model.setFocus(FOCUS[i]);
      if (hint) hint.style.opacity = i === 0 ? 1 : 0;
    }
    rail.forEach(function (b, k) {
      b.addEventListener('click', function () {
        var r = root.getBoundingClientRect(), top = scrollY + r.top;
        var span = r.height - innerHeight;
        scrollTo({ top: top + span * ((k + 0.5) / steps.length), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      state.mx = (e.clientX - r.left) / r.width - 0.5; state.my = (e.clientY - r.top) / r.height - 0.5;
      wake();
    });

    var visible = true, last = performance.now(), v3 = new THREE.Vector3();
    var raf = 0, calm = 0, ready = false, frames = 0, slow = 0, lastRender = 0;
    var labelState = {};
    function wake() { calm = 0; if (!raf && visible && model) { last = performance.now(); raf = requestAnimationFrame(tick); } }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) wake(); }).observe(root);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wake(); });
    addEventListener('scroll', wake, { passive: true });

    function tick(now) {
      raf = 0;
      if (!visible || !model || document.hidden) return;
      var dt = Math.min((now - last) / 1000, 0.05); last = now;
      state.p = progress();
      var i = clamp(Math.floor(state.p * steps.length), 0, steps.length - 1);
      setStep(i);
      var k = reduce ? 1 : 1 - Math.pow(0.002, dt);
      var e0 = state.explode;
      state.explode = lerp(state.explode, EXPLODE[i], k * 0.9);
      var idle = (reduce || i !== 0) ? 0 : Math.sin(now / 2400) * 0.25;
      var moved = Math.abs(state.explode - e0);
      for (var a = 0; a < 3; a++) { var r0 = state.rot[a]; state.rot[a] = lerp(state.rot[a], ROT[i][a], k * 0.7); moved += Math.abs(state.rot[a] - r0); }
      // parado (sem scroll, sem transição, sem balanço) por meio segundo: para de renderizar até o próximo evento
      calm = moved < 0.0004 && !idle ? calm + dt : 0;
      // no passo inicial o balanço é lento: 30 quadros por segundo bastam
      if (idle && moved < 0.0004 && now - lastRender < 32) { raf = requestAnimationFrame(tick); return; }
      lastRender = now;
      model.setExplode(state.explode);
      pivot.rotation.set(state.rot[0] + state.my * 0.15, state.rot[1] + idle + state.mx * 0.25, state.rot[2]);
      model.update(dt);
      var t0 = performance.now();
      renderer.render(scene, cam);
      if (!ready) { ready = true; root.classList.add('is-ready'); }
      adapt(dt);
      // legendas presas às peças (só escreve no DOM quando muda)
      var anchors = model.anchors(), w = sw, h = sh, show = state.explode > 0.6;
      for (var key in labels) {
        var l = labels[key], p = anchors[key];
        if (!p) continue;
        v3.copy(p); model.root.localToWorld(v3); v3.project(cam);
        var x = Math.round((v3.x + 1) / 2 * w), y = Math.round((1 - v3.y) / 2 * h);
        var op = show ? (FOCUS[i] === key ? 1 : 0.38) : 0;
        var ls = labelState[key] || (labelState[key] = {});
        if (ls.x !== x || ls.y !== y) { l.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-5px,-50%)'; ls.x = x; ls.y = y; }
        if (ls.op !== op) { l.style.opacity = op; l.classList.toggle('is-on', show); ls.op = op; }
      }
      if (calm < 0.5) raf = requestAnimationFrame(tick);
    }
    // qualidade adaptativa: se o aparelho não segura ~45 fps, baixa a resolução do canvas
    function adapt(dt) {
      frames++;
      if (frames < 20) return;
      slow = slow * 0.9 + (dt > 1 / 45 ? 1 : 0) * 0.1;
      if (slow > 0.5 && pr > prMin) {
        pr = Math.max(prMin, pr - 0.25); renderer.setPixelRatio(pr); renderer.setSize(sw, sh, false); slow = 0; frames = 0;
      }
    }
  }

  /* ---------------- campo: eletrostático x armadura ---------------- */
  function initCampo(root) {
    var canvas = root.querySelector('.xe-campo__canvas');
    var buttons = [].slice.call(root.querySelectorAll('.xe-campo__toggle button'));
    var caption = root.querySelector('.xe-campo__caption');
    var ctx = canvas.getContext('2d');
    var mode = 'est', t = 0, visible = true, cw = 0, ch = 0;
    function size() {
      var r = canvas.getBoundingClientRect(); cw = r.width; ch = r.height;
      var d = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    }
    size(); addEventListener('resize', size);
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        mode = b.dataset.mode;
        buttons.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        caption.textContent = b.dataset.caption;
      });
    });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; if (visible) loop(); }, { rootMargin: '100px' }).observe(root);

    var GOLD = '#d9b46a', INK = '#f3f1ec', MUTED = 'rgba(243,241,236,0.35)', BLUE = '#8fb6e8';
    function air(w, h, x0, phase, amp) {
      // moléculas de ar à direita: ondas de pressão saindo do diafragma
      for (var r = 0; r < 9; r++) for (var c = 0; c < 14; c++) {
        var bx = x0 + 24 + c * ((w - x0 - 30) / 14);
        var dx = Math.sin(phase - c * 0.55) * amp * Math.exp(-c * 0.08);
        var by = h * 0.14 + r * (h * 0.72 / 8);
        ctx.fillStyle = 'rgba(243,241,236,' + (0.18 + 0.2 * (Math.sin(phase - c * 0.55) + 1) / 2) + ')';
        ctx.beginPath(); ctx.arc(bx + dx, by, 1.6, 0, 7); ctx.fill();
      }
    }
    function drawEst(w, h) {
      var cx = w * 0.36, gap = w * 0.085, top = h * 0.1, bot = h * 0.9;
      var drive = Math.sin(t * 2.4);
      // estatores perfurados
      [cx - gap, cx + gap].forEach(function (x, side) {
        ctx.fillStyle = '#2a2622'; ctx.fillRect(x - 5, top, 10, bot - top);
        for (var y = top + 8; y < bot - 6; y += 14) { ctx.fillStyle = '#0b0c0e'; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); }
        // carga das placas alterna com o sinal
        var pos = (side === 0) === (drive > 0);
        ctx.fillStyle = pos ? GOLD : BLUE; ctx.font = '600 13px Montserrat, Arial, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(pos ? '+' : '−', x, top - 10);
      });
      // linhas de campo
      ctx.strokeStyle = 'rgba(217,180,106,0.18)'; ctx.lineWidth = 1;
      for (var y = top + 20; y < bot - 10; y += 26) {
        ctx.beginPath(); ctx.moveTo(cx - gap + 6, y); ctx.lineTo(cx + gap - 6, y); ctx.stroke();
      }
      // película: move inteira, quase como um pistão
      var amp = gap * 0.42 * drive;
      // brilho feito com um traço largo translúcido (shadowBlur custa caro a cada quadro)
      ctx.beginPath();
      for (var k = 0; k <= 40; k++) {
        var yy = top + (bot - top) * k / 40, edge = Math.sin(Math.PI * k / 40);
        var xx = cx + amp * Math.pow(edge, 0.25);
        if (k === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      }
      ctx.strokeStyle = 'rgba(217,180,106,0.18)'; ctx.lineWidth = 9; ctx.stroke();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2.4; ctx.stroke();
      air(w, h, cx + gap, t * 2.4, 7);
      label(w, h, 'estator', cx - gap - 26, bot + 18); label(w, h, 'película', cx, top - 24); label(w, h, 'estator', cx + gap + 26, bot + 18); label(w, h, 'ar', cx + gap + (w - cx - gap) / 2, bot + 18);
    }
    function drawBa(w, h) {
      var x0 = w * 0.08, x1 = w * 0.5, mid = h * 0.5;
      var drive = Math.sin(t * 2.4);
      // ímãs e bobina
      ctx.fillStyle = '#2b2d31'; ctx.fillRect(x0 + 40, mid - 46, 90, 22); ctx.fillRect(x0 + 40, mid + 24, 90, 22);
      ctx.strokeStyle = '#b87333'; ctx.lineWidth = 2;
      for (var i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(x0 + 150 + i * 6, mid, 3, 18, 0, 0, 7); ctx.stroke(); }
      // palheta com pivô à esquerda
      var tipY = mid + drive * 16;
      ctx.strokeStyle = INK; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x0 + 20, mid); ctx.lineTo(x1 - 40, tipY); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x0 + 20, mid, 5, 0, 7); ctx.fill();
      // pino até o diafragma
      ctx.strokeStyle = MUTED; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x1 - 40, tipY); ctx.lineTo(x1 - 40, h * 0.2 + drive * 10); ctx.stroke();
      // diafragma: dobra a partir de um ponto
      ctx.strokeStyle = BLUE; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(x0, h * 0.2); ctx.quadraticCurveTo(x1 - 40, h * 0.2 + drive * 22, x1 + 20, h * 0.2); ctx.stroke();
      air(w, h, x1 + 20, t * 2.4, 4);
      label(w, h, 'palheta', x0 + 70, mid + 66); label(w, h, 'bobina', x0 + 175, mid + 40); label(w, h, 'diafragma', x0 + 60, h * 0.2 - 12);
    }
    function label(w, h, txt, x, y) {
      ctx.fillStyle = 'rgba(243,241,236,0.55)'; ctx.font = '500 10px Montserrat, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(txt.toUpperCase(), x, Math.min(y, h - 4));
    }
    var raf = 0;
    function loop() {
      cancelAnimationFrame(raf);
      var w = cw, h = ch;
      ctx.clearRect(0, 0, w, h);
      if (mode === 'est') drawEst(w, h); else drawBa(w, h);
      t += reduce ? 0 : 0.016;
      if (visible && !reduce) raf = requestAnimationFrame(loop);
    }
    loop();
  }

  /* ---------------- varredura de frequência ---------------- */
  function initVarredura(root) {
    var input = root.querySelector('.xe-varre__input');
    var readout = root.querySelector('.xe-varre__readout');
    var svg = root.querySelector('.xe-varre__chart svg');
    var drv = {};
    [].slice.call(root.querySelectorAll('.xe-varre__drv')).forEach(function (d) { drv[d.dataset.k] = d; });
    var play = root.querySelector('.xe-varre__play');
    var FMIN = 10, FMAX = 24000, L0 = Math.log10(FMIN), L1 = Math.log10(FMAX);
    // faixas ilustrativas de cada via (sem pontos de corte publicados)
    function weights(f) {
      var lf = Math.log10(f);
      var s = function (x, c, k) { return 1 / (1 + Math.exp(-(x - c) * k)); };
      var bass = 1 - s(lf, 2.45, 7);
      var est = s(lf, 3.55, 7);
      var mid = Math.max(0, 1 - bass - est);
      return { bass: bass, mid: mid, est: est };
    }
    function fmt(f) { return f >= 1000 ? (f / 1000).toFixed(f >= 10000 ? 1 : 2).replace('.', ',') + ' <small>kHz</small>' : Math.round(f) + ' <small>Hz</small>'; }
    var W = 1000, H = 200, PAD = 22;
    function x(f) { return (Math.log10(f) - L0) / (L1 - L0) * W; }
    function build() {
      var NS = 'http://www.w3.org/2000/svg', out = '';
      var cols = { bass: '#c8643c', mid: '#8fb6e8', est: '#d9b46a' };
      ['bass', 'mid', 'est'].forEach(function (k) {
        var d = 'M0 ' + (H - PAD);
        for (var i = 0; i <= 200; i++) {
          var f = Math.pow(10, L0 + (L1 - L0) * i / 200);
          d += ' L' + (i / 200 * W).toFixed(1) + ' ' + (H - PAD - weights(f)[k] * (H - PAD * 2)).toFixed(1);
        }
        d += ' L' + W + ' ' + (H - PAD) + ' Z';
        out += '<path d="' + d + '" fill="' + cols[k] + '" fill-opacity="0.14" stroke="' + cols[k] + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/>';
      });
      [10, 100, 1000, 10000, 24000].forEach(function (f) {
        var xx = x(f).toFixed(1), lab = f >= 1000 ? (f / 1000) + ' kHz' : f + ' Hz';
        out += '<line x1="' + xx + '" x2="' + xx + '" y1="' + PAD + '" y2="' + (H - PAD) + '" stroke="rgba(243,241,236,0.12)" vector-effect="non-scaling-stroke"/>';
        out += '<text x="' + xx + '" y="' + (H - 4) + '" fill="rgba(243,241,236,0.55)" font-size="11" font-family="Montserrat, Arial, sans-serif" text-anchor="' + (f === 10 ? 'start' : f === 24000 ? 'end' : 'middle') + '" style="letter-spacing:.08em">' + lab + '</text>';
      });
      out += '<line class="cur" x1="0" x2="0" y1="' + (PAD - 8) + '" y2="' + (H - PAD) + '" stroke="#f3f1ec" stroke-width="1.5" vector-effect="non-scaling-stroke"/>';
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.innerHTML = out;
    }
    build();
    var cur = svg.querySelector('.cur');
    var ac = null, osc = null, gain = null;
    function freq() { return Math.pow(10, L0 + (L1 - L0) * (+input.value / 1000)); }
    function update() {
      var f = freq(), w = weights(f);
      readout.innerHTML = fmt(f);
      cur.setAttribute('x1', x(f)); cur.setAttribute('x2', x(f));
      Object.keys(drv).forEach(function (k) {
        drv[k].classList.toggle('is-on', w[k] > 0.5);
        drv[k].querySelector('.bar i').style.transform = 'scaleX(' + w[k].toFixed(3) + ')';
      });
      input.setAttribute('aria-valuetext', f >= 1000 ? (f / 1000).toFixed(1) + ' quilo-hertz' : Math.round(f) + ' hertz');
      if (osc) osc.frequency.setTargetAtTime(f, ac.currentTime, 0.02);
    }
    input.addEventListener('input', update);
    update();
    if (play) play.addEventListener('click', function () {
      if (osc) { gain.gain.setTargetAtTime(0, ac.currentTime, 0.05); var o = osc; setTimeout(function () { o.stop(); }, 200); osc = null; play.setAttribute('aria-pressed', 'false'); play.querySelector('span').textContent = play.dataset.on; return; }
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      osc = ac.createOscillator(); gain = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = freq();
      gain.gain.value = 0; osc.connect(gain).connect(ac.destination); osc.start();
      gain.gain.setTargetAtTime(0.06, ac.currentTime, 0.08);
      play.setAttribute('aria-pressed', 'true'); play.querySelector('span').textContent = play.dataset.off;
    });
  }

  /* ---------------- galeria do protótipo (no Shopify quem faz é o tema) ---------------- */
  function initGaleria(root) {
    var main = root.querySelector('[data-xe-main]');
    [].slice.call(root.querySelectorAll('[data-xe-thumb]')).forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        main.removeAttribute('srcset'); main.src = t.getAttribute('href'); main.alt = t.querySelector('img').alt;
        root.querySelectorAll('[data-xe-thumb]').forEach(function (o) { o.classList.toggle('is-active', o === t); });
      });
    });
  }

  /* ================= apresentação (estilo Apple) ================= */
  // rola só quando visível; um único rAF por quadro
  function onScrollVisible(el, fn) {
    var vis = false, ticking = false;
    function run() { ticking = false; if (vis) fn(); }
    function req() { if (!ticking && vis) { ticking = true; requestAnimationFrame(run); } }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { vis = e[0].isIntersecting; if (vis) req(); }, { rootMargin: '100px' }).observe(el);
    else vis = true;
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    req();
  }

  function initHero(root) {
    var img = root.querySelector('.xe-ap-hero__img');
    function go() { requestAnimationFrame(function () { root.classList.remove('is-loading'); }); }
    if (!img || img.complete) go(); else { img.addEventListener('load', go); img.addEventListener('error', go); setTimeout(go, 1800); }
    if (reduce) return;
    onScrollVisible(root, function () {
      var r = root.getBoundingClientRect();
      root.style.setProperty('--p', clamp(-r.top / r.height, 0, 1).toFixed(3));
    });
  }

  function initDestaques(root) {
    var track = root.querySelector('.xe-ap-high__track');
    var cards = [].slice.call(track.children);
    var dotsBox = root.querySelector('.xe-ap-dots'), play = root.querySelector('.xe-ap-play');
    var idx = 0, paused = reduce, visible = false, timer = 0;
    var dots = cards.map(function (c, i) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Destaque ' + (i + 1));
      b.addEventListener('click', function () { stop(); go(i); }); dotsBox.appendChild(b); return b;
    });
    function mark(i) {
      idx = i;
      cards.forEach(function (c, k) { c.classList.toggle('is-on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-on', k === i); d.setAttribute('aria-current', k === i ? 'true' : 'false'); });
    }
    function go(i) {
      var c = cards[i]; if (!c) return;
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      track.scrollTo({ left: c.offsetLeft - pad, behavior: reduce ? 'auto' : 'smooth' });
      mark(i);
    }
    // índice ativo pelo scroll do trilho
    var st = 0;
    track.addEventListener('scroll', function () {
      cancelAnimationFrame(st);
      st = requestAnimationFrame(function () {
        var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0, best = 0, bd = 1e9;
        cards.forEach(function (c, k) { var d = Math.abs(c.offsetLeft - pad - track.scrollLeft); if (d < bd) { bd = d; best = k; } });
        if (best !== idx) mark(best);
      });
    }, { passive: true });
    function setPlay() {
      play.setAttribute('aria-label', paused ? play.dataset.off : play.dataset.on);
      play.querySelector('.i-pause').style.display = paused ? 'none' : '';
      play.querySelector('.i-play').style.display = paused ? '' : 'none';
    }
    function schedule() { clearTimeout(timer); if (!paused && visible) timer = setTimeout(function () { go((idx + 1) % cards.length); schedule(); }, 5000); }
    function stop() { paused = true; setPlay(); clearTimeout(timer); }
    play.addEventListener('click', function () { paused = !paused; setPlay(); schedule(); });
    ['pointerdown', 'wheel', 'keydown'].forEach(function (ev) { track.addEventListener(ev, function (e) { if (ev !== 'wheel' || Math.abs(e.deltaX) > Math.abs(e.deltaY)) stop(); }, { passive: true }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; schedule(); }, { threshold: 0.35 }).observe(track);
    mark(0); setPlay();
  }

  function initFrase(root) {
    var p = root.querySelector('.xe-ap-say__p'), words = [];
    function wrap(node, gold) {
      [].slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var sp = document.createElement('span'); sp.textContent = w; if (gold) sp.className = 'gold';
            frag.appendChild(sp); words.push(sp);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { wrap(n, gold || n.hasAttribute('data-gold')); }
      });
    }
    wrap(p, false);
    p.querySelectorAll('em').forEach(function (e) { e.style.fontStyle = 'normal'; });
    if (reduce) { words.forEach(function (w) { w.classList.add('on'); }); return; }
    var lit = -1;
    onScrollVisible(root, function () {
      var r = root.getBoundingClientRect();
      var t = clamp((innerHeight * 0.6 - r.top) / Math.max(r.height - innerHeight * 0.4, 1), 0, 1);
      var n = Math.round(t * 1.15 * words.length);
      if (n === lit) return; lit = n;
      words.forEach(function (w, i) { w.classList.toggle('on', i < n); });
    });
  }

  function initNumeros(root) {
    var els = [].slice.call(root.querySelectorAll('[data-count]'));
    function count(el) {
      var to = +el.dataset.count, node = el.firstChild, t0 = performance.now();
      if (reduce || !node || node.nodeType !== 3) return;
      (function step(now) {
        var k = Math.min((now - t0) / 1200, 1), e = 1 - Math.pow(1 - k, 3);
        node.textContent = String(Math.round(to * e));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (en) { en.forEach(function (e) { if (e.isIntersecting) { count(e.target); io.unobserve(e.target); } }); }, { threshold: 0.6 });
    els.forEach(function (el) { io.observe(el); });
  }

  function initDesign(root) {
    var tabs = [].slice.call(root.querySelectorAll('[role="tab"]'));
    var imgs = [].slice.call(root.querySelectorAll('.xe-ap-design__view img'));
    var cap = root.querySelector('.xe-ap-design__cap');
    function sel(i, focus) {
      var k = tabs[i].dataset.k;
      tabs.forEach(function (t, j) { t.setAttribute('aria-selected', j === i ? 'true' : 'false'); t.tabIndex = j === i ? 0 : -1; });
      imgs.forEach(function (im) { im.classList.toggle('on', im.dataset.k === k); });
      cap.innerHTML = tabs[i].dataset.cap;
      if (focus) tabs[i].focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { sel(i); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); sel((i + 1) % tabs.length, true); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); sel((i - 1 + tabs.length) % tabs.length, true); }
      });
    });
    sel(0);
  }

  // revelação ao rolar (títulos e blocos com .xe-ap-reveal)
  function initReveal(scope) {
    var els = [].slice.call((scope || document).querySelectorAll('.xe-ap-reveal:not(.is-in)'));
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('is-in'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e, i) { e.style.transitionDelay = (i % 5) * 0.08 + 's'; io.observe(e); });
  }

  var INIT = { anatomia: initAnatomia, campo: initCampo, varredura: initVarredura, galeria: initGaleria,
    hero: initHero, destaques: initDestaques, frase: initFrase, numeros: initNumeros, design: initDesign };
  function boot(scope) {
    [].slice.call((scope || document).querySelectorAll('[data-xe]')).forEach(function (el) {
      if (el.__xe) return; el.__xe = true;
      var fn = INIT[el.dataset.xe]; if (fn) fn(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { boot(); initReveal(); }); else { boot(); initReveal(); }
  // editor de temas do Shopify recarrega seções isoladas
  document.addEventListener('shopify:section:load', function (e) { boot(e.target); initReveal(e.target); });
})();
