'use strict';
/* 3D farm scene — Three.js global build, low-poly procedural, zero assets.
 * World.init() / World.updateCrops(state) / World.setWeather(id) / World.pickPlot(x,y)
 * game.js drives; this file owns the scene and meshes. */

const World = (() => {
  let scene, camera, renderer, raycaster;
  let sun;
  let soilMeshes = [];
  let cropRoots = [];
  let timeOfDay = 0.3;
  const TILE = 2.4;

  function M(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: .9, flatShading: true });
  }

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x9fd4e8);
    scene.fog = new THREE.Fog(0x9fd4c8, 35, 95);

    camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, .1, 300);
    camera.position.set(13, 12, 15);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x3d5a3d, .9));
    sun = new THREE.DirectionalLight(0xfff2cc, 1.2);
    sun.position.set(12, 20, 8);
    sun.castShadow = true;
    scene.add(sun);

    const grass = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 60), M(0x6fbf5f));
    grass.position.y = -0.5; grass.receiveShadow = true;
    scene.add(grass);
    ground = grass; // expose to setSeason

    buildDecor();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.id = 'c3d';
    document.body.prepend(renderer.domElement);
    raycaster = new THREE.Raycaster();

    for (let i = 0; i < GRID; i++) {
      const gx = (i % 5) - 2, gz = Math.floor(i / 5) - 1.5;
      const g = new THREE.Group();
      g.position.set(gx * TILE, 0, gz * TILE);
      const soil = new THREE.Mesh(new THREE.BoxGeometry(1.9, .35, 1.9), M(0x6b4a2f));
      soil.position.y = .17;
      soil.receiveShadow = true;
      soil.userData.plotIndex = i;
      g.add(soil);
      const holder = new THREE.Group();
      holder.position.y = .35;
      g.add(holder);
      scene.add(g);
      soilMeshes.push(soil);
      cropRoots.push(holder);
    }
    addEventListener('resize', () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    });
    animate();
  }

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color));
    m.position.set(x, y, z); m.castShadow = true;
    scene.add(m); return m;
  }
  let ground; // ref for season tint
  function buildDecor() {
    // barn
    box(6, 3.4, 4, 0xb0442f, -8, 1.7, -14);                       // barn
    const roof = box(7, .4, 4.6, 0x7a3524, -8, 3.7, -14);
    roof.rotation.x = .5;
    box(1.6, 2.4, .2, 0x5a3a26, -8, 1.2, -11.9);                  // door
    [[10, -12], [-14, 4], [13, 5], [12, 8], [-13, -6], [-11, -11]].forEach(([x, z]) => {
      box(.7, 2.6, .7, 0x6b4a2f, x, 1.3, z);                      // trunk
      box(2.6, 2.2, 2.2, 0x2f8f4f, x, 3.4, z);                    // crown
    });
    for (let x = -16; x <= 16; x += 2) {                          // fence
      if (Math.abs(x) > 3) {
        box(.18, 1.1, .18, 0x9a7444, x, .5, 13);
        box(2, .12, .12, 0xb08a55, x, .7, 13.8);
      }
    }
  }

  // ===== Crop builders — stage: 0=sprout, 1=growing, 2=ripe =====
  function stemMesh(h) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, h, 5), M(0x3d8a3d));
    s.position.y = h / 2; return s;
  }
  function cropVeg(color, stage, r) {
    const g = new THREE.Group();
    const h = .32 + stage * .26;
    g.add(stemMesh(h));
    if (stage >= 1) {
      const lv = new THREE.Mesh(new THREE.ConeGeometry(.2, .5, 4), M(0x3da24a));
      lv.position.y = h + .16; g.add(lv);
    }
    if (stage >= 2 && r) {
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 6), M(color));
      fruit.position.y = h + .48; fruit.castShadow = true;
      g.add(fruit);
    }
    return g;
  }
  function cropTall(color, stage) {
    const g = new THREE.Group();
    const h = .7 + stage * .5;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, h, 5), M(0x4a9a3a));
    stalk.position.y = h / 2; g.add(stalk);
    if (stage >= 2) {
      const cob = new THREE.Mesh(new THREE.CapsuleGeometry(.16, .5, 3, 6), M(color));
      cob.position.y = h + .32; cob.castShadow = true;
      g.add(cob);
    }
    return g;
  }
  function cropMelon(stage) {
    const g = new THREE.Group();
    const h = .7 + stage * .4;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(.07, .09, h, 5), M(0x4a9a3a));
    stalk.position.y = h / 2; g.add(stalk);
    const lv = new THREE.Mesh(new THREE.ConeGeometry(.28, .65, 5), M(0x3da24a));
    lv.position.y = h + .18; g.add(lv);
    if (stage >= 2) {
      const mel = new THREE.Mesh(new THREE.SphereGeometry(.55, 8, 6), M(0x2f9a4f));
      mel.position.y = h + .02; mel.scale.y = .8; mel.castShadow = true;
      g.add(mel);
    }
    return g;
  }
  function cropDragon(stage) {
    const g = new THREE.Group();
    const h = 1.1 + stage * .3;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, h, 5), M(0x4a9a3a));
    s.position.y = .5; g.add(s);
    if (stage >= 2) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.4, 7, 6), M(0xe84a8f));
      f.scale.set(1, 1.5, 1); f.position.y = h + .2; f.castShadow = true;
      g.add(f);
    } else if (stage >= 1) {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 5), M(0xe84a8f));
      bud.position.y = .9; g.add(bud);
    }
    return g;
  }
  function cropRose(stage) {
    const g = new THREE.Group();
    g.add(stemMesh(.8));
    const bud = new THREE.Mesh(new THREE.ConeGeometry(.22, .5, 6), M(0xf5c542));
    bud.position.y = .88; g.add(bud);
    if (stage >= 2) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(.33, 6, 5), M(0xff5f9e));
      flower.position.y = 1.12; g.add(flower);
    }
    return g;
  }
  function cropCactus(stage) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.25, .7 + stage * .4, 3, 6), M(0x4f8f4f));
    body.position.y = .5 + stage * .35; body.castShadow = true; g.add(body);
    if (stage >= 2) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(.18, 6, 5), M(0xff5f9e));
      flower.position.y = body.position.y + .6; flower.castShadow = true;
      g.add(flower);
    }
    return g;
  }
  function cropStar(stage) {
    const g = new THREE.Group();
    g.add(stemMesh(.7 + stage * .3));
    if (stage >= 2) {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(.42), M(0xffe066));
      star.position.y = 1.1 + stage * .2;
      star.name = 'starfruit'; star.castShadow = true;
      g.add(star);
    }
    return g;
  }

  const CROP_BUILDERS = {
    carrot:     (s) => cropVeg(0xff8c3a, s, .45),
    tomato:     (s) => cropVeg(0xe0453a, s, .6),
    corn:       (s) => cropTall(0xf2d54e, s),
    pumpkin:    (s) => cropVeg(0xe8872a, s, .55),
    strawberry: (s) => cropVeg(0xe84a5f, s, .3),
    watermelon: (s) => cropMelon(s),
    grape:      (s) => cropVeg(0x9a4fd0, s, .35),
    dragon:     (s) => cropDragon(s),
    goldenrose: (s) => cropRose(s),
    cactus:     (s) => cropCactus(s),
    star:       (s) => cropStar(s),
  };

  // ===== Public API =====
  function growthStage(p) {
    // 0 = sprout, 1 = growing, 2 = ripe/harvest
    if (!ready(p)) {
      const pct = growth(p);
      return pct < .4 ? 0 : 1;
    }
    return 2;
  }

  function updateCrops(state) {
    const st = state || S;
    for (let i = 0; i < GRID; i++) {
      const p = st.plots[i], root = cropRoots[i];
      const stage = p ? growthStage(p) : -1;
      const key = p ? p.type + '-' + stage : '';
      if (root.dataset.key !== key) {
        root.clear();
        root.dataset.key = key;
        if (p && p.type) root.add(CROP_BUILDERS[p.type](stage));
      }
      const soil = soilMeshes[i];
      const locked = i >= st.unlocked;
      soil.material.color.setHex(locked ? 0x3a4a3e : (p && p.watered ? 0x4a3120 : 0x6b4a2f));
    }
  }

  function pickPlot(clientX, clientY) {
    const ndc = new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(soilMeshes, false);
    return hits.length ? hits[0].object.userData.plotIndex : null;
  }

  let orbit = 0.7, orbitDist = 24, orbitDragging = false, lx = 0;
  // ===== Controls: right-drag orbit, wheel zoom =====
  function enableControls() {
    const el = renderer.domElement;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      if (e.button === 2) { orbitDragging = true; lx = e.clientX; }
    });
    addEventListener('pointerup', () => { orbitDragging = false; });
    addEventListener('pointermove', e => {
      if (orbitDragging) { orbit += (e.clientX - lx) * .005; lx = e.clientX; }
    });
    el.addEventListener('wheel', e => {
      orbitDist = Math.max(8, Math.min(45, orbitDist + e.deltaY * .02));
    }, { passive: true });
  }

  let last = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(.1, (performance.now() - last) / 1000); last = performance.now();
    timeOfDay = (timeOfDay + dt / 330) % 1;   // full day ≈ 5.5 min
    setTime(timeOfDay);
    // star fruit: slow spin when present
    cropRoots.forEach(root => {
      const star = root.children.find(c => c.name === 'starfruit');
      if (star) star.rotation.y += dt * 1.5;
    });
    camera.position.set(Math.sin(orbit) * orbitDist, 12, Math.cos(orbit) * orbitDist);
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  function setWeather(id) {
    const sky = { sun: 0x9fd4e8, rain: 0x7a8fa0, heat: 0xe8c07a, storm: 0x4a5568 }[id] || 0x9fd4e8;
    scene.background.set(sky);
    scene.fog.color.set(sky);
    sun.intensity = id === 'sun' ? 1.2 : id === 'heat' ? 1.5 : .6;
  }

  function setTime(t) {
    const a = t * Math.PI * 2 - Math.PI / 2;
    sun.position.set(Math.cos(a) * 25, Math.sin(a) * 25 + 2, 8);
    const day = Math.max(0, Math.sin(t * Math.PI * 2 - Math.PI / 2) * .5 + .5);
    sun.intensity = .25 + day * 1.1;
    scene.background.setHSL(.55, .45, .2 + day * .45);
  }

  return { init, enableControls, updateCrops, setWeather, pickPlot };
})();
