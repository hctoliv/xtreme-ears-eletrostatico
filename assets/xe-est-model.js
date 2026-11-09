/* Xtreme Ears Eletrostático: modelo 3D procedural do fone (casco moldado, faceplate e os 8 drivers).
   Usa o THREE global (three@0.160.0/build/three.min.js). Compartilhado pela página e pelo render das fotos. */
(function (global) {
  'use strict';

  var COLORS = {
    est: 0xd9b46a,   // película dos eletrostáticos
    mid: 0x8fb6e8,
    bass: 0xc8643c,
    pcb: 0x1d2a24,
    copper: 0xb87333
  };

  // Contorno do faceplate tirado do vídeo do fone real: gota larga e arredondada em cima,
  // lado da cânula (+x) mais reto, afinando numa ponta embaixo.
  var OUTLINE_PTS = [[0.0, 0.82], [-0.38, 0.72], [-0.6, 0.4], [-0.6, 0.0], [-0.44, -0.38], [-0.18, -0.68], [0.1, -0.9],
                     [0.26, -0.82], [0.38, -0.5], [0.48, -0.06], [0.47, 0.4], [0.28, 0.74]];
  // pts: contorno em unidades da cena (o do molde real) ou, sem ele, o contorno desenhado escalado 1,2
  function outlinePoints(n, pts) {
    var src = pts || OUTLINE_PTS.map(function (p) { return [p[0] * 1.2, p[1] * 1.2]; });
    var curve = new THREE.CatmullRomCurve3(src.map(function (p) { return new THREE.Vector3(p[0], p[1], 0); }), true, 'centripetal');
    return curve.getSpacedPoints(n).slice(0, n);
  }

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  // Corpo moldado (fotos do site e do destaque "Moldados" no Instagram): um volume cheio e fundo.
  // Abaixo do faceplate ele estufa para o lado arredondado: a concha embaixo e o lóbulo da hélix no alto,
  // para trás. A cânula sai da parte baixa da frente, sob a borda reta, e entra no ouvido.
  var TOP = 0.42;
  // no vídeo o corpo é um bulbo cheio e a cânula é longa, saindo de lado com um colarinho perto da ponta
  var CANAL_DIR = new THREE.Vector3(0.74, -0.12, -0.66).normalize();
  var BODY_DEPTH = 1.12;
  var BODY_END = new THREE.Vector3(0.3, -0.24, TOP - BODY_DEPTH);
  var CANAL_LEN = 0.66, CANAL_R = 0.2, TIP_R = 0.15;
  function smooth(e0, e1, x) { var t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return t * t * (3 - 2 * t); }
  function shellGeometry() {
    var RINGS = 72, SEG = 140;
    var ol = outlinePoints(SEG), pos = [], idx = [];
    var bowl = new THREE.Vector2(-0.35, -0.94).normalize();  // concha: para baixo e para trás
    var helix = new THREE.Vector2(-0.62, 0.78).normalize();  // hélix: lóbulo no alto, para trás
    for (var i = 0; i <= RINGS; i++) {
      var u = i / RINGS;                   // 0..1 ao longo de corpo + cânula
      var split = 0.74;                    // fração dos anéis usada pelo corpo
      var cx, cy, cz, sc, m, r;
      if (u <= split) {
        var v = u / split;
        var k = smooth(0.35, 1, v);
        cx = BODY_END.x * k; cy = BODY_END.y * k; cz = TOP - BODY_DEPTH * v;
        // bulbo: estufa bem no primeiro terço e só depois afina até a boca da cânula
        // domo: quase do tamanho do faceplate logo abaixo dele e arredondando até a boca da cânula
        sc = Math.max(0.3, (1 + 0.04 * Math.sin(Math.min(v / 0.35, 1) * Math.PI)) * Math.sqrt(Math.max(1 - Math.pow(v, 2.4) * 0.92, 0)));
        m = smooth(0.6, 1, v); r = 0.27;
      } else {
        var w = (u - split) / (1 - split);
        var c = BODY_END.clone().addScaledVector(CANAL_DIR, CANAL_LEN * w);
        cx = c.x; cy = c.y; cz = c.z; sc = 1; m = 1;
        r = 0.27 - (0.27 - CANAL_R) * smooth(0, 0.35, w);
        if (w > 0.74 && w < 0.9) r += 0.035 * Math.sin((w - 0.74) / 0.16 * Math.PI);   // colarinho
        if (w > 0.94) r *= 0.75 + 0.25 * Math.sqrt(Math.max(1 - Math.pow((w - 0.94) / 0.06, 2), 0));
      }
      var vv = Math.min(u / split, 1);
      var bulge = Math.sin(Math.min(vv / 0.7, 1) * Math.PI) * (1 - m);
      for (var j = 0; j < SEG; j++) {
        var a = (j / SEG) * Math.PI * 2;
        var px = ol[j].x, py = ol[j].y;
        var len = Math.hypot(px, py) || 1, dx = px / len, dy = py / len;
        var e = 1 + bulge * (0.1 * Math.pow(Math.max(0, dx * bowl.x + dy * bowl.y), 1.4) + 0.08 * Math.pow(Math.max(0, dx * helix.x + dy * helix.y), 2.5));
        var ox = px * sc * e, oy = py * sc * e;
        var qx = Math.cos(a) * r, qy = Math.sin(a) * r * 0.88;
        pos.push(cx + ox * (1 - m) + qx * m, cy + oy * (1 - m) + qy * m, cz);
      }
    }
    for (i = 0; i < RINGS; i++) {
      for (j = 0; j < SEG; j++) {
        var a1 = i * SEG + j, b1 = i * SEG + (j + 1) % SEG, c1 = a1 + SEG, d1 = b1 + SEG;
        idx.push(a1, c1, b1, b1, c1, d1);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function canalEnd() { return BODY_END.clone().addScaledVector(CANAL_DIR, CANAL_LEN); }

  function faceplateGeometry(pts) {
    var ol = outlinePoints(160, pts), shape = new THREE.Shape();
    ol.forEach(function (p, k) { if (k === 0) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y); });
    shape.closePath();
    var g = new THREE.ExtrudeGeometry(shape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 8, curveSegments: 120 });
    g.computeBoundingBox();
    var bb = g.boundingBox, uv = g.attributes.uv, ps = g.attributes.position;
    for (var i = 0; i < uv.count; i++) {
      uv.setXY(i, (ps.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (ps.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
    }
    return g;
  }

  // Faceplate realista: resina preta funda com folha de ouro em lascas irregulares sob o verniz,
  // e o X da marca em metal. Gera mapas de cor, metal, rugosidade e relevo com o mesmo sorteio,
  // para as lascas brilharem como metal e o fundo ficar com cara de resina polida.
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function faceplateMaps(logo, mirror) {
    var W = 1536, H = 2360, r = rng(1234567);
    var flakes = [];
    for (var i = 0; i < 3800; i++) {
      var big = r() < 0.045;
      var sz = big ? 9 + r() * 20 : 1.3 + Math.pow(r(), 2.5) * 7;
      var n = 4 + Math.floor(r() * 4), pts = [];
      for (var k = 0; k < n; k++) { var a = k / n * Math.PI * 2 + r() * 0.6, rr = sz * (0.45 + r() * 0.75); pts.push([Math.cos(a) * rr, Math.sin(a) * rr * (0.5 + r() * 0.6)]); }
      flakes.push({ x: r() * W, y: r() * H, rot: r() * 6.3, pts: pts, big: big, hue: 36 + r() * 12, lum: 42 + r() * 36, a: big ? 0.35 + r() * 0.35 : 0.55 + r() * 0.45, tilt: r() });
    }
    function poly(ctx, f) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.beginPath(); f.pts.forEach(function (p, k) { if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.restore(); }
    var logoCanvas = null;
    if (logo && logo.complete && logo.naturalWidth) {
      var sw = logo.naturalWidth, sh = logo.naturalHeight, sx = sw * 0.08, sy = sh * 0.14, cw = sw * 0.34, chh = sh * 0.72;
      var dw = Math.round(W * 0.36), dh = Math.round(dw * chh / cw);
      logoCanvas = document.createElement('canvas'); logoCanvas.width = dw; logoCanvas.height = dh;
      logoCanvas.getContext('2d').drawImage(logo, sx, sy, cw, chh, 0, 0, dw, dh);
    }
    function logoAt(ctx, fill) {
      if (!logoCanvas) return;
      var t = document.createElement('canvas'); t.width = logoCanvas.width; t.height = logoCanvas.height;
      var c = t.getContext('2d'); c.drawImage(logoCanvas, 0, 0); c.globalCompositeOperation = 'source-in';
      c.fillStyle = typeof fill === 'function' ? fill(c, t.width, t.height) : fill; c.fillRect(0, 0, t.width, t.height);
      ctx.drawImage(t, (W - t.width) / 2 - W * 0.02, (H - t.height) / 2 + H * 0.03);
    }
    function make(draw, color) {
      var tex = canvasTex(W, H, draw);
      if (!color) tex.colorSpace = THREE.NoColorSpace;
      if (mirror) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; }
      return tex;
    }
    var map = make(function (ctx) {
      var g = ctx.createRadialGradient(W * 0.42, H * 0.36, 40, W * 0.5, H * 0.5, W * 0.75);
      g.addColorStop(0, '#15130f'); g.addColorStop(0.6, '#0a0908'); g.addColorStop(1, '#040404');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      flakes.forEach(function (f) {
        ctx.fillStyle = 'hsla(' + f.hue + ',' + (55 + f.tilt * 25) + '%,' + f.lum + '%,' + f.a + ')'; poly(ctx, f);
      });
      logoAt(ctx, function (c, w, h) { var lg = c.createLinearGradient(0, 0, w, h); lg.addColorStop(0, '#f6e2b0'); lg.addColorStop(0.45, '#c9994c'); lg.addColorStop(1, '#efd08c'); return lg; });
    }, true);
    var metal = make(function (ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      flakes.forEach(function (f) { var v = Math.round(160 + f.tilt * 95); ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + Math.min(1, f.a + 0.2) + ')'; poly(ctx, f); });
      logoAt(ctx, '#fff');
    });
    var rough = make(function (ctx) {
      ctx.fillStyle = '#2a2a2a'; ctx.fillRect(0, 0, W, H);
      flakes.forEach(function (f) { var v = Math.round(50 + f.tilt * 90); ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; poly(ctx, f); });
      logoAt(ctx, '#4a4a4a');
    });
    var bump = make(function (ctx) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      flakes.forEach(function (f) { var v = Math.round(40 + f.tilt * 120); ctx.fillStyle = 'rgb(' + v + ',' + v + ',' + v + ')'; poly(ctx, f); });
      logoAt(ctx, '#9a9a9a');
    });
    return { map: map, metalnessMap: metal, roughnessMap: rough, bumpMap: bump };
  }

  function labelTexture(text, color) {
    return canvasTex(256, 64, function (ctx, w, h) {
      ctx.fillStyle = color; ctx.font = '600 30px Montserrat, Arial, sans-serif';
      ctx.textBaseline = 'middle'; ctx.fillText(text, 14, h / 2);
    });
  }

  function roundedBox(w, h, d, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    var g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    g.translate(0, 0, -d / 2);
    return g;
  }

  // Drivers em escala real (1 mm = 0,1 unidade da cena).
  // Cada driver tem os próprios materiais para o destaque (setDim) não vazar entre grupos.
  function nickelMat() { return new THREE.MeshPhysicalMaterial({ color: 0xc8cbcf, metalness: 0.92, roughness: 0.27, clearcoat: 0.25, clearcoatRoughness: 0.2 }); }
  function addSpout(g, mat, x, y, z, len) {
    var sp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 28), mat);
    sp.rotation.z = Math.PI / 2; sp.position.set(x + len / 2, y, z); g.add(sp);
    var hole = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
    hole.rotation.y = Math.PI / 2; hole.position.set(x + len + 0.001, y, z); g.add(hole);
    g.userData.spoutTip = new THREE.Vector3(x + len, y, z);
  }
  function addPads(g, x, H, D, color) {
    var padMat = new THREE.MeshStandardMaterial({ color: 0xd39a52, emissive: color, emissiveIntensity: 0.2, metalness: 0.9, roughness: 0.3 });
    [[-0.22, -0.2], [-0.22, 0.2], [0.22, -0.2], [0.22, 0.2]].forEach(function (o) {
      var pad = new THREE.Mesh(new THREE.BoxGeometry(0.012, H * 0.16, D * 0.22), padMat);
      pad.position.set(x - 0.006, o[0] * H, o[1] * D); g.add(pad);
    });
    g.userData.glow = [padMat];
  }

  // médios: duas unidades em paralelo com a canaleta no meio e bocal redondo
  function midDriver(color) {
    var g = new THREE.Group(), m = nickelMat();
    var L = 0.525, H = 0.526, D = 0.305, half = (D - 0.024) / 2;
    [-1, 1].forEach(function (s) { var b = new THREE.Mesh(roundedBox(L, H, half, 0.063), m); b.position.z = s * (half / 2 + 0.012); g.add(b); });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, H * 0.86, 0.03), m));
    addSpout(g, m, L / 2, -0.01, 0, 0.16);
    addPads(g, -L / 2, H, D, color);
    g.userData.size = [L, H, D];
    return g;
  }

  // graves: duplo em tandem (7,87 x 5,60 x 4,09 mm), emenda entre os dois motores, respiro traseiro e bocal redondo
  function bassDriver(color) {
    var g = new THREE.Group(), m = nickelMat();
    var L = 0.787, H = 0.56, D = 0.409;
    g.add(new THREE.Mesh(roundedBox(L, H, D, 0.06), m));
    var seam = new THREE.Mesh(new THREE.BoxGeometry(L + 0.006, 0.012, D + 0.006), new THREE.MeshStandardMaterial({ color: 0x5b5e63, metalness: 0.8, roughness: 0.4 }));
    g.add(seam);
    var vent = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshBasicMaterial({ color: 0x0c0c0c }));
    vent.rotation.x = -Math.PI / 2; vent.position.set(-L * 0.28, H / 2 + 0.003, 0); g.add(vent);
    addSpout(g, m, L / 2, 0.08, 0, 0.16);
    addPads(g, -L / 2, H, D, color);
    g.userData.size = [L, H, D];
    return g;
  }

  // tweeter eletrostático em aço inox: par de cartuchos com a faixa
  // vermelha entre eles, flex verde com 3 contatos em cima e bocal Ø 1,40 mm na frente
  function estTweeter(color) {
    var g = new THREE.Group();
    var steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dbde, metalness: 0.95, roughness: 0.18, clearcoat: 0.3 });
    var L = 0.355, H = 0.254, D = 0.28;
    g.add(new THREE.Mesh(roundedBox(L, H, D, 0.028), steel));
    var band = new THREE.Mesh(new THREE.BoxGeometry(L + 0.012, 0.026, D + 0.012), new THREE.MeshStandardMaterial({ color: 0xb02a2a, roughness: 0.45 }));
    g.add(band);
    var flex = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.2), new THREE.MeshStandardMaterial({ color: 0x1f7a45, roughness: 0.45 }));
    flex.position.set(-0.07, H / 2 + 0.01, 0); g.add(flex);
    var padMat = new THREE.MeshStandardMaterial({ color: 0xe0b45e, emissive: color, emissiveIntensity: 0.25, metalness: 1, roughness: 0.25 });
    for (var i = 0; i < 3; i++) { var p = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.008, 0.045), padMat); p.position.set(-0.12, H / 2 + 0.019, (i - 1) * 0.055); g.add(p); }
    addSpout(g, steel, L / 2, 0, 0, 0.122);
    g.userData.glow = [padMat];
    g.userData.size = [L, H, D];
    return g;
  }

  // transformador dos eletrostáticos: corpo translúcido com as duas bobinas e o circuito verde dentro
  function estTransformer() {
    var g = new THREE.Group();
    var L = 1.095, H = 0.5, D = 0.37;
    var clear = new THREE.MeshPhysicalMaterial({ color: 0xe9eef0, transmission: 0.6, roughness: 0.25, thickness: 0.2, transparent: true, opacity: 0.6, depthWrite: false });
    var box = new THREE.Mesh(roundedBox(L, H, D, 0.03), clear); box.renderOrder = 3; g.add(box);
    var pcbm = new THREE.MeshStandardMaterial({ color: 0x1f7a45, roughness: 0.5 });
    var strip = new THREE.Mesh(new THREE.BoxGeometry(L * 0.9, 0.02, D * 0.8), pcbm); strip.position.y = H * 0.28; g.add(strip);
    var coil = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, metalness: 0.6, roughness: 0.4 });
    [-0.24, 0.24].forEach(function (x) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.26), coil); c.position.set(x, -0.04, 0); g.add(c);
      var cu = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.3, 24), new THREE.MeshStandardMaterial({ color: COLORS.copper, metalness: 1, roughness: 0.35 }));
      cu.rotation.z = Math.PI / 2; cu.position.set(x, -0.04, 0); g.add(cu);
    });
    g.userData.size = [L, H, D];
    return g;
  }

  // par trançado (fios vermelho e verde do transformador até cada tweeter)
  function twisted(points, colors, radius, turns) {
    var g = new THREE.Group();
    var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]); }));
    var N = 90, fr = curve.computeFrenetFrames(N, false);
    colors.forEach(function (col, s) {
      var pts = [];
      for (var i = 0; i <= N; i++) {
        var u = i / N, c = curve.getPointAt(u), a = u * turns * Math.PI * 2 + s * Math.PI * 2 / colors.length;
        pts.push(c.clone().addScaledVector(fr.normals[i], Math.cos(a) * radius * 1.1).addScaledVector(fr.binormals[i], Math.sin(a) * radius * 1.1));
      }
      var mat = col.isMaterial ? col : new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.2 });
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N * 2, radius, 6, false), mat));
    });
    return g;
  }

  function tube(points, radius, mat) {
    var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 64, radius, 12, false), mat);
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* Monta um fone. opts: { logo: HTMLImageElement, cable: bool, shellTint: hex, shellOpacity } */
  function buildIEM(opts) {
    opts = opts || {};
    var root = new THREE.Group();
    var parts = { est: [], mid: [], bass: [] };
    var groups = {};

    // casco translúcido fumê
    var shellMat = new THREE.MeshPhysicalMaterial({
      color: opts.shellTint || 0xdfe7ee, metalness: 0, roughness: 0.06, transmission: 0.95, thickness: 0.6,
      ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: opts.shellOpacity || 0.55,
      side: THREE.DoubleSide, depthWrite: false
    });
    var SH = opts.shell || null;
    if (SH) { shellMat.side = THREE.FrontSide; shellMat.thickness = 0.3; }
    // modo foto: acrílico cristal de verdade (refração e espessura), sem a transparência simulada
    if (opts.pro) {
      shellMat.transparent = false; shellMat.opacity = 1; shellMat.depthWrite = true;
      shellMat.transmission = 1; shellMat.thickness = 0.45; shellMat.roughness = 0.025; shellMat.ior = 1.49;
      shellMat.color.setHex(0xffffff); shellMat.attenuationColor = new THREE.Color(0xd6e4ec); shellMat.attenuationDistance = 2.2;
      shellMat.clearcoat = 1; shellMat.clearcoatRoughness = 0.02; shellMat.specularIntensity = 1; shellMat.envMapIntensity = 1.4;
    }
    var proFace = !!opts.pro;
    var shell = new THREE.Mesh(SH ? SH.geo : shellGeometry(), shellMat);
    shell.renderOrder = 2;
    groups.shell = new THREE.Group(); groups.shell.add(shell);
    var CD = SH ? SH.dir.clone() : CANAL_DIR.clone();

    // ponta da cânula: tampa, três furos de saída e o anel vermelho do lado direito
    var nozzleDir = CD.clone();
    var endFrame = { r: TIP_R };
    var tip = SH ? SH.tip.clone() : canalEnd();
    var nozzleBase = SH ? SH.base.clone() : BODY_END.clone();
    if (!SH) {
    var tipCap = new THREE.Mesh(new THREE.CircleGeometry(endFrame.r * 1.0, 48), shellMat);
    tipCap.position.copy(tip); tipCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), nozzleDir);
    groups.shell.add(tipCap);
    var sideMat = new THREE.MeshStandardMaterial({ color: opts.mirror ? 0x2d6bd6 : 0xd62d2d, roughness: 0.4, transparent: true, opacity: 0.9 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(CANAL_R * 1.02, 0.012, 8, 48), sideMat);
    ring.position.copy(tip).addScaledVector(nozzleDir, -0.36); ring.quaternion.copy(tipCap.quaternion);
    groups.shell.add(ring);
    var boreMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 });
    [[-0.055, 0.03], [0.055, 0.03], [0, -0.06]].forEach(function (o) {
      var bore = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), boreMat);
      var side = new THREE.Vector3(1, 0, 0).applyQuaternion(tipCap.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(tipCap.quaternion);
      bore.position.copy(tip).addScaledVector(side, o[0]).addScaledVector(up, o[1]).addScaledVector(nozzleDir, 0.002);
      bore.quaternion.copy(tipCap.quaternion);
      groups.shell.add(bore);
    });
    }
    root.add(groups.shell);

    // faceplate
    var fm = faceplateMaps(opts.logo, opts.mirror);
    var faceMat = new THREE.MeshPhysicalMaterial({ map: fm.map, metalnessMap: fm.metalnessMap, roughnessMap: fm.roughnessMap, bumpMap: fm.bumpMap, bumpScale: 0.6,
      metalness: 1, roughness: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.2 });
    // foto: laca mais espelhada (o fundo preto fica profundo e o brilho vem só do verniz)
    if (proFace) { faceMat.roughness = 0.55; faceMat.clearcoatRoughness = 0.008; faceMat.envMapIntensity = 1.0; faceMat.bumpScale = 0.35; }
    var face = new THREE.Mesh(faceplateGeometry(SH && SH.outline), faceMat);
    face.position.z = TOP - 0.035;
    groups.face = new THREE.Group(); groups.face.add(face);

    // soquete 2 pinos na borda de cima e o conector do cabo balanceado (alumínio grafite, pinos dourados)
    var SOCK = new THREE.Vector3(0.6, 0.5, 0.3);
    if (SH) {
      // conector na lateral de fora, no alto: ponto do contorno mais para cima e para fora, um pouco abaixo da borda
      var best = null, bs = -1e9;
      // conector na lateral de fora, no terço de cima (como nos fones da loja), embutido na parede do casco abaixo do faceplate
      SH.outline.forEach(function (p) { var sc = p[0] * 0.94 + p[1] * 0.34; if (sc > bs) { bs = sc; best = p; } });
      var bl = Math.hypot(best[0], best[1]);
      SOCK.set(best[0] * (1 - 0.1 / bl), best[1] * (1 - 0.1 / bl), TOP - 0.3);
    }
    var sock = new THREE.Mesh(roundedBox(0.12, 0.24, 0.16, 0.035), new THREE.MeshPhysicalMaterial({ color: 0xdfe4ea, transmission: 0.7, roughness: 0.15, thickness: 0.1, transparent: true, opacity: 0.8 }));
    sock.position.copy(SOCK); groups.face.add(sock);
    var cDir = new THREE.Vector3(1, 0.06, -0.12).normalize(), cQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), cDir);
    var goldMat = new THREE.MeshStandardMaterial({ color: 0xe3bd6a, metalness: 1, roughness: 0.18 });
    for (var pi = 0; pi < 2; pi++) {
      var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 10), goldMat);
      pin.position.copy(SOCK).add(new THREE.Vector3(0, pi ? 0.04 : -0.04, 0)).addScaledVector(cDir, 0.1); pin.quaternion.copy(cQ); groups.face.add(pin);
    }
    var gun = new THREE.MeshPhysicalMaterial({ color: 0x4b4e53, metalness: 0.88, roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.25 });
    var CON_LEN = 0.44, conStart = SOCK.clone().addScaledVector(cDir, 0.14);
    var con = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, CON_LEN, 36), gun);
    con.position.copy(conStart).addScaledVector(cDir, CON_LEN / 2); con.quaternion.copy(cQ); groups.face.add(con);
    var marker = new THREE.Mesh(new THREE.TorusGeometry(0.084, 0.008, 8, 36), new THREE.MeshStandardMaterial({ color: opts.mirror ? 0x2d6bd6 : 0xd62d2d, roughness: 0.4 }));
    marker.position.copy(conStart).addScaledVector(cDir, 0.05); marker.quaternion.copy(cQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); groups.face.add(marker);
    var conEnd = conStart.clone().addScaledVector(cDir, CON_LEN);

    // cabo balanceado: 8 núcleos prateados trançados, saindo do conector e fazendo o gancho por cima da orelha
    if (opts.cable) {
      var O = conEnd;
      // sai para o lado de fora, sobe e passa por trás, como o gancho de orelha nas fotos reais
      var path = [O, O.clone().addScaledVector(cDir, 0.25), new THREE.Vector3(O.x + 0.48, O.y + 0.16, O.z - 0.12), new THREE.Vector3(O.x + 0.62, O.y + 0.6, O.z - 0.32),
                  new THREE.Vector3(O.x + 0.52, O.y + 1.2, O.z - 0.8), new THREE.Vector3(O.x + 0.28, O.y + 1.9, O.z - 1.6), new THREE.Vector3(O.x + 0.02, O.y + 2.8, O.z - 2.8),
                  new THREE.Vector3(O.x - 0.2, O.y + 3.8, O.z - 3.9)];
      // foto de catálogo: o cabo sai de lado e sobe em curva para fora do quadro
      if (opts.pro) path = [O, O.clone().addScaledVector(cDir, 0.35), new THREE.Vector3(O.x + 0.95, O.y + 0.1, O.z - 0.12), new THREE.Vector3(O.x + 1.6, O.y + 0.32, O.z - 0.24),
                  new THREE.Vector3(O.x + 2.15, O.y + 0.8, O.z - 0.36), new THREE.Vector3(O.x + 2.5, O.y + 1.6, O.z - 0.48), new THREE.Vector3(O.x + 2.7, O.y + 2.8, O.z - 0.6)];
      var silver = new THREE.MeshPhysicalMaterial({ color: 0xb9bdc3, metalness: 0.9, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      var dark = new THREE.MeshPhysicalMaterial({ color: 0x3c3f44, metalness: 0.75, roughness: 0.36, clearcoat: 0.6, clearcoatRoughness: 0.2 });
      var strands = opts.lite ? [silver, dark, silver, dark] : [silver, dark, silver, dark, silver, dark, silver, dark];
      var braid = twisted(path, strands, opts.lite ? 0.026 : opts.pro ? 0.034 : 0.019, opts.pro ? 70 : 40);
      groups.face.add(braid);
    }
    root.add(groups.face);

    // crossover de 3 vias: placa verde pequena logo abaixo do faceplate
    var pcb = new THREE.Group();
    var board = new THREE.Mesh(roundedBox(0.4, 0.24, 0.02, 0.03), new THREE.MeshStandardMaterial({ color: 0x1f6b40, roughness: 0.5, metalness: 0.15 }));
    pcb.add(board);
    var compMat = [
      new THREE.MeshStandardMaterial({ color: 0xc9a26a, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.3, metalness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.8, roughness: 0.3 })
    ];
    [[-0.12, 0.05, 0.06, 0.035, 0], [-0.03, 0.06, 0.04, 0.04, 1], [0.07, 0.05, 0.07, 0.03, 0], [0.14, -0.05, 0.04, 0.04, 2], [-0.1, -0.06, 0.05, 0.04, 1], [0.02, -0.06, 0.08, 0.03, 0]].forEach(function (c) {
      var mm = new THREE.Mesh(new THREE.BoxGeometry(c[2], c[3], 0.03), compMat[c[4]]); mm.position.set(c[0], c[1], 0.025); pcb.add(mm);
    });
    var traceMat = new THREE.MeshStandardMaterial({ color: COLORS.copper, metalness: 1, roughness: 0.3, emissive: COLORS.copper, emissiveIntensity: 0.15 });
    for (var tr = 0; tr < 3; tr++) { var t1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.006, 0.004), traceMat); t1.position.set(0, -0.08 + tr * 0.08, 0.012); pcb.add(t1); }
    // posições dentro do casco: as do molde real (SH) ou as do casco desenhado
    var base0 = nozzleBase.clone();
    function nearBase(back, dx, dy, dz) { return base0.clone().addScaledVector(CD, -back).add(new THREE.Vector3(dx, dy, dz)).toArray(); }
    var POS = SH ? { pcb: [0.3, 0.72, 0.24], bass: [-0.32, -0.55, -0.55], mid: [0.25, 0.5, -0.45], t1: nearBase(0.42, -0.14, -0.06, 0), t2: nearBase(0.38, 0.12, 0.14, 0), xf: [-0.48, 0.05, 0.1] }
                 : { pcb: [0.14, 0.46, 0.22], bass: [-0.16, -0.3, -0.3], mid: [0.04, 0.36, -0.2], t1: [0.3, -0.16, -0.3], t2: [0.4, 0.02, -0.4], xf: [-0.3, 0.06, 0.1] };
    pcb.position.fromArray(POS.pcb); pcb.rotation.set(0.05, -0.1, 0.1);
    pcb.userData.glow = [traceMat];
    groups.pcb = pcb; root.add(pcb);

    var canalQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), CD);
    function place(d, pos, q) { d.position.set(pos[0], pos[1], pos[2]); d.quaternion.copy(q); d.updateMatrix(); return d; }
    function tipOf(d) { return d.userData.spoutTip.clone().applyMatrix4(d.matrix); }

    // graves
    groups.bass = new THREE.Group();
    var bd = place(bassDriver(COLORS.bass), POS.bass, canalQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, -0.35, 0.25))));
    groups.bass.add(bd); parts.bass.push(bd); root.add(groups.bass);

    // médios
    groups.mid = new THREE.Group();
    var md = place(midDriver(COLORS.mid), POS.mid, canalQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, -0.3, 0.55))));
    groups.mid.add(md); parts.mid.push(md); root.add(groups.mid);

    // eletrostáticos: dois tweeters (4 unidades) junto da cânula + transformador sob o faceplate
    groups.est = new THREE.Group();
    var t1d = place(estTweeter(COLORS.est), POS.t1, canalQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.2, 0.15, 0.05))));
    var t2d = place(estTweeter(COLORS.est), POS.t2, canalQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0.05, -0.05))));
    var xf = place(estTransformer(), POS.xf, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0.05, Math.PI / 2 - 0.12)));
    [t1d, t2d].forEach(function (t) { groups.est.add(t); parts.est.push(t); });
    groups.est.add(xf);
    var xfOut = new THREE.Vector3(-0.55, 0, 0).applyMatrix4(xf.matrix);
    [t1d, t2d].forEach(function (t, i) {
      var top = new THREE.Vector3(-0.12, 0.14, 0).applyMatrix4(t.matrix);
      groups.est.add(twisted([xfOut.clone().add(new THREE.Vector3(i * 0.05, 0, 0)), new THREE.Vector3(-0.15 + i * 0.05, -0.42, -0.02), new THREE.Vector3(0.1, -0.3 + i * 0.08, -0.2), top], [0xb3262a, 0x1f8a4c], 0.0055, 9));
    });
    root.add(groups.est);

    // tubos de som de cada driver até a cânula
    var tubeMats = {};
    groups.tubes = new THREE.Group();
    [['bass', bd, -0.04], ['mid', md, 0.0], ['est', t1d, 0.04], ['est', t2d, 0.02]].forEach(function (t) {
      var mat = tubeMats[t[0]] || (tubeMats[t[0]] = new THREE.MeshPhysicalMaterial({ color: 0xeef3f8, transmission: 0.85, roughness: 0.12, thickness: 0.05, transparent: true, opacity: 0.75, emissive: COLORS[t[0]], emissiveIntensity: 0.08 }));
      var a = tipOf(t[1]), off = t[2];
      var end = tip.clone().addScaledVector(nozzleDir, -0.03);
      var base = nozzleBase.clone();
      groups.tubes.add(tube([[a.x, a.y, a.z], [a.x + CD.x * 0.08, a.y + CD.y * 0.08, a.z + CD.z * 0.08], [base.x + off, base.y + off * 0.6, base.z], [end.x + off * 0.6, end.y + off * 0.4, end.z]], 0.02, mat));
    });
    root.add(groups.tubes);

    // fiação de cobre: soquete -> crossover -> cada via
    var wireMat = new THREE.MeshStandardMaterial({ color: COLORS.copper, metalness: 1, roughness: 0.35, transparent: true, opacity: 1 });
    groups.wires = new THREE.Group();
    groups.wires.add(tube([[SOCK.x - 0.06, SOCK.y, SOCK.z - 0.04], [0.4, 0.42, 0.3], [0.16, 0.5, 0.22]], 0.007, wireMat));
    [new THREE.Vector3(-0.55, 0, 0).applyMatrix4(xf.matrix).add(new THREE.Vector3(0, 1.1, 0)), new THREE.Vector3(-0.26, 0, 0).applyMatrix4(md.matrix), new THREE.Vector3(-0.39, 0, 0).applyMatrix4(bd.matrix)].forEach(function (p, i) {
      var q = i === 0 ? new THREE.Vector3(-0.3, 0.6, 0.1) : p;
      groups.wires.add(tube([[0.06, 0.42, 0.2], [(q.x + 0.06) / 2, (q.y + 0.42) / 2, Math.max(q.z, 0.05)], [q.x, q.y, q.z]], 0.0055, wireMat));
    });
    root.add(groups.wires);

    var all = ['shell', 'face', 'pcb', 'bass', 'mid', 'est', 'tubes', 'wires'];
    all.forEach(function (k) { groups[k].userData.home = groups[k].position.clone(); });

    // posições explodidas (deslocamento a partir da posição montada)
    var explodeOffset = {
      shell: new THREE.Vector3(0.35, -0.25, -1.0),
      face: new THREE.Vector3(-1.3, 0.8, -0.25),
      pcb: new THREE.Vector3(-0.2, 0.75, 0.55),
      bass: new THREE.Vector3(-0.9, -0.7, 0.1),
      mid: new THREE.Vector3(0.45, 0.95, 0.15),
      est: new THREE.Vector3(1.0, -0.35, 0.4),
      tubes: new THREE.Vector3(0, 0, 0),
      wires: new THREE.Vector3(0, 0, 0)
    };

    var state = { explode: 0, focus: null, time: 0, energy: { est: 0, mid: 0, bass: 0 } };

    function setDim(group, dim) {
      group.traverse(function (o) {
        if (!o.isMesh) return;
        var m = o.material;
        if (m.userData.baseOpacity === undefined) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; }
        var target = m.userData.baseOpacity * (1 - 0.72 * dim);
        var tr = m.userData.baseTransparent || target < 0.999;
        if (tr !== m.transparent) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = target;
        m.depthWrite = target > 0.6;
      });
    }

    var api = {
      root: root, groups: groups, parts: parts, colors: COLORS, tip: tip,
      // e: 0 montado, 1 explodido
      setExplode: function (e) {
        state.explode = e;
        var k = ease(Math.min(Math.max(e, 0), 1));
        all.forEach(function (name) {
          groups[name].position.copy(groups[name].userData.home).addScaledVector(explodeOffset[name], k);
        });
        shellMat.opacity = lerp(opts.lite ? 0.24 : (opts.shellOpacity || 0.55), opts.lite ? 0.07 : 0.12, k);
        groups.tubes.visible = k < 0.35; groups.wires.visible = k < 0.35;
        groups.tubes.children.forEach(function (t) { t.material.opacity = 0.75 * (1 - k / 0.35); });
      },
      // destaca um grupo: 'est' | 'mid' | 'bass' | 'pcb' | null
      setFocus: function (key) {
        state.focus = key;
        ['est', 'mid', 'bass', 'pcb'].forEach(function (k) { setDim(groups[k], key && key !== k ? 1 : 0); });
        setDim(groups.face, key ? 1.15 : 0);
      },
      // energia 0..1 por via (varredura de frequência), acende o driver e vibra a película
      setEnergy: function (en) { state.energy = en; },
      update: function (dt) {
        state.time += dt;
        var t = state.time;
        ['est', 'mid', 'bass'].forEach(function (k) {
          var focusBoost = state.focus === k ? 0.9 : 0;
          var e = Math.max(state.energy[k] || 0, focusBoost);
          parts[k].forEach(function (d) {
            (d.userData.glow || []).forEach(function (m) { m.emissiveIntensity = 0.2 + e * 1.6; });
          });
        });
        // película: ondulação senoidal discreta, mais forte com energia
        var amp = 0.004 + (state.energy.est || 0) * 0.012 + (state.focus === 'est' ? 0.006 : 0);
        if (!(opts.lite && state.explode < 0.05 && !state.energy.est)) parts.est.forEach(function (d) {
          (d.userData.films || []).forEach(function (f, i) {
            var pa = f.geometry.attributes.position;
            for (var v = 0; v < pa.count; v++) {
              var x = pa.getX(v), y = pa.getY(v);
              var edge = Math.cos(x / 0.085 * Math.PI / 2) * Math.cos(y / 0.058 * Math.PI / 2);
              pa.setZ(v, Math.sin(t * 9 + i) * amp * 0.6 * Math.max(edge, 0));
            }
            pa.needsUpdate = true;
          });
        });
        (groups.pcb.userData.glow || []).forEach(function (m) { m.emissiveIntensity = 0.15 + (state.focus === 'pcb' ? 1.2 : 0); });
      },
      // pontos de ancoragem das legendas (coordenadas locais do root)
      anchors: function () {
        var c = function (g) { var b = new THREE.Box3().setFromObject(g); return b.getCenter(new THREE.Vector3()); };
        return { est: c(groups.est), mid: c(groups.mid), bass: c(groups.bass), pcb: c(groups.pcb) };
      }
    };
    // modo leve (página ao vivo): sem transmission, que obriga o three a renderizar a cena duas vezes por quadro
    if (opts.lite) {
      root.traverse(function (o) {
        if (!o.isMesh || !o.material || !o.material.transmission) return;
        var m = o.material;
        m.transmission = 0; m.transparent = true;
        if (m === shellMat) { m.color.setHex(0xb4c2cc); m.opacity = 0.24; m.roughness = 0.04; m.envMapIntensity = 1.6; } else { m.opacity = Math.min(m.opacity, 0.5); }
        m.needsUpdate = true;
      });
    }
    // centro de cada grupo medido uma vez, relativo à posição do grupo (as legendas usam isso a cada quadro)
    var anchorOff = {};
    ['est', 'mid', 'bass', 'pcb'].forEach(function (k) {
      groups[k].updateMatrixWorld(true);
      var c = new THREE.Box3().setFromObject(groups[k]).getCenter(new THREE.Vector3());
      root.updateMatrixWorld(true);
      root.worldToLocal(c);
      anchorOff[k] = c.sub(groups[k].position);
    });
    var anchorOut = { est: new THREE.Vector3(), mid: new THREE.Vector3(), bass: new THREE.Vector3(), pcb: new THREE.Vector3() };
    api.anchors = function () {
      for (var k in anchorOut) anchorOut[k].copy(groups[k].position).add(anchorOff[k]);
      return anchorOut;
    };
    api.setExplode(0);
    return api;
  }

  // Ambiente de estúdio para reflexos (caixa escura com softboxes)
  function studioEnvironment(renderer, bright) {
    var pm = new THREE.PMREMGenerator(renderer);
    var env = new THREE.Scene();
    var base = bright ? 0x9a9a98 : 0x111215;
    env.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: base, side: THREE.BackSide })));
    var soft = function (w, h, x, y, z, c, ry, rx) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.rotation.y = ry || 0; m.rotation.x = rx || 0; env.add(m);
    };
    soft(8, 3, 0, 7, 0, 0xffffff, 0, Math.PI / 2);
    soft(3, 6, -8, 1, 2, bright ? 0xffffff : 0xfff1dc, Math.PI / 2);
    soft(3, 6, 8, 0, -2, bright ? 0xf2f6ff : 0xc9dbff, -Math.PI / 2);
    soft(6, 2, 0, -1, 9, 0xffffff, 0);
    var rt = pm.fromScene(env, 0.03);
    pm.dispose();
    return rt.texture;
  }

  // carrega o casco moldado real (assets/shell/shell-R.bin / shell-L.bin + shell-meta.json)
  var metaP = null;
  function loadShell(side, base) {
    base = base || 'assets/shell/';
    metaP = metaP || fetch(base + 'shell-meta.json').then(function (r) { return r.json(); });
    return Promise.all([fetch(base + 'shell-' + side + '.bin').then(function (r) { if (!r.ok) throw new Error('shell'); return r.arrayBuffer(); }), metaP]).then(function (res) {
      var buf = res[0], meta = res[1][side];
      var h = new Uint32Array(buf, 0, 2), nv = h[0], nt = h[1];
      var pos = new Float32Array(buf, 8, nv * 3), idx = new Uint16Array(buf.slice(8 + nv * 12, 8 + nv * 12 + nt * 6));
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals(); geo.computeBoundingBox();
      // ponta, entrada e eixo da cânula vêm do pré-processamento do molde
      return { geo: geo, outline: meta.outline, tip: new THREE.Vector3().fromArray(meta.tip), dir: new THREE.Vector3().fromArray(meta.dir).normalize(), base: new THREE.Vector3().fromArray(meta.base) };
    });
  }

  global.XEModel = { loadShell: loadShell, buildIEM: buildIEM, studioEnvironment: studioEnvironment, ease: ease, COLORS: COLORS };
})(window);
