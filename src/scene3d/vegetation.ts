import * as THREE from 'three';
import { CompoundTextureLibrary } from './pbrTextures';
import { groundHeightAt } from './terrain';
import { applyNaturalWindShader, SHARED_TREE_WIND_UNIFORMS } from './treeWind';

function buildTaperedBranch(
  points: THREE.Vector3[],
  rStart: number,
  rEnd: number,
  radialSegs: number,
  tubularSegs: number
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, tubularSegs, rStart, radialSegs, false);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const ringCount = tubularSegs + 1;
  const vertsPerRing = radialSegs + 1;
  const center = new THREE.Vector3();
  const vert = new THREE.Vector3();

  for (let i = 0; i < ringCount; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, center);
    const radiusScale = THREE.MathUtils.lerp(1.0, rEnd / rStart, t);
    for (let j = 0; j < vertsPerRing; j++) {
      const idx = i * vertsPerRing + j;
      vert.fromBufferAttribute(pos, idx);
      vert.sub(center).multiplyScalar(radiusScale).add(center);
      pos.setXYZ(idx, vert.x, vert.y, vert.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface VegetationRig {
  group: THREE.Group;
  updateWind: (timeSec: number) => void;
}

export function buildUgandanVegetation(tex: CompoundTextureLibrary): VegetationRig {
  const group = new THREE.Group();
  group.name = 'UgandanCompoundVegetation';

  // =========================================================================
  // 1. HERO MATURE UGANDAN MANGO TREE (*OMUYEMBE*) AT (-5.4, 4.4)
  // =========================================================================
  const mango = new THREE.Group();
  mango.name = 'HeroMangoTree';
  const mx = -5.4;
  const mz = 4.4;
  const my = groundHeightAt(mx, mz);
  mango.position.set(mx, my, mz);

  const barkMap = tex.barkAlbedo.clone();
  barkMap.repeat.set(2.2, 5.5);
  barkMap.needsUpdate = true;
  const barkNorm = tex.barkNormal.clone();
  barkNorm.repeat.set(2.2, 5.5);
  barkNorm.needsUpdate = true;

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkMap,
    normalMap: barkNorm,
    normalScale: new THREE.Vector2(1.3, 1.3),
    roughness: 0.92,
    metalness: 0.01,
  });
  // Keep trunk & root buttresses firmly planted (<=1.5m), flex upper scaffold limbs with crown
  applyNaturalWindShader(barkMat, {
    swayScaleM: 0.072,
    flutterScaleM: 0,
    heightMode: 'worldMeters',
    heightBaseM: 1.5,
    refHeightM: 4.3,
    useModelRoot: true,
    bendExponent: 1.75,
  });

  // Main gnarled trunk curving organically upward
  const trunkPts = [
    new THREE.Vector3(0, -0.15, 0),
    new THREE.Vector3(0.08, 0.85, -0.05),
    new THREE.Vector3(0.24, 1.85, -0.12),
    new THREE.Vector3(0.32, 2.65, -0.04),
  ];
  const trunkMesh = new THREE.Mesh(buildTaperedBranch(trunkPts, 0.44, 0.27, 14, 18), barkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  mango.add(trunkMesh);

  // Exposed surface root buttresses gripping red murram soil
  for (let r = 0; r < 5; r++) {
    const a = (r / 5) * Math.PI * 2 + 0.3;
    const rootPts = [
      new THREE.Vector3(Math.cos(a) * 0.22, 0.35, Math.sin(a) * 0.22),
      new THREE.Vector3(Math.cos(a) * 0.56, 0.08, Math.sin(a) * 0.56),
      new THREE.Vector3(Math.cos(a) * 0.95, -0.08, Math.sin(a) * 0.95),
    ];
    const rootMesh = new THREE.Mesh(buildTaperedBranch(rootPts, 0.14, 0.035, 8, 10), barkMat);
    rootMesh.castShadow = true;
    rootMesh.receiveShadow = true;
    mango.add(rootMesh);
  }

  // Scaffold limbs & secondary branches supporting dense canopy sprays
  const crownTips: THREE.Vector3[] = [];
  const limbTargets = [
    new THREE.Vector3(2.3, 4.35, -0.95),
    new THREE.Vector3(1.85, 4.55, 1.45),
    new THREE.Vector3(-0.35, 4.95, 2.05),
    new THREE.Vector3(-1.95, 4.45, 0.35),
    new THREE.Vector3(-1.2, 4.6, -1.75),
    new THREE.Vector3(0.55, 5.45, -0.15),
  ];

  const rng = mulberry(2026);
  limbTargets.forEach((tip, i) => {
    const start = new THREE.Vector3(0.28, 2.35 + (i % 2) * 0.25, -0.05);
    const mid = start.clone().lerp(tip, 0.52);
    mid.y += 0.35;
    mid.x += (rng() - 0.5) * 0.4;
    const limb = new THREE.Mesh(buildTaperedBranch([start, mid, tip], 0.21, 0.075, 10, 14), barkMat);
    limb.castShadow = true;
    limb.receiveShadow = true;
    mango.add(limb);

    crownTips.push(tip.clone());

    // 3 secondary branches splitting from each primary scaffold limb
    for (let s = 0; s < 3; s++) {
      const branchOrigin = start.clone().lerp(tip, 0.58 + s * 0.16);
      const subTip = tip
        .clone()
        .add(new THREE.Vector3((rng() - 0.5) * 2.1, 0.25 + rng() * 0.9, (rng() - 0.5) * 2.1));
      const subMid = branchOrigin.clone().lerp(subTip, 0.5);
      subMid.y += 0.18;
      const subMesh = new THREE.Mesh(
        buildTaperedBranch([branchOrigin, subMid, subTip], 0.085, 0.028, 7, 10),
        barkMat
      );
      subMesh.castShadow = true;
      subMesh.receiveShadow = true;
      mango.add(subMesh);
      crownTips.push(subTip);
    }
  });

  // Crossed Leaf Cluster Spray Geometry (2 crossed cards per spray for 3D volumetric silhouette)
  const cardA = new THREE.PlaneGeometry(0.76, 0.76);
  const cardB = new THREE.PlaneGeometry(0.76, 0.76);
  cardB.rotateY(Math.PI * 0.5);
  cardB.rotateZ(0.22);

  // Merge cardA + cardB into one 2-quad spray geometry cleanly
  const mergeQuads = (g1: THREE.BufferGeometry, g2: THREE.BufferGeometry) => {
    const p1 = g1.attributes.position.array as Float32Array;
    const p2 = g2.attributes.position.array as Float32Array;
    const n1 = g1.attributes.normal.array as Float32Array;
    const n2 = g2.attributes.normal.array as Float32Array;
    const u1 = g1.attributes.uv.array as Float32Array;
    const u2 = g2.attributes.uv.array as Float32Array;
    const i1 = g1.index!.array;
    const i2 = g2.index!.array;

    const merged = new THREE.BufferGeometry();
    const pos = new Float32Array(p1.length + p2.length);
    pos.set(p1, 0);
    pos.set(p2, p1.length);
    const nrm = new Float32Array(n1.length + n2.length);
    nrm.set(n1, 0);
    nrm.set(n2, n1.length);
    const uvs = new Float32Array(u1.length + u2.length);
    uvs.set(u1, 0);
    uvs.set(u2, u1.length);

    const vOffset = p1.length / 3;
    const idx = new Uint16Array(i1.length + i2.length);
    idx.set(i1, 0);
    for (let k = 0; k < i2.length; k++) idx[i1.length + k] = i2[k] + vOffset;

    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    merged.setIndex(new THREE.BufferAttribute(idx, 1));
    g1.dispose();
    g2.dispose();
    return merged;
  };

  const sprayGeo = mergeQuads(cardA, cardB);
  const mangoLeafMat = new THREE.MeshStandardMaterial({
    map: tex.mangoLeafMap,
    alphaTest: 0.42,
    side: THREE.DoubleSide,
    roughness: 0.56,
    metalness: 0.02,
  });
  // Exact same macro bend + model root as barkMat so canopy sprays stay locked to branches, plus delicate leaf flutter
  applyNaturalWindShader(mangoLeafMat, {
    swayScaleM: 0.072,
    flutterScaleM: 0.028,
    heightMode: 'worldMeters',
    heightBaseM: 1.5,
    refHeightM: 4.3,
    useModelRoot: true,
    bendExponent: 1.75,
  });

  const spraysPerTip = 28;
  const totalSprays = crownTips.length * spraysPerTip;
  const canopyInst = new THREE.InstancedMesh(sprayGeo, mangoLeafMat, totalSprays);
  canopyInst.name = 'MangoCanopyFoliage';
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const cLeaf = new THREE.Color();
  let sIdx = 0;

  for (const tip of crownTips) {
    for (let k = 0; k < spraysPerTip; k++) {
      const rDist = 0.25 + Math.pow(rng(), 0.7) * 1.15;
      const theta = rng() * Math.PI * 2;
      const phi = (rng() - 0.35) * Math.PI * 0.85;
      const px = tip.x + Math.cos(theta) * Math.cos(phi) * rDist;
      const py = tip.y + Math.sin(phi) * rDist * 0.68;
      const pz = tip.z + Math.sin(theta) * Math.cos(phi) * rDist;

      dummy.position.set(px, py, pz);
      dummy.rotation.set(
        (rng() - 0.5) * 1.1,
        rng() * Math.PI * 2,
        (rng() - 0.5) * 1.1
      );
      const sc = 0.85 + rng() * 0.65;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      canopyInst.setMatrixAt(sIdx, dummy.matrix);

      // Sunlit upper canopy slightly brighter warm olive; lower shaded interior darker green
      const heightTint = THREE.MathUtils.clamp((py - 3.6) / 2.6, 0, 1);
      cLeaf.set('#304c1c').lerp(new THREE.Color('#64882e'), heightTint * (0.4 + rng() * 0.6));
      canopyInst.setColorAt(sIdx, cLeaf);
      sIdx++;
    }
  }
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  canopyInst.computeBoundingSphere();
  mango.add(canopyInst);
  group.add(mango);

  // =========================================================================
  // 2. EAST AFRICAN BANANA / MATOOKE CLUMP (*EKITOOKE*) AT CORNER (5.9, -6.9)
  // =========================================================================
  const bananaClump = new THREE.Group();
  bananaClump.name = 'MatookeBananaClump';
  const bx = 5.9;
  const bz = -6.9;
  bananaClump.position.set(bx, groundHeightAt(bx, bz), bz);

  const bananaStemMat = new THREE.MeshStandardMaterial({
    color: '#5f6f36',
    roughness: 0.78,
    metalness: 0.02,
  });

  // Curved arched banana leaf blade geometry (arching outward & drooping gracefully)
  const makeBananaBladeGeo = (length: number, width: number, droop: number) => {
    const geo = new THREE.PlaneGeometry(width, length, 4, 10);
    // Shift pivot to base of leaf petiole (bottom y = 0)
    geo.translate(0, length * 0.5, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);
      const t = vy / length;
      // Arched parabolic droop forward along +Z + slight V-fold across central midrib
      const arcZ = t * t * length * droop;
      const archY = Math.sin(t * Math.PI * 0.72) * length * 0.86;
      const vFold = Math.abs(vx) * 0.16;
      pos.setXYZ(i, vx, archY + vFold, arcZ);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const bananaLeafMat = new THREE.MeshStandardMaterial({
    map: tex.bananaLeafMap,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.48,
    metalness: 0.03,
  });
  applyNaturalWindShader(bananaLeafMat, {
    swayScaleM: 0.085,
    flutterScaleM: 0.024,
    heightMode: 'uv',
    bendExponent: 1.45,
  });

  const pseudostems = [
    { dx: 0.0, dz: 0.0, h: 2.65, rad: 0.14, leanX: -0.05, leanZ: 0.06, leaves: 7 },
    { dx: -0.62, dz: 0.35, h: 2.15, rad: 0.11, leanX: -0.1, leanZ: 0.12, leaves: 6 },
    { dx: 0.55, dz: 0.48, h: 1.85, rad: 0.1, leanX: 0.11, leanZ: 0.09, leaves: 5 },
    { dx: -0.25, dz: -0.52, h: 1.35, rad: 0.08, leanX: -0.06, leanZ: -0.08, leaves: 4 },
  ];

  pseudostems.forEach((st, idx) => {
    const stemGrp = new THREE.Group();
    stemGrp.position.set(st.dx, 0, st.dz);
    stemGrp.rotation.set(st.leanZ, idx * 0.9, -st.leanX);

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(st.rad * 0.76, st.rad * 1.15, st.h, 12),
      bananaStemMat
    );
    trunk.position.y = st.h * 0.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    stemGrp.add(trunk);

    // Dry brownish peeled leaf sheath near lower stalk base
    const sheath = new THREE.Mesh(
      new THREE.CylinderGeometry(st.rad * 1.18, st.rad * 1.24, st.h * 0.25, 10),
      new THREE.MeshStandardMaterial({ color: '#6b5336', roughness: 0.94 })
    );
    sheath.position.y = st.h * 0.12;
    stemGrp.add(sheath);

    const crown = new THREE.Group();
    crown.position.y = st.h * 0.95;

    for (let l = 0; l < st.leaves; l++) {
      const a = (l / st.leaves) * Math.PI * 2 + rng() * 0.45;
      const bladeLen = 1.45 + rng() * 0.55;
      const bladeW = 0.44 + rng() * 0.12;
      const droop = 0.45 + (l % 3) * 0.18;
      const blade = new THREE.Mesh(makeBananaBladeGeo(bladeLen, bladeW, droop), bananaLeafMat);
      blade.rotation.y = a;
      blade.rotation.x = 0.25 + (l % 2) * 0.22;
      blade.castShadow = true;
      blade.receiveShadow = true;
      crown.add(blade);
    }
    stemGrp.add(crown);
    bananaClump.add(stemGrp);
  });

  group.add(bananaClump);

  // =========================================================================
  // 3. PERIMETER UGANDAN GRASS TUFTS (Along wall bases & tree roots)
  // =========================================================================
  const tuftCardA = new THREE.PlaneGeometry(0.45, 0.42);
  tuftCardA.translate(0, 0.2, 0);
  const tuftCardB = new THREE.PlaneGeometry(0.45, 0.42);
  tuftCardB.translate(0, 0.2, 0);
  tuftCardB.rotateY(Math.PI * 0.5);
  const tuftGeo = mergeQuads(tuftCardA, tuftCardB);

  const grassMat = new THREE.MeshStandardMaterial({
    map: tex.grassTuftMap,
    alphaTest: 0.38,
    side: THREE.DoubleSide,
    roughness: 0.86,
    metalness: 0.0,
  });
  applyNaturalWindShader(grassMat, {
    swayScaleM: 0.048,
    flutterScaleM: 0.018,
    heightMode: 'uv',
    bendExponent: 1.5,
  });

  const grassSpots: Array<{ x: number; z: number; scale: number }> = [];
  const pushCluster = (cx: number, cz: number, spread: number, count: number) => {
    for (let i = 0; i < count; i++) {
      grassSpots.push({
        x: cx + (rng() - 0.5) * spread,
        z: cz + (rng() - 0.5) * spread,
        scale: 0.65 + rng() * 0.75,
      });
    }
  };

  // Along back brick wall base (z ~ -8.2)
  for (let wx = -5.8; wx <= 7.2; wx += 1.45) pushCluster(wx, -8.2, 0.85, 4);
  // Along right brick wall base (x ~ 7.2)
  for (let wz = -7.8; wz <= 2.2; wz += 1.4) pushCluster(7.15, wz, 0.8, 4);
  for (let wz = 5.4; wz <= 9.4; wz += 1.35) pushCluster(7.15, wz, 0.8, 4);
  // Around mango tree roots & banana clump & outer yard border
  pushCluster(-5.3, 4.4, 2.2, 18);
  pushCluster(5.8, -6.7, 2.4, 24);
  pushCluster(-3.8, 6.2, 2.5, 14);
  pushCluster(4.2, 7.6, 3.2, 16);

  const grassInst = new THREE.InstancedMesh(tuftGeo, grassMat, grassSpots.length);
  grassInst.name = 'CompoundEdgeGrass';
  grassInst.receiveShadow = true;

  grassSpots.forEach((sp, idx) => {
    const gy = groundHeightAt(sp.x, sp.z);
    dummy.position.set(sp.x, gy - 0.02, sp.z);
    dummy.rotation.set((rng() - 0.5) * 0.14, rng() * Math.PI * 2, (rng() - 0.5) * 0.14);
    dummy.scale.set(sp.scale, sp.scale * (0.85 + rng() * 0.4), sp.scale);
    dummy.updateMatrix();
    grassInst.setMatrixAt(idx, dummy.matrix);

    cLeaf.set('#7a8248').lerp(new THREE.Color('#a48d56'), rng() * 0.55);
    grassInst.setColorAt(idx, cLeaf);
  });
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  group.add(grassInst);

  // =========================================================================
  // 4. NEIGHBORHOOD TREES OUTSIDE COMPOUND WALLS (Depth & Horizon Scale)
  // =========================================================================
  const outerBarkMat = new THREE.MeshStandardMaterial({ color: '#4f4033', roughness: 0.94 });
  const outerFoliageMat = new THREE.MeshStandardMaterial({
    map: tex.mangoLeafMap,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.72,
    color: '#4f6e2d',
  });
  applyNaturalWindShader(outerFoliageMat, {
    swayScaleM: 0.095,
    flutterScaleM: 0.028,
    heightMode: 'uv',
    bendExponent: 1.25,
  });

  const outerPositions = [
    { x: 21.5, z: -18.5, s: 1.25 },
    { x: 24.5, z: -3.5, s: 1.15 },
    { x: 21.0, z: 13.5, s: 1.1 },
    { x: -3.5, z: -23.5, s: 1.35 },
    { x: -21.0, z: -19.5, s: 1.2 },
    { x: -21.5, z: 14.0, s: 1.25 },
    { x: 9.5, z: -24.5, s: 1.4 },
    { x: 26.5, z: -21.0, s: 1.5 },
    { x: -24.5, z: -5.0, s: 1.4 },
  ];

  // Instanced background foliage clusters across neighborhood compound trees
  const bgCanopyCount = outerPositions.length * 16;
  const bgCanopy = new THREE.InstancedMesh(sprayGeo, outerFoliageMat, bgCanopyCount);
  bgCanopy.name = 'NeighborhoodTreesCanopy';
  bgCanopy.castShadow = false;
  bgCanopy.receiveShadow = true;

  let bgIdx = 0;
  outerPositions.forEach((op, i) => {
    const gy = groundHeightAt(op.x, op.z);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18 * op.s, 0.28 * op.s, 3.2 * op.s, 8),
      outerBarkMat
    );
    trunk.position.set(op.x, gy + 1.5 * op.s, op.z);
    group.add(trunk);

    for (let k = 0; k < 16; k++) {
      const ang = rng() * Math.PI * 2;
      const rad = rng() * 1.9 * op.s;
      dummy.position.set(
        op.x + Math.cos(ang) * rad,
        gy + (3.2 + rng() * 2.1) * op.s,
        op.z + Math.sin(ang) * rad
      );
      dummy.rotation.set((rng() - 0.5) * 0.8, rng() * Math.PI * 2, (rng() - 0.5) * 0.8);
      const sc = (2.1 + rng() * 1.2) * op.s;
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      bgCanopy.setMatrixAt(bgIdx, dummy.matrix);
      cLeaf.set('#3b5524').lerp(new THREE.Color('#617a34'), ((i + k) % 5) / 5);
      bgCanopy.setColorAt(bgIdx, cLeaf);
      bgIdx++;
    }
  });
  bgCanopy.instanceMatrix.needsUpdate = true;
  if (bgCanopy.instanceColor) bgCanopy.instanceColor.needsUpdate = true;
  bgCanopy.computeBoundingSphere();
  group.add(bgCanopy);

  return {
    group,
    updateWind: (timeSec: number) => {
      SHARED_TREE_WIND_UNIFORMS.uWindTime.value = timeSec;
    },
  };
}
