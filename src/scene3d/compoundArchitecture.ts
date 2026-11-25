import * as THREE from 'three';
import { CompoundTextureLibrary } from './pbrTextures';
import { groundHeightAt } from './terrain';

function buildJerrycan(yellowTone: string, dustCoat = false): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'YellowJerrycan20L';

  // Sculpted beveled HDPE body
  const shape = new THREE.Shape();
  const w = 0.25;
  const d = 0.19;
  const r = 0.03;
  shape.moveTo(-w * 0.5 + r, -d * 0.5);
  shape.lineTo(w * 0.5 - r, -d * 0.5);
  shape.quadraticCurveTo(w * 0.5, -d * 0.5, w * 0.5, -d * 0.5 + r);
  shape.lineTo(w * 0.5, d * 0.5 - r);
  shape.quadraticCurveTo(w * 0.5, d * 0.5, w * 0.5 - r, d * 0.5);
  shape.lineTo(-w * 0.5 + r, d * 0.5);
  shape.quadraticCurveTo(-w * 0.5, d * 0.5, -w * 0.5, d * 0.5 - r);
  shape.lineTo(-w * 0.5, -d * 0.5 + r);
  shape.quadraticCurveTo(-w * 0.5, -d * 0.5, -w * 0.5 + r, -d * 0.5);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.34,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.014,
    bevelSegments: 3,
  });
  bodyGeo.rotateX(-Math.PI / 2);

  const plasticMat = new THREE.MeshStandardMaterial({
    color: yellowTone,
    roughness: 0.42,
    metalness: 0.02,
  });

  const body = new THREE.Mesh(bodyGeo, plasticMat);
  body.position.y = 0.018;
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  // Molded horizontal stiffening ribs
  const ribGeo = new THREE.BoxGeometry(w + 0.032, 0.014, d + 0.032);
  for (const ry of [0.13, 0.25]) {
    const rib = new THREE.Mesh(ribGeo, plasticMat);
    rib.position.y = ry;
    rib.castShadow = true;
    grp.add(rib);
  }

  // Top shoulder slope + integrated grip bar
  const topShoulder = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.06, 0.14),
    plasticMat
  );
  topShoulder.position.set(-0.04, 0.38, 0);
  topShoulder.castShadow = true;
  grp.add(topShoulder);

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.13, 10),
    plasticMat
  );
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0.055, 0.405, 0);
  handleBar.castShadow = true;
  grp.add(handleBar);

  // Threaded spout & dark HDPE screw cap
  const capMat = new THREE.MeshStandardMaterial({
    color: '#1e1d1b',
    roughness: 0.52,
    metalness: 0.04,
  });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.032, 14), capMat);
  cap.position.set(-0.065, 0.415, 0);
  cap.castShadow = true;
  grp.add(cap);

  if (dustCoat) {
    const dustRing = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.03, 0.045, d + 0.03),
      new THREE.MeshStandardMaterial({
        color: '#8f523a',
        roughness: 0.96,
        transparent: true,
        opacity: 0.42,
      })
    );
    dustRing.position.y = 0.024;
    grp.add(dustRing);
  }

  return grp;
}

function buildClayWaterPot(): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'EnsuwaClayPot';

  const profile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.11, 0.01),
    new THREE.Vector2(0.21, 0.14),
    new THREE.Vector2(0.23, 0.25),
    new THREE.Vector2(0.16, 0.36),
    new THREE.Vector2(0.105, 0.43),
    new THREE.Vector2(0.135, 0.47),
    new THREE.Vector2(0.12, 0.49),
    new THREE.Vector2(0.095, 0.45),
    new THREE.Vector2(0.09, 0.36),
  ];
  const geo = new THREE.LatheGeometry(profile, 28);
  const potMat = new THREE.MeshStandardMaterial({
    color: '#6e3422',
    roughness: 0.86,
    metalness: 0.02,
  });
  const pot = new THREE.Mesh(geo, potMat);
  pot.castShadow = true;
  pot.receiveShadow = true;
  grp.add(pot);

  // Subtle dark soot/moisture band around lower belly
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.228, 0.215, 0.08, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: '#3f2017',
      roughness: 0.94,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    })
  );
  band.position.y = 0.18;
  grp.add(band);

  // Wooden calabash / lid disk
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145, 0.135, 0.018, 20),
    new THREE.MeshStandardMaterial({ color: '#8f6942', roughness: 0.84 })
  );
  lid.position.y = 0.498;
  lid.castShadow = true;
  grp.add(lid);

  return grp;
}

function buildWoodenStool(tex: CompoundTextureLibrary): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'AkatebeWoodenStool';
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.timberAlbedo,
    normalMap: tex.timberNormal,
    roughness: 0.78,
    metalness: 0.02,
  });

  // Dish-carved circular seat
  const seatPts = [
    new THREE.Vector2(0.0, 0.255),
    new THREE.Vector2(0.15, 0.262),
    new THREE.Vector2(0.195, 0.275),
    new THREE.Vector2(0.20, 0.235),
    new THREE.Vector2(0.0, 0.235),
  ];
  const seat = new THREE.Mesh(new THREE.LatheGeometry(seatPts, 24), woodMat);
  seat.castShadow = true;
  seat.receiveShadow = true;
  grp.add(seat);

  // Three slightly splayed legs
  const legGeo = new THREE.CylinderGeometry(0.022, 0.017, 0.26, 10);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const leg = new THREE.Mesh(legGeo, woodMat);
    leg.position.set(Math.cos(a) * 0.125, 0.125, Math.sin(a) * 0.125);
    leg.rotation.z = -Math.cos(a) * 0.14;
    leg.rotation.x = Math.sin(a) * 0.14;
    leg.castShadow = true;
    grp.add(leg);
  }
  return grp;
}

function buildCharcoalSigiri(): THREE.Group {
  const grp = new THREE.Group();
  grp.name = 'CharcoalSigiriStove';

  const metalMat = new THREE.MeshStandardMaterial({
    color: '#46494c',
    roughness: 0.58,
    metalness: 0.65,
  });

  const bodyPts = [
    new THREE.Vector2(0.11, 0.0),
    new THREE.Vector2(0.115, 0.09),
    new THREE.Vector2(0.095, 0.11),
    new THREE.Vector2(0.155, 0.24),
    new THREE.Vector2(0.145, 0.245),
    new THREE.Vector2(0.09, 0.12),
    new THREE.Vector2(0.0, 0.12),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 20), metalMat);
  body.castShadow = true;
  body.receiveShadow = true;
  grp.add(body);

  // Dark ash bed inside upper bowl
  const ash = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.09, 0.025, 16),
    new THREE.MeshStandardMaterial({ color: '#2b2928', roughness: 0.96 })
  );
  ash.position.y = 0.15;
  grp.add(ash);

  // Three forged pot-rest prongs around rim
  const prongGeo = new THREE.BoxGeometry(0.032, 0.024, 0.016);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const prong = new THREE.Mesh(prongGeo, metalMat);
    prong.position.set(Math.cos(a) * 0.135, 0.252, Math.sin(a) * 0.135);
    prong.rotation.y = -a;
    prong.castShadow = true;
    grp.add(prong);
  }

  return grp;
}

function buildWindowUnit(tex: CompoundTextureLibrary): THREE.Group {
  const grp = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({
    map: tex.timberAlbedo,
    normalMap: tex.timberNormal,
    roughness: 0.72,
    metalness: 0.04,
  });
  const ironMat = new THREE.MeshStandardMaterial({
    color: '#222427',
    roughness: 0.45,
    metalness: 0.72,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#1b262c',
    roughness: 0.08,
    metalness: 0.18,
    envMapIntensity: 1.4,
  });

  // Recessed glass backing pane
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.05), glassMat);
  pane.position.z = 0.015;
  grp.add(pane);

  // Timber frame surround + protruding sloped cement sill
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.12), woodMat);
  topBar.position.set(0, 0.54, 0.05);
  topBar.castShadow = true;
  grp.add(topBar);

  const sill = new THREE.Mesh(
    new THREE.BoxGeometry(1.36, 0.07, 0.18),
    new THREE.MeshStandardMaterial({ color: '#8f8980', roughness: 0.9 })
  );
  sill.position.set(0, -0.55, 0.07);
  sill.castShadow = true;
  sill.receiveShadow = true;
  grp.add(sill);

  for (const sx of [-0.61, 0, 0.61]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.065, 1.08, 0.11), woodMat);
    post.position.set(sx, 0, 0.05);
    post.castShadow = true;
    grp.add(post);
  }

  // Ugandan wrought-iron security burglar bars (vertical & horizontal grid)
  for (const bx of [-0.42, -0.21, 0.21, 0.42]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.04, 8), ironMat);
    bar.position.set(bx, 0, 0.055);
    grp.add(bar);
  }
  for (const by of [-0.26, 0.26]) {
    const hbar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.18, 8), ironMat);
    hbar.rotation.z = Math.PI / 2;
    hbar.position.set(0, by, 0.055);
    grp.add(hbar);
  }

  return grp;
}

export function buildCompoundArchitecture(
  tex: CompoundTextureLibrary,
  maxAnisotropy = 8
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'UgandanCompoundArchitecture';
  const extraTextures: THREE.Texture[] = [];
  root.userData.__extraTextures = extraTextures;
  root.userData.__disposed = false;

  // Clone repeating textures cleanly per scale
  const plasterMap = tex.plasterAlbedo.clone();
  plasterMap.repeat.set(2.4, 1);
  plasterMap.needsUpdate = true;
  const plasterNorm = tex.plasterNormal.clone();
  plasterNorm.repeat.set(2.4, 1);
  plasterNorm.needsUpdate = true;

  const brickMap = tex.brickAlbedo.clone();
  brickMap.repeat.set(5, 1.4);
  brickMap.needsUpdate = true;
  const brickNorm = tex.brickNormal.clone();
  brickNorm.repeat.set(5, 1.4);
  brickNorm.needsUpdate = true;
  const brickRough = tex.brickRoughness.clone();
  brickRough.repeat.set(5, 1.4);
  brickRough.needsUpdate = true;

  const mabatiMap = tex.mabatiAlbedo.clone();
  mabatiMap.repeat.set(6, 2.5);
  mabatiMap.needsUpdate = true;
  const mabatiNorm = tex.mabatiNormal.clone();
  mabatiNorm.repeat.set(6, 2.5);
  mabatiNorm.needsUpdate = true;
  const mabatiRough = tex.mabatiRoughness.clone();
  mabatiRough.repeat.set(6, 2.5);
  mabatiRough.needsUpdate = true;

  const plasterMat = new THREE.MeshStandardMaterial({
    map: plasterMap,
    normalMap: plasterNorm,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.88,
    metalness: 0.02,
  });

  const screedMat = new THREE.MeshStandardMaterial({
    color: '#7d7770',
    normalMap: tex.murramNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughness: 0.86,
    metalness: 0.03,
  });

  const verandaDeckMat = new THREE.MeshStandardMaterial({
    color: '#888279',
    normalMap: tex.murramNormal,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.84,
    metalness: 0.03,
  });

  const verandaStepMat = new THREE.MeshStandardMaterial({
    color: '#857f76',
    normalMap: tex.murramNormal,
    normalScale: new THREE.Vector2(0.26, 0.26),
    roughness: 0.86,
    metalness: 0.03,
  });

  const verandaPlinthMat = new THREE.MeshStandardMaterial({
    color: '#827c74',
    normalMap: tex.murramNormal,
    normalScale: new THREE.Vector2(0.24, 0.24),
    roughness: 0.86,
    metalness: 0.03,
  });

  // Apply the extracted Playground surface finish ONLY onto the veranda deck, steps & column plinths
  const aniso = Math.min(16, Math.max(1, maxAnisotropy));
  new THREE.TextureLoader().load(
    '/assets/textures/veranda_surface.jpg',
    (baseTex) => {
      if (root.userData.__disposed) {
        baseTex.dispose();
        return;
      }
      baseTex.wrapS = THREE.RepeatWrapping;
      baseTex.wrapT = THREE.RepeatWrapping;
      baseTex.colorSpace = THREE.SRGBColorSpace;
      baseTex.anisotropy = aniso;
      baseTex.repeat.set(3.2, 4.9);
      baseTex.needsUpdate = true;

      const stepTex = baseTex.clone();
      stepTex.repeat.set(0.55, 1.45);
      stepTex.needsUpdate = true;

      const plinthTex = baseTex.clone();
      plinthTex.repeat.set(0.45, 0.45);
      plinthTex.needsUpdate = true;

      extraTextures.push(baseTex, stepTex, plinthTex);

      verandaDeckMat.map = baseTex;
      verandaDeckMat.color.set('#ebe5db');
      verandaDeckMat.needsUpdate = true;

      verandaStepMat.map = stepTex;
      verandaStepMat.color.set('#e6e0d5');
      verandaStepMat.needsUpdate = true;

      verandaPlinthMat.map = plinthTex;
      verandaPlinthMat.color.set('#dfd8ce');
      verandaPlinthMat.needsUpdate = true;
    },
    undefined,
    () => {
      // Retain screed fallback if texture is unavailable
    }
  );

  const timberMat = new THREE.MeshStandardMaterial({
    map: tex.timberAlbedo,
    normalMap: tex.timberNormal,
    roughness: 0.78,
    metalness: 0.02,
  });

  const mabatiMat = new THREE.MeshStandardMaterial({
    map: mabatiMap,
    normalMap: mabatiNorm,
    normalScale: new THREE.Vector2(1.4, 1.4),
    roughnessMap: mabatiRough,
    roughness: 0.62,
    metalness: 0.76,
    side: THREE.DoubleSide,
  });

  const brickMat = new THREE.MeshStandardMaterial({
    map: brickMap,
    normalMap: brickNorm,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughnessMap: brickRough,
    roughness: 0.9,
    metalness: 0.02,
  });

  // =========================================================================
  // 1. UGANDAN HOMESTEAD HOUSE & VERANDA (West side: x in [-9.6, -4.5], z in [-5.6, 2.2])
  // =========================================================================
  const house = new THREE.Group();
  house.name = 'HomesteadHouseAndVeranda';
  const baseGroundY = groundHeightAt(-5.4, -1.7);

  // Raised concrete-screed veranda deck + house floor foundation
  const verandaDeck = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.42, 8.0), verandaDeckMat);
  verandaDeck.position.set(-7.1, baseGroundY + 0.09, -1.7);
  verandaDeck.receiveShadow = true;
  verandaDeck.castShadow = true;
  house.add(verandaDeck);

  // Dark waterproof cement skirting apron around veranda edge
  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(5.26, 0.11, 8.06),
    new THREE.MeshStandardMaterial({ color: '#58534e', roughness: 0.92 })
  );
  apron.position.set(-7.1, baseGroundY - 0.04, -1.7);
  apron.receiveShadow = true;
  house.add(apron);

  // Broad concrete steps stepping down onto murram courtyard
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 2.1), verandaStepMat);
  step1.position.set(-4.35, baseGroundY + 0.06, -1.5);
  step1.castShadow = true;
  step1.receiveShadow = true;
  house.add(step1);

  const step2 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.09, 2.2), verandaStepMat);
  step2.position.set(-4.1, baseGroundY + 0.01, -1.5);
  step2.castShadow = true;
  step2.receiveShadow = true;
  house.add(step2);

  // Main Homestead Plastered Block
  const mainBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.95, 7.6), plasterMat);
  mainBody.position.set(-8.0, baseGroundY + 0.3 + 1.475, -1.7);
  mainBody.castShadow = true;
  mainBody.receiveShadow = true;
  house.add(mainBody);

  // Dark painted splash skirting along bottom of plaster house wall
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(3.43, 0.24, 7.63),
    new THREE.MeshStandardMaterial({ color: '#53372c', roughness: 0.92 })
  );
  skirt.position.set(-8.0, baseGroundY + 0.3 + 0.12, -1.7);
  skirt.receiveShadow = true;
  house.add(skirt);

  // Front Hardwood Panel Door (centered toward steps)
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.12, 1.06), timberMat);
  doorFrame.position.set(-6.28, baseGroundY + 0.3 + 1.06, -1.5);
  doorFrame.castShadow = true;
  house.add(doorFrame);

  const doorLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 2.04, 0.94),
    new THREE.MeshStandardMaterial({
      map: tex.timberAlbedo,
      normalMap: tex.timberNormal,
      color: '#8f603e',
      roughness: 0.68,
    })
  );
  doorLeaf.position.set(-6.25, baseGroundY + 0.3 + 1.02, -1.5);
  house.add(doorLeaf);

  const doorHandle = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#c49d46', roughness: 0.28, metalness: 0.85 })
  );
  doorHandle.position.set(-6.21, baseGroundY + 0.3 + 0.98, -1.86);
  house.add(doorHandle);

  // Two Kampala Recessed Security-Barred Windows facing courtyard
  for (const wz of [-3.95, 0.65]) {
    const win = buildWindowUnit(tex);
    win.rotation.y = Math.PI / 2;
    win.position.set(-6.29, baseGroundY + 0.3 + 1.55, wz);
    house.add(win);
  }

  // Veranda Support Columns (concrete bases + turned timber posts + header beam)
  const beamY = baseGroundY + 0.3 + 2.48;
  for (const pz of [-5.25, -2.65, -0.35, 1.85]) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.34, 0.24), verandaPlinthMat);
    plinth.position.set(-4.72, baseGroundY + 0.3 + 0.17, pz);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    house.add(plinth);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 2.15, 12), timberMat);
    post.position.set(-4.72, baseGroundY + 0.3 + 0.34 + 1.075, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    house.add(post);
  }

  const headerBeam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 7.6), timberMat);
  headerBeam.position.set(-4.72, beamY, -1.7);
  headerBeam.castShadow = true;
  house.add(headerBeam);

  // Exposed Eucalyptus Rafters under veranda eaves
  for (let rz = -5.4; rz <= 2.1; rz += 0.68) {
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.06), timberMat);
    rafter.position.set(-5.45, beamY + 0.16, rz);
    rafter.rotation.z = -0.22;
    rafter.castShadow = true;
    house.add(rafter);
  }

  // Pitched Corrugated Mabati Galvanized Iron Roof (sloping forward from house peak over veranda)
  const roofMain = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.045, 8.35), mabatiMat);
  roofMain.position.set(-6.95, baseGroundY + 3.22, -1.7);
  roofMain.rotation.z = -0.23;
  roofMain.castShadow = true;
  roofMain.receiveShadow = true;
  house.add(roofMain);

  // Dark fascia board along the front drip edge + rainwater gutter
  const fascia = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.16, 8.36),
    new THREE.MeshStandardMaterial({ color: '#4c3424', roughness: 0.8 })
  );
  fascia.position.set(-4.12, baseGroundY + 2.52, -1.7);
  fascia.castShadow = true;
  house.add(fascia);

  const gutterMat = new THREE.MeshStandardMaterial({
    color: '#888c8f',
    roughness: 0.48,
    metalness: 0.68,
  });
  const gutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 8.38, 12, 1, false, 0, Math.PI),
    gutterMat
  );
  gutter.rotation.x = Math.PI / 2;
  gutter.rotation.z = Math.PI;
  gutter.position.set(-4.04, baseGroundY + 2.45, -1.7);
  house.add(gutter);

  // Rainwater downpipe at front corner of veranda
  const downpipe = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 2.38, 10), gutterMat);
  downpipe.position.set(-4.1, baseGroundY + 1.24, 2.25);
  downpipe.castShadow = true;
  house.add(downpipe);

  // Woven Papyrus Mat + Akatebe Stool + Ensuwa Water Pot + Charcoal Sigiri on shaded veranda
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.014, 2.3),
    new THREE.MeshStandardMaterial({
      map: tex.reedMatAlbedo,
      roughness: 0.9,
      metalness: 0.0,
    })
  );
  mat.position.set(-5.38, baseGroundY + 0.308, -3.2);
  mat.receiveShadow = true;
  house.add(mat);

  const stool = buildWoodenStool(tex);
  stool.position.set(-5.32, baseGroundY + 0.3, -2.55);
  house.add(stool);

  const clayPot = buildClayWaterPot();
  clayPot.position.set(-5.78, baseGroundY + 0.3, 1.35);
  house.add(clayPot);

  const sigiri = buildCharcoalSigiri();
  sigiri.position.set(-5.68, baseGroundY + 0.3, 0.35);
  house.add(sigiri);

  // Pair of Yellow 20L Jerrycans beside veranda steps on the red murram dirt
  const j1 = buildJerrycan('#d49b1a', true);
  const j1y = groundHeightAt(-4.48, 0.45);
  j1.position.set(-4.48, j1y, 0.45);
  j1.rotation.y = 0.35;
  house.add(j1);

  const j2 = buildJerrycan('#dfb12d', true);
  const j2y = groundHeightAt(-4.52, 0.82);
  j2.position.set(-4.52, j2y, 0.82);
  j2.rotation.y = -0.45;
  house.add(j2);

  root.add(house);

  // =========================================================================
  // 2. KILN-FIRED BRICK PERIMETER COMPOUND WALLS & WOODEN SLATTED GATE
  // =========================================================================
  const walls = new THREE.Group();
  walls.name = 'BrickPerimeterWalls';

  const copingMat = new THREE.MeshStandardMaterial({ color: '#8a8278', roughness: 0.88 });

  const addWallSegment = (x1: number, z1: number, x2: number, z2: number, height = 1.85) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    const midX = (x1 + x2) * 0.5;
    const midZ = (z1 + z2) * 0.5;
    const baseY = Math.min(groundHeightAt(x1, z1), groundHeightAt(x2, z2)) - 0.15;

    const segGroup = new THREE.Group();
    segGroup.position.set(midX, baseY, midZ);
    segGroup.rotation.y = angle;

    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, height + 0.15, len), brickMat);
    wallMesh.position.y = (height + 0.15) * 0.5;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    segGroup.add(wallMesh);

    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, len + 0.04), copingMat);
    cap.position.y = height + 0.18;
    cap.castShadow = true;
    cap.receiveShadow = true;
    segGroup.add(cap);

    // Brick piers every ~3.4m
    const pierCount = Math.max(2, Math.round(len / 3.4) + 1);
    for (let i = 0; i < pierCount; i++) {
      const zOff = -len * 0.5 + (i / (pierCount - 1)) * len;
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.38, height + 0.28, 0.38), brickMat);
      pier.position.set(0, (height + 0.28) * 0.5, zOff);
      pier.castShadow = true;
      pier.receiveShadow = true;
      segGroup.add(pier);

      const pierCap = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.46), copingMat);
      pierCap.position.set(0, height + 0.31, zOff);
      pierCap.castShadow = true;
      segGroup.add(pierCap);
    }

    walls.add(segGroup);
  };

  // Back brick wall framing rear of compound (z = -8.6)
  addWallSegment(-6.4, -8.6, 7.6, -8.6, 1.9);
  // Right brick wall from rear corner down to gate opening
  addWallSegment(7.6, -8.6, 7.6, 2.6, 1.85);
  // Right brick wall continuing after the compound gate
  addWallSegment(7.6, 5.1, 7.6, 9.8, 1.85);

  // Wooden & Iron Slatted Compound Gate (partially ajar at x = 7.6, z in [2.6, 5.1])
  const buildGateLeaf = (width: number) => {
    const leaf = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({
      color: '#282a2c',
      roughness: 0.48,
      metalness: 0.72,
    });
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, width), frameMat);
    topRail.position.set(0, 1.62, width * 0.5);
    leaf.add(topRail);
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, width), frameMat);
    botRail.position.set(0, 0.16, width * 0.5);
    leaf.add(botRail);

    const slats = 7;
    for (let i = 0; i < slats; i++) {
      const sz = 0.09 + (i / (slats - 1)) * (width - 0.18);
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.032, 1.48, 0.11), timberMat);
      slat.position.set(0, 0.89, sz);
      slat.castShadow = true;
      leaf.add(slat);
    }
    return leaf;
  };

  const gateY = groundHeightAt(7.6, 3.8);
  const leafA = buildGateLeaf(1.2);
  leafA.position.set(7.6, gateY, 2.65);
  leafA.rotation.y = 0.42; // Partially ajar welcoming sunlight
  walls.add(leafA);

  const leafB = buildGateLeaf(1.2);
  leafB.position.set(7.6, gateY, 5.05);
  leafB.rotation.y = Math.PI - 0.12;
  walls.add(leafB);

  root.add(walls);

  // Subtle weathered wooden garden bench tucked under the mango tree shade
  const bench = new THREE.Group();
  bench.name = 'ShadedCompoundBench';
  const bx = -3.85;
  const bz = 4.65;
  const by = groundHeightAt(bx, bz);
  bench.position.set(bx, by, bz);
  bench.rotation.y = 0.52;

  for (const lz of [-0.55, 0.55]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.08), timberMat);
    leg.position.set(0, 0.19, lz);
    leg.castShadow = true;
    leg.receiveShadow = true;
    bench.add(leg);
  }
  for (const sx of [-0.1, 0.1]) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 1.42), timberMat);
    plank.position.set(sx, 0.4, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    bench.add(plank);
  }
  root.add(bench);

  return root;
}
