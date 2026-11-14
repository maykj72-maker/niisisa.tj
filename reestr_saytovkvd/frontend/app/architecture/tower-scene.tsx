/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-expressions */
// @ts-nocheck
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Water } from "three/examples/jsm/objects/Water.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const L = (a, b, t) => a + (b - a) * t;
const cl = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => x * x * (3 - 2 * x);
const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function waterNormals() {
  const S = 256, d = new Float32Array(S * S);
  const waves = [[1,0,.9],[0,2,.7],[2,1,.5],[3,2,.35],[1,5,.2]];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const [fx, fy, a] of waves) h += Math.sin((x / S * fx + y / S * fy) * Math.PI * 2) * a;
    d[y * S + x] = h;
  }
  return canvasTex(S, S, (g) => {
    const img = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = d[y * S + ((x + 1) % S)] - d[y * S + ((x + S - 1) % S)];
      const dy = d[((y + 1) % S) * S + x] - d[((y + S - 1) % S) * S + x];
      const n = new THREE.Vector3(-dx * 1.6, -dy * 1.6, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * .5 + .5) * 255; img.data[i + 1] = (n.y * .5 + .5) * 255; img.data[i + 2] = (n.z * .5 + .5) * 255; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, false);
}

function createTower(cv: HTMLCanvasElement, wrap: HTMLElement) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.95;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);

  // ---- sky (linear output, HDR sun so bloom picks it up)
  const skyU = { t: { value: 0 }, sd: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() } };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: "varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 p;uniform float t;uniform vec3 sd;
vec3 lin(vec3 c){return pow(c,vec3(2.2));}
void main(){
 vec3 d=normalize(p);float h=max(d.y,0.);
 vec3 dayTop=lin(vec3(.16,.40,.80)),dayHor=lin(vec3(.70,.84,.96));
 vec3 day=mix(dayHor,dayTop,pow(h,.45));
 vec3 duskTop=lin(vec3(.07,.09,.30)),duskMid=lin(vec3(.62,.25,.42)),duskLow=lin(vec3(1.,.50,.20)),duskHor=lin(vec3(1.,.78,.45));
 vec3 dusk=mix(duskHor,duskLow,smoothstep(0.,.05,h));
 dusk=mix(dusk,duskMid,smoothstep(.03,.25,h));
 dusk=mix(dusk,duskTop,smoothstep(.2,.8,h));
 vec3 c=mix(day,dusk,t);
 float s=max(dot(d,normalize(sd)),0.);
 vec3 sunCol=mix(vec3(1.,.95,.85),vec3(1.,.55,.2),t);
 c+=sunCol*(pow(s,6.)*.25+pow(s,60.)*.7)*mix(.5,1.6,t);
 c+=sunCol*smoothstep(.99965,.9999,s)*mix(14.,9.,t);
 if(d.y<0.) c=mix(c,dusk*.5+day*.2,clamp(-d.y*6.,0.,1.));
 gl_FragColor=vec4(c,1.);}`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(2000, 48, 24), skyMat));
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), skyMat));
  const pmrem = new THREE.PMREMGenerator(r);
  let envRT = null, envT = -1;
  const updateEnv = (t) => {
    if (Math.abs(t - envT) < 0.035) return;
    envT = t;
    const rt = pmrem.fromScene(envScene, 0, 1, 2500);
    scene.environment = rt.texture;
    envRT?.dispose();
    envRT = rt;
  };
  scene.environmentIntensity = 0.9;
  scene.fog = new THREE.Fog(0xcfe0f0, 300, 2400);

  const hemi = new THREE.HemisphereLight(0xbfdcff, 0x6a5a48, 0.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 700 });
  scene.add(sun); scene.add(sun.target);

  // ---- water
  const waterMat = waterNormals();
  const water = new Water(new THREE.PlaneGeometry(6000, 6000), {
    textureWidth: 512, textureHeight: 512, waterNormals: waterMat,
    sunDirection: new THREE.Vector3(), sunColor: 0xffffff, waterColor: 0x0b4366,
    distortionScale: 2.0, fog: true, alpha: 1,
  });
  water.rotation.x = -Math.PI / 2; water.position.y = -1.5;
  water.material.uniforms.size.value = 0.6;
  scene.add(water);

  // ---- ground
  const dirt = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#8d8576"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 100 + rnd() * 80; g.fillStyle = `rgba(${v},${v - 6},${v - 18},${.18 + rnd() * .25})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 4); }
  });
  dirt.repeat.set(10, 10);
  const land = new THREE.Mesh(new THREE.CylinderGeometry(190, 215, 8, 96), new THREE.MeshStandardMaterial({ map: dirt, roughness: 0.95, metalness: 0 }));
  land.position.y = -4.2; land.receiveShadow = true; scene.add(land);
  // sandy shore ring
  const shore = new THREE.Mesh(new THREE.RingGeometry(190, 232, 96), new THREE.MeshStandardMaterial({ color: 0xc9b58a, roughness: 1 }));
  shore.rotation.x = -Math.PI / 2; shore.position.y = -1.3; shore.receiveShadow = true; scene.add(shore);
  // concrete pad under the tower
  const concrete = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#a7a49d"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const v = 130 + rnd() * 60; g.fillStyle = `rgba(${v},${v},${v - 4},.35)`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  });
  concrete.repeat.set(6, 6);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(46, 46, .6, 64), new THREE.MeshStandardMaterial({ map: concrete, roughness: .9 }));
  pad.position.y = .05; pad.receiveShadow = true; scene.add(pad);

  // ---- facade textures
  const facade = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#3f7ca8"); gr.addColorStop(.55, "#6aa6cc"); gr.addColorStop(1, "#2f628c");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#b9c3c8"; g.fillRect(0, 0, w, 5); g.fillRect(0, 0, 4, h); g.fillRect(0, h - 3, w, 3);
  });
  const glow = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffc074"; g.fillRect(8, 10, w - 14, h - 20);
  });
  const lattice = canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.strokeStyle = "#f0a81c"; g.lineWidth = 5;
    g.strokeRect(2, 0, w - 4, h); g.lineWidth = 3; g.beginPath();
    g.moveTo(2, h); g.lineTo(w - 2, 0); g.moveTo(2, 0); g.lineTo(w - 2, h); g.stroke();
  });

  // ---- tower
  const N = 60, FH = 3.2, W0 = 26;
  const floors = [];
  const slabM = new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.7 });
  const tower = new THREE.Group(); scene.add(tower);
  const glassMats = [];
  for (let i = 0; i < N; i++) {
    const w = W0 * (1 - 0.34 * Math.pow(i / N, 1.3)) * (1 + 0.04 * Math.sin(i * 0.4));
    const g = new THREE.Group(); g.position.y = i * FH; g.rotation.y = i * 0.012;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 0.8, 0.45, w + 0.8), slabM);
    slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const geo = new THREE.BoxGeometry(w, FH - 0.45, w);
    const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, uv.getX(k) * Math.round(w / 3));
    const m = new THREE.MeshStandardMaterial({
      map: facade, color: 0xffffff, metalness: 0.9, roughness: 0.14, envMapIntensity: 1.5,
      emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 0,
    });
    m.userData.lit = rnd() < 0.7 ? 0.25 + rnd() * 0.75 : 0.05;
    glassMats.push(m);
    const glass = new THREE.Mesh(geo, m); glass.position.y = FH / 2 + 0.2; glass.castShadow = true; glass.receiveShadow = true; g.add(glass);
    g.userData = { base: i * FH }; g.visible = false; tower.add(g); floors.push(g);
  }
  const top = N * FH;
  const metal = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 1, roughness: 0.25 });
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.7, 34, 12), metal);
  spire.visible = false; spire.castShadow = true; tower.add(spire);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) }));
  beacon.visible = false; tower.add(beacon);
  const core = new THREE.Mesh(new THREE.BoxGeometry(7, N * FH, 7), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.95 }));
  core.castShadow = true; tower.add(core);
  // work platform with orange safety net on the top floor
  const rig = new THREE.Mesh(new THREE.BoxGeometry(W0 + 2, 3, W0 + 2), new THREE.MeshStandardMaterial({ map: lattice, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, color: 0xffffff }));
  tower.add(rig);

  // ---- cranes (lattice)
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b01e, roughness: 0.5, metalness: 0.3 });
  const latMat = new THREE.MeshStandardMaterial({ map: lattice, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 });
  const grey = new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.7 });
  const cranes = [];
  function crane(x, z, h, rot) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const mg = new THREE.BoxGeometry(2.4, h, 2.4);
    const u = mg.attributes.uv; for (let k = 0; k < u.count; k++) u.setY(k, u.getY(k) * h / 2.4);
    const mast = new THREE.Mesh(mg, latMat); mast.position.y = h / 2; mast.castShadow = true; g.add(mast);
    const jib = new THREE.Group(); jib.position.y = h;
    const jg = new THREE.BoxGeometry(70, 2.4, 2.4);
    const ju = jg.attributes.uv; for (let k = 0; k < ju.count; k++) ju.setX(k, ju.getX(k) * 70 / 2.4);
    const arm = new THREE.Mesh(jg, latMat); arm.position.x = 18; arm.castShadow = true; jib.add(arm);
    const cw = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 3.2), grey); cw.position.x = -14; cw.castShadow = true; jib.add(cw);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 3.2, 3), yellow); cab.position.set(1.5, -3, 0); jib.add(cab);
    const apex = new THREE.Mesh(new THREE.ConeGeometry(1.4, 8, 4), yellow); apex.position.y = 5; jib.add(apex);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 18, 4), grey); cable.position.set(40, -9, 0); jib.add(cable);
    const load = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: .8 })); load.position.set(40, -19, 0); load.castShadow = true; jib.add(load);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2) })); lamp.position.set(0, 9.5, 0); jib.add(lamp);
    jib.rotation.y = rot; g.add(jib); g.userData = { jib, r: rot }; scene.add(g); cranes.push(g);
  }
  crane(34, 26, 120, 0.4); crane(-38, -22, 92, 2.4);

  // ---- site props
  const cm = [0xc0392b, 0x2e6fa8, 0xe08a2a, 0x2f8f5b, 0xd9d9d9];
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(12, 2.9, 2.5), new THREE.MeshStandardMaterial({ color: cm[i % 5], roughness: 0.55, metalness: 0.3 }));
    const a = (i / 18) * Math.PI * 2 + 0.3, d = 66 + rnd() * 90;
    b.position.set(Math.cos(a) * d, 1.45 + (i % 4 === 0 ? 2.9 : 0), Math.sin(a) * d); b.rotation.y = rnd() * 3; b.castShadow = b.receiveShadow = true; scene.add(b);
  }
  const sand = new THREE.MeshStandardMaterial({ color: 0xd2b87c, roughness: 1 });
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(7 + rnd() * 4, 5 + rnd() * 3, 18), sand);
    const a = rnd() * Math.PI * 2, d = 60 + rnd() * 70; m.position.set(Math.cos(a) * d, 2.2, Math.sin(a) * d); m.castShadow = m.receiveShadow = true; scene.add(m);
  }

  // ---- city across the bay + mountains
  const cityGlow = new THREE.MeshStandardMaterial({ color: 0x39425a, roughness: 0.4, metalness: 0.6, emissive: 0xffc070, emissiveMap: glow, emissiveIntensity: 0 });
  for (let i = 0; i < 150; i++) {
    const h = 14 + rnd() * rnd() * 110, w = 8 + rnd() * 14;
    const g = new THREE.BoxGeometry(w, h, w);
    const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) { uv.setX(k, uv.getX(k) * Math.round(w / 3)); uv.setY(k, uv.getY(k) * Math.round(h / 3)); }
    const b = new THREE.Mesh(g, cityGlow);
    const a = (rnd() - 0.5) * 1.9 - Math.PI / 2, d = 950 + rnd() * 300;
    b.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); scene.add(b);
  }
  const ridgeMats = [];
  [[1450, 0x5b6b86, 190, 1.0], [1650, 0x3f4f6c, 260, 1.7], [1850, 0x2d3a56, 330, 2.6]].forEach(([dist, col, hgt, seed]) => {
    const shape = new THREE.Shape(); const seg = 64, wdt = 3600;
    shape.moveTo(-wdt / 2, -50);
    for (let i = 0; i <= seg; i++) {
      const x = -wdt / 2 + (i / seg) * wdt;
      const y = hgt * (0.35 + 0.45 * Math.abs(Math.sin(i * 0.35 + seed)) + 0.2 * Math.sin(i * 0.9 + seed * 3)) * (0.6 + 0.4 * Math.sin(i * 0.13 + seed));
      shape.lineTo(x, Math.max(10, y));
    }
    shape.lineTo(wdt / 2, -50);
    const mat = new THREE.MeshBasicMaterial({ color: col, fog: false });
    mat.userData = { col: new THREE.Color(col) };
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    m.position.set(0, -2, -dist); scene.add(m); ridgeMats.push(mat);
  });

  // ---- clouds
  const cloudTex = canvasTex(256, 128, (g, w, h) => {
    for (let i = 0; i < 26; i++) {
      const x = w * (0.2 + rnd() * 0.6), y = h * (0.35 + rnd() * 0.3), rad = 20 + rnd() * 34;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  });
  const clouds = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
    const s = new THREE.Sprite(m);
    const a = rnd() * Math.PI * 2, d = 600 + rnd() * 900;
    s.position.set(Math.cos(a) * d, 220 + rnd() * 260, Math.sin(a) * d);
    s.scale.set(520 + rnd() * 380, 240 + rnd() * 120, 1); scene.add(s); clouds.push(s);
  }

  // ---- post
  const comp = new EffectComposer(r, new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 }));
  comp.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.7, 0.9);
  comp.addPass(bloom); comp.addPass(new OutputPass());

  const C = (h) => new THREE.Color(h);
  const dayFog = C(0xbcd3ea), duskFog = C(0xe8935e);
  const tmp = new THREE.Color();
  const dayW = C(0x0b4366), duskW = C(0x3b2a4a);
  const sunDay = C(0xffffff), sunDusk = C(0xff8a3c);
  const cloudDay = C(0xffffff), cloudDusk = C(0xff9a68);
  const sdv = new THREE.Vector3();

  function resize() {
    const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
    r.setSize(w, h, false); comp.setSize(w, h); bloom.resolution.set(w, h);
    cam.aspect = w / h; cam.fov = w / h < 0.9 ? 62 : 50; cam.updateProjectionMatrix();
  }
  addEventListener("resize", resize); resize();
  let target = 0, cur = 0, raf = 0;
  const upd = () => { const b = wrap.getBoundingClientRect(), m = b.height - innerHeight; target = m > 0 ? cl(-b.top / m) : 0; };
  addEventListener("scroll", upd, { passive: true }); upd(); cur = target;
  const pts = [[0, 160, 38], [0.25, 120, 50], [0.5, 100, 115], [0.75, 120, 175], [0.9, 160, 140], [1, 215, 62]];
  const path = (p) => { const s = p * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(s)), t = sm(s - i); return pts[i].map((v, k) => L(v, pts[i + 1][k], t)); };
  const clock = new THREE.Clock();
  const look = new THREE.Vector3(), horizon = new THREE.Vector3(-150, 70, -700);

  function frame() {
    raf = requestAnimationFrame(frame);
    const time = clock.getElapsedTime();
    cur += (target - cur) * 0.07; const p = cur;
    const bp = cl((p - 0.04) / 0.72), n = bp * N; let topY = 0;
    floors.forEach((g, i) => {
      const k = cl(n - i); g.visible = k > 0;
      if (k > 0) { g.scale.y = Math.max(0.001, sm(k)); if (k < 1) topY = g.userData.base + FH * k; }
    });
    if (n >= N) topY = top;
    const sp = cl((bp - 0.97) / 0.03);
    spire.visible = beacon.visible = sp > 0; spire.scale.y = Math.max(0.001, sp);
    spire.position.y = top + 17 * sp; beacon.position.y = top + 34 * sp;
    const done = bp >= 0.999;
    core.visible = !done;
    const ch = Math.min(topY + FH * 2, N * FH); core.scale.y = Math.max(0.001, ch / (N * FH)); core.position.y = ch / 2;
    rig.visible = !done; rig.position.y = topY + FH + 1.5;
    cranes.forEach((c, i) => { c.userData.jib.rotation.y = c.userData.r + Math.sin(time * 0.18 + i * 2) * 0.45; });

    const st = sm(cl((p - 0.76) / 0.22));
    skyU.t.value = st;
    sdv.set(L(0.45, -0.32, st), L(0.85, 0.07, st), L(0.35, -1, st)).normalize();
    skyU.sd.value.copy(sdv);
    updateEnv(st);
    scene.environmentIntensity = L(0.9, 0.7, st);
    sun.position.copy(sdv).multiplyScalar(380); sun.color.copy(sunDay).lerp(sunDusk, st); sun.intensity = L(3.2, 3.6, st);
    hemi.intensity = L(0.35, 0.25, st);
    scene.fog.color.copy(dayFog).lerp(duskFog, st);
    water.material.uniforms.sunDirection.value.copy(sdv);
    water.material.uniforms.sunColor.value.copy(sunDay).lerp(sunDusk, st);
    water.material.uniforms.waterColor.value.copy(dayW).lerp(duskW, st);
    water.material.uniforms.distortionScale.value = L(2.0, 3.5, st);
    water.material.uniforms.time.value = time * 0.45;
    glassMats.forEach((m) => { m.emissiveIntensity = st * 1.4 * m.userData.lit; m.emissive.set(0xffc074); });
    cityGlow.emissiveIntensity = st * 0.9;
    tmp.copy(cloudDay).lerp(cloudDusk, st);
    clouds.forEach((c) => { c.material.color.copy(tmp); c.material.opacity = L(0.85, 0.7, st); });
    ridgeMats.forEach((m, i) => { m.color.copy(m.userData.col).lerp(C(i === 0 ? 0x7a4a5e : i === 1 ? 0x57395a : 0x3a2b4c), st); });
    bloom.strength = L(0.22, 0.55, st);
    r.toneMappingExposure = L(0.95, 1.05, st);

    const [a, rad, h] = path(p); const ang = a * (Math.PI * 2.5 - 0.6) + 0.6 + Math.sin(time * 0.1) * 0.01;
    cam.position.set(Math.cos(ang) * rad, h + Math.sin(time * 0.4) * 0.4, Math.sin(ang) * rad);
    const fy = L(L(10, Math.min(topY, N * FH) * 0.8 + 10, cl(p * 2)), 150, st);
    look.set(0, fy, 0).lerp(horizon, st * 0.12); cam.lookAt(look);
    comp.render();
  }
  frame();
  return () => {
    cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("scroll", upd);
    scene.traverse((o) => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach((x) => x.dispose?.()); });
    envRT?.dispose(); pmrem.dispose(); comp.dispose(); r.dispose();
  };
}

export default function TowerScene({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const cv = ref.current;
    const wrap = cv?.closest(".portal-hero-scroll") as HTMLElement | null;
    if (!cv || !wrap) return;
    let dispose: (() => void) | undefined;
    const header = document.querySelector(".unified-site-header") as HTMLElement | null;
    const setTop = () => wrap.style.setProperty("--hero-top", `${header ? header.offsetHeight : 0}px`);
    setTop();
    const ro = header ? new ResizeObserver(setTop) : null;
    if (header) ro?.observe(header);
    try {
      dispose = createTower(cv, wrap);
      onReady?.();
    } catch {
      setFailed(true);
    }
    return () => {
      ro?.disconnect();
      dispose?.();
    };
  }, [onReady]);
  if (failed) return null;
  return <canvas ref={ref} className="portal-hero__canvas" aria-hidden="true" />;
}
