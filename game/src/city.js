// The 3D city: Three.js scene, dusk lighting, the chase camera and the cinematic
// title camera. It only renders state the world owns; it never changes the rules.
import * as THREE from 'three';
import { BLOCK, CITY_HALF, PITCH, ROAD, ROAD_COORDS } from './config.js';
import { hashInt } from './random.js';

const DUSK_SKY_TOP = 0x1a1033;
const DUSK_SKY_MID = 0x7a3a6e;
const DUSK_HORIZON = 0xff9a5c;

function canvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function facadeTexture(seed, base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = 6;
    const rows = 12;
    const cw = w / cols;
    const ch = h / rows;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const v = hashInt(seed * 1000 + r * 16 + c);
        if (v < 0.42) {
          g.fillStyle = v < 0.28 ? '#ffd27a' : '#9fd8ff';
          g.globalAlpha = 0.55 + v;
        } else {
          g.fillStyle = '#10141d';
          g.globalAlpha = 1;
        }
        g.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);
      }
    }
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, h - 10, w, 10);
  });
}

function roadTexture() {
  const tex = canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#464b57';
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 200; i += 1) {
      g.fillRect(((i * 37) % w), ((i * 91) % h), 2, 2);
    }
    g.fillStyle = '#d8c25a';
    g.fillRect(w / 2 - 1, 8, 2, 34);
    g.fillRect(w / 2 - 1, 136, 2, 34);
    g.fillStyle = 'rgba(230,230,230,0.75)';
    g.fillRect(3, 0, 2, h);
    g.fillRect(w - 5, 0, 2, h);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 14);
  return tex;
}

function signTexture(text, color) {
  return canvasTexture(512, 96, (g, w, h) => {
    g.fillStyle = '#0a0a12';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = color;
    g.font = 'bold 52px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 22;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function glowTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,215,90,0.9)');
    grad.addColorStop(0.5, 'rgba(255,180,40,0.35)');
    grad.addColorStop(1, 'rgba(255,180,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
}

function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xe8e8e8 : color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1420, emissive: 0x0a0e18 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.85, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.7, 2.2), glassMat);
  cabin.position.set(0, 1.32, -0.25);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const wx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
    lamp.position.set(wx, 0.72, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const wx of [-0.65, 0.65]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), tailMat);
    lamp.position.set(wx, 0.72, -2.22);
    group.add(lamp);
  }
  let barRed = null;
  let barBlue = null;
  if (isPolice) {
    barRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    barRed.position.set(-0.45, 1.78, -0.25);
    barBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
    barBlue.position.set(0.45, 1.78, -0.25);
    group.add(barRed);
    group.add(barBlue);
  }
  return { group, wheels, barRed, barBlue };
}

function makePedMesh(color, isPlayer) {
  const group = new THREE.Group();
  const torsoMat = new THREE.MeshLambertMaterial({ color: isPlayer ? 0xd83a3a : color });
  const pantsMat = new THREE.MeshLambertMaterial({ color: isPlayer ? 0x22283a : 0x2a2f3a });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), torsoMat);
  torso.position.y = 1.08;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skinMat);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.22, 0.62, 0.24);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.geometry = legGeo.clone();
  legL.position.set(-0.16, 0.36, 0);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.16, 0.36, 0);
  legL.geometry.translate(0, -0.28, 0);
  legR.geometry.translate(0, -0.28, 0);
  legL.position.y = 0.62;
  legR.position.y = 0.62;
  group.add(legL);
  group.add(legR);
  let armL = null;
  let armR = null;
  if (isPlayer) {
    const armGeo = new THREE.BoxGeometry(0.18, 0.6, 0.2);
    armGeo.translate(0, -0.26, 0);
    armL = new THREE.Mesh(armGeo, torsoMat);
    armL.position.set(-0.42, 1.38, 0);
    armR = new THREE.Mesh(armGeo, torsoMat);
    armR.position.set(0.42, 1.38, 0);
    group.add(armL);
    group.add(armR);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0xffd24d }));
    cap.position.y = 1.9;
    group.add(cap);
  }
  return { group, legL, legR, armL, armR };
}

export function createCity(canvas, state, getMissionTarget) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x4a3560, 90, 420);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);

  // Dusk sky dome: orange horizon melting into purple night.
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(DUSK_SKY_TOP) },
      mid: { value: new THREE.Color(DUSK_SKY_MID) },
      bot: { value: new THREE.Color(DUSK_HORIZON) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; void main(){ float h = normalize(vP).y; vec3 c = h > 0.25 ? mix(mid, top, smoothstep(0.25, 0.8, h)) : mix(bot, mid, smoothstep(-0.05, 0.25, h)); gl_FragColor = vec4(c, 1.0); }',
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Lights: warm low sun + purple dusk sky bounce.
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 420;
  sun.shadow.bias = -0.002;
  scene.add(sun);
  scene.add(sun.target);
  scene.add(new THREE.HemisphereLight(0x9a7bff, 0x201812, 1.05));
  scene.add(new THREE.AmbientLight(0x665577, 0.7));

  // Ground and sidewalks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 80, CITY_HALF * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x3d4350 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const c of ROAD_COORDS) {
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, ROAD), roadMat);
    stripX.rotation.x = -Math.PI / 2;
    stripX.position.set(0, 0.02, c);
    stripX.receiveShadow = true;
    scene.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2 + 40, ROAD), roadMat);
    stripZ.rotation.x = -Math.PI / 2;
    stripZ.rotation.z = Math.PI / 2;
    stripZ.position.set(c, 0.03, 0);
    stripZ.receiveShadow = true;
    scene.add(stripZ);
  }
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x4a5160 });
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz += 1) {
      const x0 = ROAD_COORDS[ix] + ROAD / 2;
      const z0 = ROAD_COORDS[iz] + ROAD / 2;
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), walkMat);
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(x0 + BLOCK / 2, 0.05, z0 + BLOCK / 2);
      walk.receiveShadow = true;
      scene.add(walk);
    }
  }

  // Buildings: shared unit box, a few lit-window facades, scaled per building.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facades = [
    facadeTexture(11, '#2c3242'),
    facadeTexture(47, '#3a2f3d'),
    facadeTexture(83, '#26333a'),
  ].map((tex) => new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.4 }));
  for (const b of state.city.buildings) {
    const mesh = new THREE.Mesh(boxGeo, facades[b.seed % facades.length]);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.cx, 0.05 + b.h / 2, b.cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Street lamps and palms as instanced meshes: two draw calls each.
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2a2f38 });
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, state.city.lamps.length);
  const lampHeadGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const lampHeads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, state.city.lamps.length);
  {
    const m = new THREE.Matrix4();
    state.city.lamps.forEach((lamp, i) => {
      m.makeTranslation(lamp.x, 3.05, lamp.z);
      lampPoles.setMatrixAt(i, m);
      m.makeTranslation(lamp.x, 6.15, lamp.z);
      lampHeads.setMatrixAt(i, m);
    });
  }
  scene.add(lampPoles);
  scene.add(lampHeads);

  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 3.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, state.city.trees.length);
  const frondGeo = new THREE.ConeGeometry(1.5, 2.6, 6);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, state.city.trees.length);
  {
    const m = new THREE.Matrix4();
    state.city.trees.forEach((tree, i) => {
      m.makeTranslation(tree.x, 1.6, tree.z);
      trunks.setMatrixAt(i, m);
      m.makeTranslation(tree.x, 3.6, tree.z);
      m.scale(new THREE.Vector3(1, 0.7, 1));
      fronds.setMatrixAt(i, m);
      m.identity();
    });
  }
  scene.add(trunks);
  scene.add(fronds);

  // Neon billboards.
  for (const sign of state.city.signs) {
    const tex = signTexture(sign.text, sign.color);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sign.w, sign.h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }),
    );
    mesh.position.set(sign.x, sign.y, sign.z);
    scene.add(mesh);
  }

  // Golden Token: spinning gold torus with a glow sprite.
  const tokenGroup = new THREE.Group();
  const tokenMesh = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.42, 10, 20),
    new THREE.MeshLambertMaterial({ color: 0xffc93c, emissive: 0xa87800, emissiveIntensity: 0.9 }),
  );
  tokenMesh.castShadow = true;
  tokenGroup.add(tokenMesh);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false }));
  glow.scale.set(7, 7, 1);
  tokenGroup.add(glow);
  tokenGroup.position.set(state.token.x, 1.6, state.token.z);
  scene.add(tokenGroup);

  // Mission beacon: a glowing column + a bouncing arrow over the target.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd24d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 34, 16, 1, true), beaconMat);
  scene.add(beacon);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd24d }),
  );
  arrow.rotation.x = Math.PI;
  scene.add(arrow);

  // Vehicles and people.
  const carMeshes = new Map();
  function addCarMesh(car) {
    const built = makeCarMesh(car.color, car.kind === 'police');
    built.group.position.set(car.x, 0.05, car.z);
    built.group.rotation.y = car.heading;
    scene.add(built.group);
    carMeshes.set(car.id, built);
    return built;
  }
  for (const car of state.cars) addCarMesh(car);
  const playerBuilt = makePedMesh(0xd83a3a, true);
  scene.add(playerBuilt.group);
  const pedMeshes = new Map();
  state.peds.forEach((ped, i) => {
    const built = makePedMesh(ped.color, false);
    built.group.position.set(ped.x, 0.05, ped.z);
    scene.add(built.group);
    pedMeshes.set(i, built);
  });

  // ---- camera state ----
  let camYaw = Math.PI;
  let camDist = 10;
  let camHeight = 4.2;
  let mode = 'title';
  let shotName = 'start';
  let cinematicT = 0;
  // Previous player position, for the per-frame velocity in updateCamera.
  let prevPx = state.player.x;
  let prevPz = state.player.z;

  const tmpTarget = new THREE.Vector3();
  const tmpPos = new THREE.Vector3();

  function setCameraMode(next, opts) {
    mode = next;
    if (opts && opts.shot) shotName = opts.shot;
  }
  function applyOrbit(dx, dy, wheel) {
    camYaw += dx * 0.005;
    camHeight = Math.max(2.2, Math.min(9, camHeight + dy * 0.02));
    if (wheel) camDist = Math.max(6, Math.min(18, camDist + wheel * 1.2));
  }
  function cameraYaw() {
    return camYaw;
  }

  function updateCamera(dt) {
    const p = state.player;
    // Player velocity this frame, for the chase-camera follow gate below.
    const vx = dt > 0 ? (p.x - prevPx) / dt : 0;
    const vz = dt > 0 ? (p.z - prevPz) / dt : 0;
    prevPx = p.x;
    prevPz = p.z;
    const velSpeed = Math.hypot(vx, vz);
    // How much of the motion is forward relative to the camera (1 = straight
    // ahead, 0 = sideways, -1 = backwards).
    const forwardDot = velSpeed > 0.01
      ? (vx * Math.sin(camYaw) + vz * Math.cos(camYaw)) / velSpeed
      : 0;
    if (mode === 'title') {
      cinematicT += dt;
      const a = cinematicT * 0.045;
      const r = 170;
      camera.position.set(Math.sin(a) * r, 46 + Math.sin(cinematicT * 0.11) * 6, Math.cos(a) * r);
      camera.lookAt(0, 10, 0);
      return;
    }
    if (mode === 'shot') {
      if (shotName === 'start') {
        const a = 0.6;
        camera.position.set(Math.sin(a) * 170, 48, Math.cos(a) * 170);
        camera.lookAt(0, 10, 0);
      } else {
        // Chase framing behind the player or their car.
        const back = p.onFoot ? 10 : 13;
        const h = p.onFoot ? 4.4 : 5.6;
        const fx = Math.sin(p.heading);
        const fz = Math.cos(p.heading);
        camera.position.set(p.x - fx * back, h, p.z - fz * back);
        camera.lookAt(p.x + fx * 5, 1.6, p.z + fz * 5);
      }
      return;
    }
    // Chase camera: ease behind the player's heading, plus the mouse orbit.
    // (camYaw == heading puts the camera behind the player, looking along
    // their facing; heading + PI would put it in front, facing them.)
    // The swing is gated on moving forward relative to the camera: if the
    // camera chased the heading while the player strafed, the wish would
    // rotate under their keys and they would walk in circles instead of
    // strafing straight. While strafing or reversing the camera holds still.
    const wantYaw = p.heading;
    let diff = wantYaw - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (velSpeed > 0.5 && forwardDot > 0.5) {
      camYaw += diff * Math.min(1, dt * 2.2);
    }
    const dist = p.onFoot ? 9.5 : 13;
    const height = p.onFoot ? 4.2 : 5.5;
    camDist += (dist - camDist) * Math.min(1, dt * 3);
    camHeight += (height - camHeight) * Math.min(1, dt * 3);
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    tmpPos.set(p.x - fx * camDist, camHeight, p.z - fz * camDist);
    camera.position.lerp(tmpPos, 1 - Math.exp(-dt * 7));
    tmpTarget.set(p.x + fx * 4, 1.6, p.z + fz * 4);
    camera.lookAt(tmpTarget);
  }

  function sync(dt) {
    const p = state.player;
    // Vehicles: add meshes for police cars that spawned after boot.
    for (const car of state.cars) {
      let built = carMeshes.get(car.id);
      if (!built) built = addCarMesh(car);
      built.group.position.set(car.x, 0.05, car.z);
      built.group.rotation.y = car.heading;
      for (const wheel of built.wheels) wheel.rotation.x = car.wheelSpin;
      if (built.barRed && built.barBlue) {
        const on = Math.floor(state.time * 4) % 2 === 0;
        built.barRed.visible = on;
        built.barBlue.visible = !on;
      }
    }
    // Remove meshes of despawned police cars.
    for (const [id, built] of carMeshes) {
      if (!state.cars.some((c) => c.id === id)) {
        scene.remove(built.group);
        carMeshes.delete(id);
      }
    }
    // Player figure (hidden while driving; the car is the player then).
    playerBuilt.group.visible = p.onFoot;
    if (p.onFoot) {
      playerBuilt.group.position.set(p.x, 0.05, p.z);
      playerBuilt.group.rotation.y = p.heading;
      const swing = p.moving ? Math.sin(p.walkPhase) * 0.55 : 0;
      playerBuilt.legL.rotation.x = swing;
      playerBuilt.legR.rotation.x = -swing;
      if (p.danceTimer > 0) {
        // The Under Arrest dance: arms up in the Bicep Heart, little bounce.
        playerBuilt.group.position.y = 0.05 + Math.abs(Math.sin(state.time * 6)) * 0.35;
        playerBuilt.group.rotation.y = p.heading + Math.sin(state.time * 3) * 0.4;
        if (playerBuilt.armL) playerBuilt.armL.rotation.z = 2.4;
        if (playerBuilt.armR) playerBuilt.armR.rotation.z = -2.4;
      } else {
        if (playerBuilt.armL) playerBuilt.armL.rotation.z = 0.12;
        if (playerBuilt.armR) playerBuilt.armR.rotation.z = -0.12;
        if (p.punchTimer > 0 && playerBuilt.armR) playerBuilt.armR.rotation.x = -1.4;
        else if (playerBuilt.armR) playerBuilt.armR.rotation.x = 0;
      }
    }
    state.peds.forEach((ped, i) => {
      const built = pedMeshes.get(i);
      if (!built) return;
      built.group.position.set(ped.x, 0.05, ped.z);
      built.group.rotation.y = ped.heading;
      const swing = ped.downTimer > 0 ? 0 : Math.sin(ped.walkPhase) * 0.45;
      built.legL.rotation.x = swing;
      built.legR.rotation.x = -swing;
      if (ped.downTimer > 0) built.group.rotation.z = Math.PI / 2;
      else built.group.rotation.z = 0;
    });
    // Token spin; hidden once taken.
    tokenGroup.visible = !state.token.taken;
    tokenMesh.rotation.y += dt * 1.6;
    tokenGroup.position.y = 1.6 + Math.sin(state.time * 2) * 0.25;
    // Mission beacon over the current target.
    const target = getMissionTarget();
    if (target && !state.won) {
      beacon.visible = true;
      arrow.visible = true;
      beacon.position.set(target.x, 17, target.z);
      arrow.position.set(target.x, 12 + Math.sin(state.time * 3) * 0.8, target.z);
    } else {
      beacon.visible = false;
      arrow.visible = false;
    }
    // The low sun follows the player so shadows stay close.
    sun.position.set(p.x + 90, 90, p.z - 70);
    sun.target.position.set(p.x, 0, p.z);
    updateCamera(dt);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function render() {
    renderer.render(scene, camera);
  }

  resize();
  window.addEventListener('resize', resize);
  return {
    sync, render, resize, setCameraMode, applyOrbit, cameraYaw,
    get camera() {
      return camera;
    },
  };
}
