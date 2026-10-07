/* ============================================================
   BoliOS · Escenas Three.js
   1) Boli 3D del hero (procedural, glossy, flotante)
   2) Gráfico 3D de ventas por día de la semana
   Optimizado: DPR limitado, pausa fuera de pantalla, resize observer.
   ============================================================ */
"use strict";

(function () {
  if (typeof THREE === "undefined") return;

  const MAX_DPR = 2;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function makeRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    return renderer;
  }

  function addLights(scene, intensity = 1) {
    scene.add(new THREE.HemisphereLight(0xbfe4ff, 0xfff2d0, 1.05 * intensity));
    const key = new THREE.DirectionalLight(0xffffff, 2.1 * intensity);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6; key.shadow.camera.right = 6;
    key.shadow.camera.top = 6; key.shadow.camera.bottom = -6;
    key.shadow.radius = 6;
    scene.add(key);
    const rim = new THREE.PointLight(0xffd90d, 18 * intensity, 30);
    rim.position.set(-5, 3, -4);
    scene.add(rim);
    return key;
  }

  function fitRenderer(renderer, camera, canvas) {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  /* ============================================================
     HERO — Boli flotante
     ============================================================ */
  function popsicleShape(w, h, rTop) {
    // Rectángulo con parte superior semicircular
    const s = new THREE.Shape();
    const hw = w / 2;
    const yArc = h - rTop;
    s.moveTo(-hw, 0);
    s.lineTo(-hw, yArc);
    s.absarc(0, yArc, rTop, Math.PI, 0, true);
    s.lineTo(hw, 0);
    s.quadraticCurveTo(hw, -0.001, hw * 0.6, 0);
    s.lineTo(-hw * 0.6, 0);
    s.quadraticCurveTo(-hw, 0.001, -hw, 0);
    return s;
  }

  function creamCapShape(w, h, rTop, capH) {
    // Tapa de crema con borde inferior ondulado (goteo)
    const s = new THREE.Shape();
    const hw = w / 2;
    const yBot = h - capH;
    const yArc = h - rTop;
    s.moveTo(-hw, yBot);
    // ondas hacia el borde derecho
    const bumps = 3;
    for (let i = 0; i < bumps; i++) {
      const x0 = -hw + (i * w) / bumps;
      const x1 = -hw + ((i + 0.5) * w) / bumps;
      const x2 = -hw + ((i + 1) * w) / bumps;
      s.quadraticCurveTo(x1, yBot - 0.34, x2, yBot);
    }
    s.lineTo(hw, yArc);
    s.absarc(0, yArc, rTop, 0, Math.PI, false);
    s.lineTo(-hw, yBot);
    return s;
  }

  function initHero3D() {
    const canvas = document.getElementById("hero3d");
    if (!canvas) return;
    let renderer;
    try { renderer = makeRenderer(canvas); } catch (e) { canvas.style.display = "none"; return; }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 1.15, 7.4);
    camera.lookAt(0, 0.55, 0);
    addLights(scene);

    const group = new THREE.Group();
    scene.add(group);

    // Cuerpo fresa
    const bodyGeo = new THREE.ExtrudeGeometry(popsicleShape(1.7, 2.75, 0.85), {
      depth: 0.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 6, curveSegments: 28,
    });
    bodyGeo.center();
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshPhysicalMaterial({
      color: 0xff5d8f, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.22,
    }));
    body.castShadow = true;
    body.position.y = 0.55;
    group.add(body);

    // Tapa de crema
    const capGeo = new THREE.ExtrudeGeometry(creamCapShape(1.7, 2.75, 0.85, 0.85), {
      depth: 0.56, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.14, bevelSegments: 6, curveSegments: 24,
    });
    capGeo.center();
    const cap = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({
      color: 0xfff6e0, roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.3,
    }));
    cap.castShadow = true;
    cap.position.y = 0.55;
    group.add(cap);

    // Palito
    const stick = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 1.35, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xdeb887, roughness: 0.65 })
    );
    stick.castShadow = true;
    stick.position.y = -1.55;
    group.add(stick);

    group.position.y = 0.35;

    // Sombra suave
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 40),
      new THREE.ShadowMaterial({ opacity: 0.16 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.45;
    ground.receiveShadow = true;
    scene.add(ground);

    // Burbujas / chispas flotantes
    const sparkGeo = new THREE.SphereGeometry(1, 18, 18);
    const sparkMats = [
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }),
      new THREE.MeshPhysicalMaterial({ color: 0xffd90d, roughness: 0.15, clearcoat: 1 }),
      new THREE.MeshPhysicalMaterial({ color: 0x8bd346, roughness: 0.15, clearcoat: 1 }),
    ];
    const sparks = [];
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(sparkGeo, sparkMats[i % 3]);
      const r = 0.06 + Math.random() * 0.11;
      m.scale.setScalar(r);
      const ang = (i / 9) * Math.PI * 2;
      m.position.set(Math.cos(ang) * (2.1 + Math.random() * 1.4), -1.6 + Math.random() * 3.6, Math.sin(ang) * 1.2);
      m.userData = { baseY: m.position.y, speed: 0.5 + Math.random() * 0.9, phase: Math.random() * Math.PI * 2, amp: 0.25 + Math.random() * 0.35 };
      scene.add(m);
      sparks.push(m);
    }

    // Parallax con el puntero
    let targetRX = 0, targetRY = 0;
    const hero = canvas.closest(".hero") || canvas;
    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetRY = nx * 0.55;
      targetRX = ny * 0.28;
    });
    hero.addEventListener("pointerleave", () => { targetRX = 0; targetRY = 0; });

    // Pausa fuera de pantalla / pestaña oculta
    let visible = true, pageVisible = !document.hidden;
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
    document.addEventListener("visibilitychange", () => { pageVisible = !document.hidden; });
    new ResizeObserver(() => fitRenderer(renderer, camera, canvas)).observe(canvas);
    fitRenderer(renderer, camera, canvas);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (!visible || !pageVisible) return;
      const t = clock.getElapsedTime();
      if (!reducedMotion) {
        group.rotation.y += ((targetRY + Math.sin(t * 0.35) * 0.28) - group.rotation.y) * 0.055;
        group.rotation.x += (targetRX - group.rotation.x) * 0.055;
        group.position.y = 0.35 + Math.sin(t * 1.15) * 0.14;
        cap.position.z = Math.sin(t * 0.8) * 0.03;
        sparks.forEach((m) => {
          m.position.y = m.userData.baseY + Math.sin(t * m.userData.speed + m.userData.phase) * m.userData.amp;
          m.rotation.y = t * 0.6;
        });
      }
      renderer.render(scene, camera);
    });
  }

  /* ============================================================
     GRÁFICO 3D — ventas por día de la semana
     ============================================================ */
  const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  let bar3d = null;

  function textSprite(text, { size = 46, color = "#12141f", weight = 700, scale = 1 } = {}) {
    const cv = document.createElement("canvas");
    const ctx = cv.getContext("2d");
    ctx.font = `${weight} ${size}px Sora, Inter, sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 18;
    cv.width = w; cv.height = size + 22;
    const ctx2 = cv.getContext("2d");
    ctx2.font = `${weight} ${size}px Sora, Inter, sans-serif`;
    ctx2.fillStyle = color;
    ctx2.textAlign = "center";
    ctx2.textBaseline = "middle";
    ctx2.fillText(text, cv.width / 2, cv.height / 2);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.set((cv.width / cv.height) * 0.42 * scale, 0.42 * scale, 1);
    return sp;
  }

  function initBar3D() {
    const canvas = document.getElementById("bar3d");
    if (!canvas || bar3d) return;
    let renderer;
    try { renderer = makeRenderer(canvas); } catch (e) { canvas.style.display = "none"; return; }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd9f1ff);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 4.4, 9.6);
    camera.lookAt(0, 1.1, 0);
    addLights(scene, 0.9);

    const group = new THREE.Group();
    scene.add(group);

    // Base
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 4.9, 0.28, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, transparent: true, opacity: 0.92 })
    );
    base.position.y = -0.14;
    base.receiveShadow = true;
    group.add(base);

    const MAX_H = 3.1;
    const bars = [];
    const cSky = new THREE.Color(0x2cadfd), cSun = new THREE.Color(0xffd90d);

    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 1.14;
      const geo = new THREE.BoxGeometry(0.68, 1, 0.68);
      geo.translate(0, 0.5, 0); // crece desde la base
      const mat = new THREE.MeshPhysicalMaterial({ color: 0x2cadfd, roughness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.3 });
      const bar = new THREE.Mesh(geo, mat);
      bar.castShadow = true;
      bar.position.x = x;
      bar.scale.y = 0.02;
      group.add(bar);

      const lbl = textSprite(DAY_LABELS[i], { color: "#4b5064", scale: 0.85 });
      lbl.position.set(x, 0.10, 1.0);
      group.add(lbl);

      const val = textSprite("", { color: "#12141f", scale: 0.9 });
      val.position.set(x, 0.6, 0);
      group.add(val);

      bars.push({ bar, val, target: 0, shown: 0.02, amount: 0 });
    }

    bar3d = { canvas, bars, MAX_H, cSky, cSun };

    // Rotación con arrastre + autorrotación
    let dragging = false, lastX = 0, targetRotY = 0.5, idleT = 0;
    canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; idleT = 0; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      targetRotY += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    });
    const endDrag = () => { dragging = false; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);

    let visible = true, pageVisible = !document.hidden;
    new IntersectionObserver((en) => { visible = en[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
    document.addEventListener("visibilitychange", () => { pageVisible = !document.hidden; });
    new ResizeObserver(() => fitRenderer(renderer, camera, canvas)).observe(canvas);
    fitRenderer(renderer, camera, canvas);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (!visible || !pageVisible) return;
      const t = clock.getElapsedTime();
      if (!dragging && !reducedMotion) {
        idleT += 0.016;
        if (idleT > 2.2) targetRotY += 0.0022;
      }
      group.rotation.y += (targetRotY - group.rotation.y) * 0.08;
      bars.forEach((b, i) => {
        b.shown += (b.target - b.shown) * 0.07;
        const bob = reducedMotion ? 0 : Math.sin(t * 1.4 + i * 0.55) * 0.02;
        b.bar.scale.y = Math.max(0.02, b.shown + bob);
        b.bar.material.color.copy(bar3d.cSky).lerp(bar3d.cSun, Math.min(1, b.shown / 3.1));
        b.val.position.y = b.bar.scale.y + 0.34;
      });
      renderer.render(scene, camera);
    });
  }

  function fmtCompact(v, cur) {
    if (v >= 1000) return `${cur}${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    return `${cur}${Math.round(v)}`;
  }

  window.updateSales3D = function (data, currency = "$") {
    initBar3D();
    if (!bar3d) return;
    const max = Math.max(...data, 1);
    bar3d.bars.forEach((b, i) => {
      b.target = 0.12 + (data[i] / max) * (bar3d.MAX_H - 0.12);
      b.amount = data[i];
      // reconstruir etiqueta de valor
      b.bar.parent.remove(b.val);
      if (b.val.material.map) b.val.material.map.dispose();
      b.val.material.dispose();
      const sp = textSprite(fmtCompact(data[i], currency), { color: "#12141f", scale: 0.95 });
      sp.position.set(b.bar.position.x, b.bar.scale.y + 0.34, 0);
      b.bar.parent.add(sp);
      b.val = sp;
    });
  };

  window.initHero3D = initHero3D;
})();
