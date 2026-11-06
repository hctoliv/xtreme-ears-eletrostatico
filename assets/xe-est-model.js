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

  // Contorno do faceplate, tirado das fotos dos moldados Xtreme Ears: borda reta do lado do cabo (+x),
  // topo e costas arredondados, base afinando numa ponta do lado da borda reta.
  var OUTLINE_PTS = [[0.5, 0.64], [0.18, 0.8], [-0.22, 0.76], [-0.52, 0.5], [-0.62, 0.1], [-0.52, -0.28], [-0.27, -0.54],
                     [0.03, -0.72], [0.3, -0.82], [0.48, -0.7], [0.56, -0.38], [0.58, 0.05], [0.57, 0.42]];
  var outlineCache = null;
  function outlinePoints(n) {
    if (outlineCache && outlineCache.length === n) return outlineCache;
    var curve = new THREE.CatmullRomCurve3(OUTLINE_PTS.map(function (p) { return new THREE.Vector3(p[0] * 1.2, p[1] * 1.2, 0); }), true, 'centripetal');
    outlineCache = curve.getSpacedPoints(n).slice(0, n);
    return outlineCache;
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
  var CANAL_DIR = new THREE.Vector3(0.55, -0.22, -0.8).normalize();
  var BODY_DEPTH = 1.02;
  var BODY_END = new THREE.Vector3(0.34, -0.36, TOP - BODY_DEPTH);
  var CANAL_LEN = 0.46;
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
        // quase cheio no primeiro terço, depois afina até a boca da cânula
        sc = (1 + 0.1 * Math.sin(Math.min(v / 0.45, 1) * Math.PI)) * (1 - 0.7 * smooth(0.3, 1, v));
        m = smooth(0.55, 1, v); r = 0.3;
      } else {
        var w = (u - split) / (1 - split);
        var c = BODY_END.clone().addScaledVector(CANAL_DIR, CANAL_LEN * w);
        cx = c.x; cy = c.y; cz = c.z; sc = 1; m = 1;
        r = 0.3 - 0.06 * w;
        if (w > 0.9) r *= Math.sqrt(Math.max(1 - Math.pow((w - 0.9) / 0.1, 2), 0.0004)) * 0.4 + 0.6 * (1 - (w - 0.9) / 0.1) + 0.0;
      }
      var vv = Math.min(u / split, 1);
      var bulge = Math.sin(Math.min(vv / 0.7, 1) * Math.PI) * (1 - m);
      for (var j = 0; j < SEG; j++) {
        var a = (j / SEG) * Math.PI * 2;
        var px = ol[j].x, py = ol[j].y;
        var len = Math.hypot(px, py) || 1, dx = px / len, dy = py / len;
        var e = 1 + bulge * (0.3 * Math.pow(Math.max(0, dx * bowl.x + dy * bowl.y), 1.4) + 0.26 * Math.pow(Math.max(0, dx * helix.x + dy * helix.y), 2.5));
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

  function faceplateGeometry() {
    var ol = outlinePoints(120), shape = new THREE.Shape();
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

  // Faceplate preto com flocos dourados e o X da marca
  function faceplateTexture(logo, mirror) {
    var tex = canvasTex(1024, 1300, function (ctx, w, h) {
      var g = ctx.createRadialGradient(w * 0.45, h * 0.4, 20, w * 0.5, h * 0.5, w * 0.7);
      g.addColorStop(0, '#1b1a17'); g.addColorStop(1, '#050505');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 3400; i++) {
        var x = Math.random() * w, y = Math.random() * h, s = Math.random() * 3.2 + 0.4;
        var l = 45 + Math.random() * 35;
        ctx.fillStyle = 'hsla(' + (38 + Math.random() * 10) + ',70%,' + l + '%,' + (0.25 + Math.random() * 0.6) + ')';
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * 3); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore();
      }
      if (logo && logo.complete && logo.naturalWidth) {
        // recorta só o X do logo oficial e pinta de champanhe
        var sw = logo.naturalWidth, sh = logo.naturalHeight;
        var sx = sw * 0.08, sy = sh * 0.14, cw = sw * 0.34, chh = sh * 0.72;
        var dw = w * 0.4, dh = dw * chh / cw;
        var tmp = document.createElement('canvas'); tmp.width = dw; tmp.height = dh;
        var t = tmp.getContext('2d');
        t.drawImage(logo, sx, sy, cw, chh, 0, 0, dw, dh);
        t.globalCompositeOperation = 'source-in';
        var lg = t.createLinearGradient(0, 0, dw, dh);
        lg.addColorStop(0, '#f3dca2'); lg.addColorStop(0.5, '#c99a4a'); lg.addColorStop(1, '#f0d48f');
        t.fillStyle = lg; t.fillRect(0, 0, dw, dh);
        ctx.drawImage(tmp, (w - dw) / 2 - w * 0.03, (h - dh) / 2 + h * 0.02);
      }
    });
    if (mirror) { tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1; }
    return tex;
  }

  // Estator perfurado: grade de furos sobre película dourada
  function statorTexture() {
    return canvasTex(256, 170, function (ctx, w, h) {
      ctx.fillStyle = '#2a2622'; ctx.fillRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#f1d391'); g.addColorStop(0.5, '#b8873f'); g.addColorStop(1, '#ecc77a');
      ctx.fillStyle = g; ctx.fillRect(10, 10, w - 20, h - 20);
      ctx.fillStyle = '#17130f';
      for (var y = 22; y < h - 14; y += 13) for (var x = 22 + ((y / 13) % 2) * 6; x < w - 14; x += 12) {
        ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      }
    });
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

  // Driver de armadura balanceada: cubo de alumínio claro com os contatos laranja na face traseira
  function baDriver(w, h, d, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(roundedBox(w, h, d, 0.012), new THREE.MeshPhysicalMaterial({ color: 0xc4c7cb, metalness: 0.75, roughness: 0.3, clearcoat: 0.3 }));
    g.add(body);
    var padMat = new THREE.MeshStandardMaterial({ color: 0xe8742a, emissive: color, emissiveIntensity: 0.2, metalness: 0.4, roughness: 0.35 });
    for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++) {
      var pad = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, h * 0.12, 0.01), padMat);
      pad.position.set((c - 0.5) * w * 0.44, (r - 0.5) * h * 0.46, -d / 2 - 0.006);
      g.add(pad);
    }
    var spout = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.08, 20), new THREE.MeshStandardMaterial({ color: 0x8a8d92, metalness: 1, roughness: 0.25 }));
    spout.rotation.z = Math.PI / 2; spout.position.set(w / 2 + 0.035, 0, 0);
    g.add(spout);
    g.userData.glow = [padMat];
    return g;
  }

  // Unidade eletrostática: dois estatores perfurados com a película no meio
  function estDriver(tex) {
    var g = new THREE.Group();
    var w = 0.3, h = 0.2;
    var statorMat = new THREE.MeshPhysicalMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.3, metalness: 0.25, roughness: 0.35, clearcoat: 0.8, side: THREE.DoubleSide });
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x24201b, metalness: 0.6, roughness: 0.4 });
    var filmMat = new THREE.MeshPhysicalMaterial({ color: COLORS.est, emissive: COLORS.est, emissiveIntensity: 0.35, metalness: 0.2, roughness: 0.15, transmission: 0.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    var frame = new THREE.Mesh(roundedBox(w + 0.03, h + 0.03, 0.05, 0.02), frameMat);
    g.add(frame);
    var front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), statorMat); front.position.z = 0.037; g.add(front);
    var back = front.clone(); back.position.z = -0.037; back.rotation.y = Math.PI; g.add(back);
    var film = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.9, 24, 16), filmMat);
    g.add(film);
    g.userData.film = film;
    g.userData.glow = [filmMat];
    g.userData.stator = statorMat;
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
    var shell = new THREE.Mesh(shellGeometry(), shellMat);
    shell.renderOrder = 2;
    groups.shell = new THREE.Group(); groups.shell.add(shell);

    // ponta da cânula: tampa, três furos de saída e o anel vermelho do lado direito
    var nozzleDir = CANAL_DIR.clone();
    var endFrame = { r: 0.24 };
    var tip = canalEnd();
    var nozzleBase = BODY_END.clone();
    var tipCap = new THREE.Mesh(new THREE.CircleGeometry(endFrame.r * 1.0, 48), shellMat);
    tipCap.position.copy(tip); tipCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), nozzleDir);
    groups.shell.add(tipCap);
    var sideMat = new THREE.MeshStandardMaterial({ color: opts.mirror ? 0x2d6bd6 : 0xd62d2d, roughness: 0.4, transparent: true, opacity: 0.9 });
    var ring = new THREE.Mesh(new THREE.TorusGeometry(endFrame.r * 0.72, 0.012, 8, 48), sideMat);
    ring.position.copy(tip).addScaledVector(nozzleDir, -0.12); ring.quaternion.copy(tipCap.quaternion);
    groups.shell.add(ring);
    var boreMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.6 });
    [[-0.07, 0.03], [0.06, 0.05], [0, -0.07]].forEach(function (o) {
      var bore = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), boreMat);
      var side = new THREE.Vector3(1, 0, 0).applyQuaternion(tipCap.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(tipCap.quaternion);
      bore.position.copy(tip).addScaledVector(side, o[0]).addScaledVector(up, o[1]).addScaledVector(nozzleDir, 0.002);
      bore.quaternion.copy(tipCap.quaternion);
      groups.shell.add(bore);
    });
    root.add(groups.shell);

    // faceplate
    var faceTex = faceplateTexture(opts.logo, opts.mirror);
    var faceMat = new THREE.MeshPhysicalMaterial({ map: faceTex, metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
    var face = new THREE.Mesh(faceplateGeometry(), faceMat);
    face.position.z = TOP - 0.035;
    groups.face = new THREE.Group(); groups.face.add(face);
    // conector de 2 pinos na borda superior
    var sock = new THREE.Mesh(roundedBox(0.18, 0.1, 0.12, 0.03), new THREE.MeshPhysicalMaterial({ color: 0xdfe4ea, transmission: 0.7, roughness: 0.15, thickness: 0.1 }));
    sock.position.set(0.5, 0.74, 0.5);
    groups.face.add(sock);
    for (var pi = 0; pi < 2; pi++) {
      var pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), new THREE.MeshStandardMaterial({ color: 0xd9b46a, metalness: 1, roughness: 0.2 }));
      pin.position.set(0.47 + pi * 0.06, 0.78, 0.5); 
      groups.face.add(pin);
    }
    root.add(groups.face);

    // crossover de 3 vias
    var pcb = new THREE.Group();
    var board = new THREE.Mesh(roundedBox(0.62, 0.34, 0.025, 0.04), new THREE.MeshStandardMaterial({ color: COLORS.pcb, roughness: 0.55, metalness: 0.2 }));
    pcb.add(board);
    var compMat = [
      new THREE.MeshStandardMaterial({ color: 0xc9a26a, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.3, metalness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.8, roughness: 0.3 })
    ];
    var comps = [[-0.2, 0.08, 0.07, 0.04, 0], [-0.08, 0.09, 0.05, 0.05, 1], [0.05, 0.07, 0.08, 0.035, 0], [0.18, 0.08, 0.05, 0.05, 2],
                 [-0.18, -0.07, 0.06, 0.05, 1], [-0.04, -0.08, 0.09, 0.035, 0], [0.12, -0.07, 0.05, 0.05, 2], [0.22, -0.08, 0.05, 0.04, 1]];
    comps.forEach(function (c) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(c[2], c[3], 0.035), compMat[c[4]]);
      m.position.set(c[0], c[1], 0.03); pcb.add(m);
    });
    var traceMat = new THREE.MeshStandardMaterial({ color: COLORS.copper, metalness: 1, roughness: 0.3, emissive: COLORS.copper, emissiveIntensity: 0.15 });
    for (var tr = 0; tr < 3; tr++) {
      var t1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.008, 0.004), traceMat);
      t1.position.set(0, -0.12 + tr * 0.12, 0.015); pcb.add(t1);
    }
    pcb.position.set(-0.22, 0.12, 0.24);
    pcb.rotation.set(0.05, -0.08, 0.06);
    pcb.userData.glow = [traceMat];
    groups.pcb = pcb; root.add(pcb);

    // 2 drivers de graves
    groups.bass = new THREE.Group();
    [[-0.42, -0.2, -0.2, 0.3], [-0.1, -0.3, -0.26, 0.15]].forEach(function (p) {
      var d = baDriver(0.3, 0.21, 0.16, COLORS.bass);
      d.position.set(p[0], p[1], p[2]); d.rotation.set(0.2, -0.35, p[3]);
      groups.bass.add(d); parts.bass.push(d);
    });
    root.add(groups.bass);

    // 2 drivers de médios
    groups.mid = new THREE.Group();
    [[-0.1, 0.22, -0.16, -0.2], [0.18, 0.1, -0.22, -0.35]].forEach(function (p) {
      var d = baDriver(0.23, 0.16, 0.12, COLORS.mid);
      d.position.set(p[0], p[1], p[2]); d.rotation.set(0.25, -0.5, p[3]);
      groups.mid.add(d); parts.mid.push(d);
    });
    root.add(groups.mid);

    // 4 eletrostáticos para altas e super altas, em dois pares junto da cânula
    var stTex = statorTexture();
    groups.est = new THREE.Group();
    var estBase = [[0.3, -0.1, -0.12], [0.3, -0.1, -0.21], [0.4, -0.3, -0.24], [0.4, -0.3, -0.33]];
    estBase.forEach(function (p, i) {
      var d = estDriver(stTex);
      d.position.set(p[0], p[1], p[2]);
      d.rotation.set(-0.55, 0.5, 0.4);
      d.scale.setScalar(0.92);
      d.userData.base = new THREE.Vector3(p[0], p[1], p[2]);
      d.userData.i = i;
      groups.est.add(d); parts.est.push(d);
    });
    root.add(groups.est);

    // tubos de som até a cânula, um por via
    var tubeMats = {};
    groups.tubes = new THREE.Group();
    [['bass', [-0.25, -0.26, -0.28]], ['mid', [0.06, 0.14, -0.24]], ['est', [0.38, -0.22, -0.3]]].forEach(function (t, i) {
      var mat = new THREE.MeshPhysicalMaterial({ color: 0xeef3f8, transmission: 0.85, roughness: 0.12, thickness: 0.05, transparent: true, opacity: 0.75, emissive: COLORS[t[0]], emissiveIntensity: 0.08 });
      tubeMats[t[0]] = mat;
      var off = (i - 1) * 0.05;
      var end = tip.clone().addScaledVector(nozzleDir, -0.03);
      var mid = nozzleBase.clone();
      groups.tubes.add(tube([t[1], [t[1][0] * 0.5 + mid.x * 0.5, t[1][1] * 0.5 + mid.y * 0.5 + off, (t[1][2] + mid.z) / 2], [mid.x + off * 0.8, mid.y + off * 0.4, mid.z], [end.x + off * 0.5, end.y + off * 0.3, end.z]], 0.024, mat));
    });
    root.add(groups.tubes);

    // fiação de cobre do conector para o crossover e do crossover para cada via
    var wireMat = new THREE.MeshStandardMaterial({ color: COLORS.copper, metalness: 1, roughness: 0.35, transparent: true, opacity: 1 });
    groups.wires = new THREE.Group();
    groups.wires.add(tube([[0.48, 0.7, 0.4], [0.3, 0.45, 0.32], [0.0, 0.22, 0.26]], 0.008, wireMat));
    [[-0.36, -0.16, -0.12], [0.0, 0.2, -0.1], [0.32, -0.08, -0.08]].forEach(function (p) {
      groups.wires.add(tube([[-0.1, 0.08, 0.24], [(p[0] - 0.1) / 2, (p[1] + 0.08) / 2, 0.2], p], 0.006, wireMat));
    });
    root.add(groups.wires);

    // cabo transparente trançado com gancho de orelha
    if (opts.cable) {
      var cableMat = new THREE.MeshPhysicalMaterial({ color: 0xd8dde3, transmission: 0.6, roughness: 0.25, thickness: 0.2, transparent: true, opacity: 0.9 });
      var cable = new THREE.Group();
      for (var s = 0; s < 2; s++) {
        var pts = [];
        for (var k = 0; k <= 60; k++) {
          var u = k / 60;
          var ang = u * Math.PI * 1.15;
          var cx = 0.5 - 0.95 * Math.sin(ang) * 0.9 - u * 0.25, cy = 0.82 + 1.1 * Math.sin(ang * 0.5) + u * 0.4, cz = 0.5 - u * 0.7;
          var tw = u * Math.PI * 18 + s * Math.PI;
          pts.push([cx + Math.cos(tw) * 0.018, cy, cz + Math.sin(tw) * 0.018]);
        }
        cable.add(tube(pts, 0.014, cableMat));
      }
      groups.face.add(cable);
    }

    var all = ['shell', 'face', 'pcb', 'bass', 'mid', 'est', 'tubes', 'wires'];
    all.forEach(function (k) { groups[k].userData.home = groups[k].position.clone(); });

    // posições explodidas (deslocamento a partir da posição montada)
    var explodeOffset = {
      shell: new THREE.Vector3(0.35, -0.25, -1.0),
      face: new THREE.Vector3(-1.5, 1.05, -0.35),
      pcb: new THREE.Vector3(-0.5, 0.4, 0.4),
      bass: new THREE.Vector3(-0.8, -0.65, 0.05),
      mid: new THREE.Vector3(0.25, 0.85, 0.05),
      est: new THREE.Vector3(0.95, -0.3, 0.3),
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
        // separa as quatro unidades eletrostáticas para mostrar que são quatro
        parts.est.forEach(function (d, i) {
          var spread = [[-0.12, 0.2, 0.18], [0.12, 0.2, -0.02], [-0.12, -0.15, 0.2], [0.14, -0.18, 0]][i];
          d.position.set(d.userData.base.x + spread[0] * k * 1.6, d.userData.base.y + spread[1] * k * 1.6, d.userData.base.z + spread[2] * k * 1.6);
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
            if (d.userData.stator) d.userData.stator.emissiveIntensity = 0.3 + e * 0.9;
          });
        });
        // película: ondulação senoidal discreta, mais forte com energia
        var amp = 0.004 + (state.energy.est || 0) * 0.012 + (state.focus === 'est' ? 0.006 : 0);
        if (!(opts.lite && state.explode < 0.05 && !state.energy.est)) parts.est.forEach(function (d, i) {
          var f = d.userData.film, pa = f.geometry.attributes.position;
          for (var v = 0; v < pa.count; v++) {
            var x = pa.getX(v), y = pa.getY(v);
            var edge = Math.cos(x / 0.15 * Math.PI / 2) * Math.cos(y / 0.1 * Math.PI / 2);
            pa.setZ(v, Math.sin(t * 9 + i) * amp * Math.max(edge, 0));
          }
          pa.needsUpdate = true;
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

  global.XEModel = { buildIEM: buildIEM, studioEnvironment: studioEnvironment, ease: ease, COLORS: COLORS };
})(window);
