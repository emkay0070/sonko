import * as THREE from 'three';
import { WorldPlaceId } from '../game/progression';
import { disposeLoadedModel, isSharedResource, load3DModelFromUrl, markAsSharedResource } from './modelLoader';
import { groundHeightAt } from './terrain';
import { applyNaturalWindShader } from './treeWind';

export interface DistantWorldRig {
  group: THREE.Group;
  setPlace: (place: WorldPlaceId) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

export interface TreePart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  isFoliage: boolean;
}

export type TreePrototype = TreePart[];

function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Shared module-level cache so Oak_trees_pack (23 MB USDZ) is only downloaded & parsed once per session
let cachedOakProtosPromise: Promise<TreePrototype[]> | null = null;
const persistentOakGeos = new Set<THREE.BufferGeometry>();
const persistentOakMats = new Set<THREE.Material>();
const persistentOakTexs = new Set<THREE.Texture>();

/**
 * Extracts discrete game-ready Oak tree prototypes (prefers LOD2 -> LOD1 -> LOD0 for crisp FPS,
 * trunk + canopy paired together, excluding billboards & Man_ref) from Oak_trees_pack_17var_LODs_seasons_gameready.usdz.
 * Cached globally so repeated world switches never re-parse the 23MB pack.
 */
export function extractOakLod0Prototypes(
  maxAnisotropy: number,
  _trackedGeos?: Set<THREE.BufferGeometry>,
  _trackedMats?: Set<THREE.Material>,
  _trackedTexs?: Set<THREE.Texture>
): Promise<TreePrototype[]> {
  if (cachedOakProtosPromise) {
    return cachedOakProtosPromise;
  }

  cachedOakProtosPromise = (async () => {
    const loaded = await load3DModelFromUrl(
      '/assets/props/Oak_trees_pack_17var_LODs_seasons_gameready.usdz',
      'Oak_trees_pack_17var_LODs_seasons_gameready.usdz',
      maxAnisotropy
    );
    const usdScene = loaded.scene;
    usdScene.updateMatrixWorld(true);

    // Collect variants by tier; pick LOD2 first, else LOD1, else LOD0 for smooth frame rates
    const variantLodMeshes = new Map<string, Map<number, THREE.Mesh[]>>();
    const allSrcMeshes: THREE.Mesh[] = [];

    usdScene.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      allSrcMeshes.push(mesh);

      let cur: THREE.Object3D | null = obj;
      let matchVariant: string | null = null;
      let lodLevel = -1;
      while (cur) {
        const nm = cur.name || '';
        if (/Man_ref|Billboard/i.test(nm)) {
          matchVariant = null;
          break;
        }
        const m = nm.match(/^(.*oak_tree.*)_LOD([0-3])$/i);
        if (m) {
          matchVariant = m[1];
          lodLevel = Number(m[2]);
          break;
        }
        cur = cur.parent;
      }
      if (matchVariant !== null && lodLevel >= 0) {
        let lodMap = variantLodMeshes.get(matchVariant);
        if (!lodMap) {
          lodMap = new Map();
          variantLodMeshes.set(matchVariant, lodMap);
        }
        const list = lodMap.get(lodLevel) ?? [];
        list.push(mesh);
        lodMap.set(lodLevel, list);
      }
    });

    const aniso = Math.min(4, Math.max(1, maxAnisotropy));
    const matCache = new Map<string, THREE.Material>();
    const prototypes: TreePrototype[] = [];

    for (const [, lodMap] of [...variantLodMeshes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const meshes = lodMap.get(2) ?? lodMap.get(1) ?? lodMap.get(0);
      if (!meshes || meshes.length === 0) continue;

      const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; isFoliage: boolean }> = [];
      const totalBox = new THREE.Box3();

      for (const srcMesh of meshes) {
        if (!srcMesh.geometry) continue;
        const geo = srcMesh.geometry.clone();
        geo.applyMatrix4(srcMesh.matrixWorld);
        geo.computeBoundingBox();
        if (!geo.boundingBox) {
          geo.dispose();
          continue;
        }
        totalBox.union(geo.boundingBox);

        const srcMat = Array.isArray(srcMesh.material) ? srcMesh.material[0] : srcMesh.material;
        if (!srcMat) {
          geo.dispose();
          continue;
        }

        const isCanopy = /cluster|leaf|leaves|foliage/i.test(srcMat.name || srcMesh.name);
        const cacheKey = `${isCanopy ? 'F' : 'B'}:${srcMat.uuid}`;
        let fixedMat = matCache.get(cacheKey);
        if (!fixedMat) {
          fixedMat = srcMat.clone();
          if (fixedMat instanceof THREE.MeshStandardMaterial) {
            if (fixedMat.map) {
              fixedMat.map.colorSpace = THREE.SRGBColorSpace;
              fixedMat.map.anisotropy = aniso;
              fixedMat.map.needsUpdate = true;
              persistentOakTexs.add(fixedMat.map);
            }
            if (fixedMat.normalMap) {
              fixedMat.normalMap.anisotropy = aniso;
              persistentOakTexs.add(fixedMat.normalMap);
            }
            if (isCanopy) {
              fixedMat.transparent = false;
              fixedMat.alphaTest = 0.35;
              fixedMat.side = THREE.DoubleSide;
              fixedMat.depthWrite = true;
              fixedMat.roughness = 0.78;
              fixedMat.metalness = 0.0;
            } else {
              fixedMat.transparent = false;
              fixedMat.roughness = 0.9;
              fixedMat.metalness = 0.02;
            }
            applyNaturalWindShader(fixedMat, {
              swayScaleM: 0.105,
              flutterScaleM: isCanopy ? 0.030 : 0,
              heightMode: 'worldMeters',
              heightBaseM: 0.16,
              refHeightM: 6.8,
              useModelRoot: false,
              bendExponent: 1.6,
            });
          }
          matCache.set(cacheKey, fixedMat);
          persistentOakMats.add(fixedMat);
        }

        parts.push({ geo, mat: fixedMat, isFoliage: isCanopy });
      }

      if (parts.length > 0 && !totalBox.isEmpty()) {
        const center = totalBox.getCenter(new THREE.Vector3());
        const sz = totalBox.getSize(new THREE.Vector3());
        const normScale = 1 / Math.max(0.05, sz.y);
        const dx = -center.x;
        const dy = -totalBox.min.y;
        const dz = -center.z;
        for (const p of parts) {
          p.geo.translate(dx, dy, dz);
          p.geo.scale(normScale, normScale, normScale);
          p.geo.computeBoundingBox();
          p.geo.computeBoundingSphere();
          persistentOakGeos.add(p.geo);
        }
        prototypes.push(
          parts.map((p) => ({ geometry: p.geo, material: p.mat, isFoliage: p.isFoliage }))
        );
      }
    }

    for (const g of persistentOakGeos) markAsSharedResource(g);
    for (const m of persistentOakMats) markAsSharedResource(m);
    for (const t of persistentOakTexs) markAsSharedResource(t);

    // Free instance-owned wrappers/materials while preserving shared cached geometries & textures
    disposeLoadedModel(usdScene);

    return prototypes;
  })().catch((err) => {
    cachedOakProtosPromise = null;
    throw err;
  });

  return cachedOakProtosPromise;
}

export function buildDistantWorldSurroundings(options: {
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
}): DistantWorldRig {
  const group = new THREE.Group();
  group.name = 'DistantWorldHorizon';

  let disposed = false;
  let activePlace: WorldPlaceId = 'kampala_compound';
  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();
  const trackedTexs = new Set<THREE.Texture>();

  // Subgroups so lakeside can hide north-sector land objects cleanly
  const landPropsGroup = new THREE.Group();
  const northSectorGroup = new THREE.Group();
  const islandGroup = new THREE.Group();
  const mountainRingGroup = new THREE.Group();
  group.add(mountainRingGroup, landPropsGroup, northSectorGroup, islandGroup);

  // 1. Sculpted Mountain & Highland Ridge Silhouette Ring (radius 64m -> 152m)
  const buildMountainRidges = (target: THREE.Group, startDeg: number, endDeg: number, radialShift = 0) => {
    const segments = 42;
    const ridgeGeo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols: number[] = [];

    const cBase = new THREE.Color('#664632');
    const cSlope = new THREE.Color('#475a31');
    const cPeak = new THREE.Color('#5c6f73');
    const tmp = new THREE.Color();

    const step = (endDeg - startDeg) / segments;
    for (let i = 0; i < segments; i++) {
      const a0 = THREE.MathUtils.degToRad(startDeg + i * step);
      const a1 = THREE.MathUtils.degToRad(startDeg + (i + 1) * step);

      const rInner = 64 + radialShift;
      const rMid = 88 + radialShift + Math.sin(i * 0.75) * 8;
      const rOuter = 136 + radialShift;

      const h0 =
        8.5 +
        Math.abs(Math.sin(i * 0.42 + 0.5)) * 14.5 +
        Math.abs(Math.cos(i * 0.95)) * 7.5;
      const h1 =
        8.5 +
        Math.abs(Math.sin((i + 1) * 0.42 + 0.5)) * 14.5 +
        Math.abs(Math.cos((i + 1) * 0.95)) * 7.5;

      const x0i = Math.cos(a0) * rInner;
      const z0i = Math.sin(a0) * rInner;
      const y0i = groundHeightAt(x0i, z0i) - 0.8;

      const x1i = Math.cos(a1) * rInner;
      const z1i = Math.sin(a1) * rInner;
      const y1i = groundHeightAt(x1i, z1i) - 0.8;

      const x0m = Math.cos(a0) * rMid;
      const z0m = Math.sin(a0) * rMid;
      const y0m = h0;

      const x1m = Math.cos(a1) * rMid;
      const z1m = Math.sin(a1) * rMid;
      const y1m = h1;

      const x0o = Math.cos(a0) * rOuter;
      const z0o = Math.sin(a0) * rOuter;
      const y0o = h0 * 0.52;

      const x1o = Math.cos(a1) * rOuter;
      const z1o = Math.sin(a1) * rOuter;
      const y1o = h1 * 0.52;

      const pushTri = (
        ax: number, ay: number, az: number, ca: THREE.Color,
        bx: number, by: number, bz: number, cb: THREE.Color,
        cx: number, cy: number, cz: number, cc: THREE.Color
      ) => {
        verts.push(ax, ay, az, bx, by, bz, cx, cy, cz);
        cols.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
      };

      const p0Col = tmp.copy(cSlope).lerp(cPeak, Math.min(1, h0 / 26)).clone();
      const p1Col = tmp.copy(cSlope).lerp(cPeak, Math.min(1, h1 / 26)).clone();

      pushTri(x0i, y0i, z0i, cBase, x0m, y0m, z0m, p0Col, x1m, y1m, z1m, p1Col);
      pushTri(x0i, y0i, z0i, cBase, x1m, y1m, z1m, p1Col, x1i, y1i, z1i, cBase);
      pushTri(x0m, y0m, z0m, p0Col, x0o, y0o, z0o, cPeak, x1o, y1o, z1o, cPeak);
      pushTri(x0m, y0m, z0m, p0Col, x1o, y1o, z1o, cPeak, x1m, y1m, z1m, p1Col);
    }

    ridgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    ridgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    ridgeGeo.computeVertexNormals();
    trackedGeos.add(ridgeGeo);

    const ridgeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.96,
      metalness: 0.0,
      flatShading: true,
    });
    trackedMats.add(ridgeMat);
    const ridgeMesh = new THREE.Mesh(ridgeGeo, ridgeMat);
    ridgeMesh.castShadow = false;
    ridgeMesh.receiveShadow = false;
    target.add(ridgeMesh);
  };

  buildMountainRidges(mountainRingGroup, -20, 200);
  buildMountainRidges(northSectorGroup, 200, 340);
  buildMountainRidges(islandGroup, 232, 308, 42);

  // 2. Instanced Rock Outcrops along Foothills (zero shadow-cast cost, single draw call per sector)
  const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
  const rPos = rockGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const n = 0.8 + 0.35 * hash(i * 17 + 3);
    rPos.setXYZ(i, vx * n * 1.25, vy * n * 0.72, vz * n * 1.1);
  }
  rockGeo.computeVertexNormals();
  trackedGeos.add(rockGeo);

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#7d736a',
    roughness: 0.92,
    metalness: 0.03,
    flatShading: true,
  });
  trackedMats.add(rockMat);

  const rockCount = 34;
  const landRocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
  const northRocks = new THREE.InstancedMesh(rockGeo, rockMat, 16);
  landRocks.castShadow = false;
  landRocks.receiveShadow = false;
  northRocks.castShadow = false;
  northRocks.receiveShadow = false;

  const dummy = new THREE.Object3D();
  const cRock = new THREE.Color();

  let lrIdx = 0;
  let nrIdx = 0;
  for (let i = 0; i < 56 && (lrIdx < rockCount || nrIdx < 16); i++) {
    const angle = (i / 56) * Math.PI * 2 + hash(i * 5) * 0.25;
    const radius = 20 + hash(i * 9 + 1) * 24;
    const rx = Math.cos(angle) * radius;
    const rz = Math.sin(angle) * radius;
    const ry = groundHeightAt(rx, rz);

    dummy.position.set(rx, ry - 0.15, rz);
    dummy.rotation.set(hash(i * 3) * 0.3, hash(i * 7) * Math.PI * 2, hash(i * 11) * 0.3);
    const sc = 0.95 + hash(i * 13) * 2.2;
    dummy.scale.set(sc * (0.9 + hash(i) * 0.4), sc * (0.65 + hash(i + 2) * 0.5), sc);
    dummy.updateMatrix();

    cRock.set('#6f645c').lerp(new THREE.Color('#928274'), hash(i * 19));

    if (rz < -10) {
      if (nrIdx < 16) {
        northRocks.setMatrixAt(nrIdx, dummy.matrix);
        northRocks.setColorAt(nrIdx, cRock);
        nrIdx++;
      }
    } else if (lrIdx < rockCount) {
      landRocks.setMatrixAt(lrIdx, dummy.matrix);
      landRocks.setColorAt(lrIdx, cRock);
      lrIdx++;
    }
  }
  landRocks.count = lrIdx;
  landRocks.instanceMatrix.needsUpdate = true;
  if (landRocks.instanceColor) landRocks.instanceColor.needsUpdate = true;
  landRocks.computeBoundingSphere();

  northRocks.count = nrIdx;
  northRocks.instanceMatrix.needsUpdate = true;
  if (northRocks.instanceColor) northRocks.instanceColor.needsUpdate = true;
  northRocks.computeBoundingSphere();

  landPropsGroup.add(landRocks);
  northSectorGroup.add(northRocks);

  // 3. Shared-Geometry Neighboring Homestead Houses (5 shared geometries, pooled materials, zero distant shadow cast)
  const housePlinthGeo = new THREE.BoxGeometry(4.8, 0.35, 3.8);
  const houseBodyGeo = new THREE.BoxGeometry(4.4, 2.35, 3.4);
  const houseRoofGeo = new THREE.ConeGeometry(3.45, 1.35, 4);
  houseRoofGeo.rotateY(Math.PI / 4);
  houseRoofGeo.scale(1.12, 1.0, 0.92);
  const housePostGeo = new THREE.BoxGeometry(0.12, 2.1, 0.12);
  const houseWinGeo = new THREE.BoxGeometry(0.75, 0.72, 0.08);
  trackedGeos.add(housePlinthGeo);
  trackedGeos.add(houseBodyGeo);
  trackedGeos.add(houseRoofGeo);
  trackedGeos.add(housePostGeo);
  trackedGeos.add(houseWinGeo);

  const trimMat = new THREE.MeshStandardMaterial({ color: '#4a3022', roughness: 0.85 });
  const litWinMat = new THREE.MeshStandardMaterial({
    color: '#ffcf7d',
    emissive: '#ff9d2e',
    emissiveIntensity: 1.05,
    roughness: 0.35,
  });
  const darkWinMat = new THREE.MeshStandardMaterial({ color: '#2b3e4c', roughness: 0.35 });
  const wallMats = ['#e8d8c3', '#dfd0bc', '#e5d5bf', '#d8c5ae'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0.02 })
  );
  const roofMats = ['#8f3b28', '#7c3222', '#6f777a'].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.58, metalness: 0.42 })
  );
  trackedMats.add(trimMat);
  trackedMats.add(litWinMat);
  trackedMats.add(darkWinMat);
  for (const m of wallMats) trackedMats.add(m);
  for (const m of roofMats) trackedMats.add(m);

  const houseSpecs: Array<{
    x: number;
    z: number;
    rotY: number;
    wallIdx: number;
    roofIdx: number;
    warmLit: boolean;
  }> = [
    { x: -24, z: -18, rotY: 0.72, wallIdx: 0, roofIdx: 0, warmLit: true },
    { x: 22, z: -16, rotY: -0.85, wallIdx: 1, roofIdx: 1, warmLit: true },
    { x: 25, z: 7, rotY: -1.85, wallIdx: 2, roofIdx: 2, warmLit: false },
    { x: -25, z: 14, rotY: 1.45, wallIdx: 3, roofIdx: 0, warmLit: true },
    { x: 16, z: -28, rotY: -0.35, wallIdx: 0, roofIdx: 1, warmLit: false },
    { x: -12, z: -31, rotY: 0.28, wallIdx: 1, roofIdx: 2, warmLit: true },
    { x: 30, z: -4, rotY: -1.55, wallIdx: 2, roofIdx: 0, warmLit: false },
    { x: -29, z: -3, rotY: 1.25, wallIdx: 0, roofIdx: 1, warmLit: true },
    { x: 19, z: 24, rotY: -2.45, wallIdx: 1, roofIdx: 2, warmLit: false },
    { x: -18, z: 27, rotY: 2.35, wallIdx: 3, roofIdx: 0, warmLit: true },
  ];

  for (const h of houseSpecs) {
    const house = new THREE.Group();
    const plinth = new THREE.Mesh(housePlinthGeo, trimMat);
    plinth.position.y = 0.175;
    house.add(plinth);

    const body = new THREE.Mesh(houseBodyGeo, wallMats[h.wallIdx]);
    body.position.y = 1.35;
    house.add(body);

    const roof = new THREE.Mesh(houseRoofGeo, roofMats[h.roofIdx]);
    roof.position.y = 3.15;
    house.add(roof);

    for (const px of [-1.75, 1.75]) {
      const post = new THREE.Mesh(housePostGeo, trimMat);
      post.position.set(px, 1.25, 1.85);
      house.add(post);
    }

    const wMat = h.warmLit ? litWinMat : darkWinMat;
    for (const wx of [-1.1, 1.1]) {
      const w = new THREE.Mesh(houseWinGeo, wMat);
      w.position.set(wx, 1.48, 1.71);
      house.add(w);
    }

    house.position.set(h.x, groundHeightAt(h.x, h.z) - 0.1, h.z);
    house.rotation.y = h.rotY;
    if (h.z < -10) {
      northSectorGroup.add(house);
    } else {
      landPropsGroup.add(house);
    }
  }

  // 4. Lightweight Instanced Perimeter Trees (170 KB lowpoly GLB, 2 draw calls for 32 trees!)
  void (async () => {
    try {
      const loaded = await load3DModelFromUrl(
        '/assets/props/tree_low_poly_lowpoly.glb',
        'tree_low_poly_lowpoly.glb',
        options.maxAnisotropy
      );
      if (disposed) {
        disposeLoadedModel(loaded.scene);
        return;
      }

      const root = loaded.scene;
      root.updateMatrixWorld(true);
      const totalBox = new THREE.Box3().setFromObject(root);
      const center = totalBox.getCenter(new THREE.Vector3());
      const size = totalBox.getSize(new THREE.Vector3());
      const normScale = 1 / Math.max(0.05, size.y);

      const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
      const lowPolyMatCache = new Map<string, THREE.Material>();
      root.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const m = obj as THREE.Mesh;
        if (!m.geometry) return;
        const geo = m.geometry.clone();
        geo.applyMatrix4(m.matrixWorld);
        geo.translate(-center.x, -totalBox.min.y, -center.z);
        geo.scale(normScale, normScale, normScale);
        geo.computeBoundingSphere();
        trackedGeos.add(geo);

        const rawMat = Array.isArray(m.material) ? m.material[0] : m.material;
        const isLeaf = /leaf|leaves|foliage|canopy|crown|green/i.test((rawMat?.name || '') + ' ' + (m.name || ''));
        const lpKey = `${isLeaf ? 'L' : 'T'}:${rawMat ? rawMat.uuid : 'default'}`;
        let mat = lowPolyMatCache.get(lpKey);
        if (!mat) {
          mat = rawMat ? rawMat.clone() : new THREE.MeshStandardMaterial({ color: '#4d7334', roughness: 0.88 });
          applyNaturalWindShader(mat, {
            swayScaleM: 0.095,
            flutterScaleM: isLeaf ? 0.020 : 0.008,
            heightMode: 'worldMeters',
            heightBaseM: 0.16,
            refHeightM: 6.4,
            useModelRoot: false,
            bendExponent: 1.55,
          });
          lowPolyMatCache.set(lpKey, mat);
          trackedMats.add(mat);
          if (mat instanceof THREE.MeshStandardMaterial && mat.map) {
            trackedTexs.add(mat.map);
          }
        }
        parts.push({ geo, mat });
      });

      const southTransforms: THREE.Matrix4[] = [];
      const northTransforms: THREE.Matrix4[] = [];
      const td = new THREE.Object3D();

      for (let i = 0; i < 32; i++) {
        const ang = (i / 32) * Math.PI * 2 + hash(i * 41) * 0.18;
        const rad = 19.0 + hash(i * 43) * 25.0;
        const tx = Math.cos(ang) * rad;
        const tz = Math.sin(ang) * rad;
        if (Math.abs(tx) < 8 && Math.abs(tz) < 12) continue;

        const ty = groundHeightAt(tx, tz) - 0.12;
        const height = 5.4 + hash(i * 53) * 3.6;
        td.position.set(tx, ty, tz);
        td.rotation.set(0, hash(i * 47) * Math.PI * 2, 0);
        td.scale.setScalar(height);
        td.updateMatrix();

        if (tz < -9) {
          northTransforms.push(td.matrix.clone());
        } else {
          southTransforms.push(td.matrix.clone());
        }
      }

      for (const p of parts) {
        if (southTransforms.length > 0) {
          const im = new THREE.InstancedMesh(p.geo, p.mat, southTransforms.length);
          southTransforms.forEach((mat4, idx) => im.setMatrixAt(idx, mat4));
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.castShadow = false;
          im.receiveShadow = false;
          landPropsGroup.add(im);
        }
        if (northTransforms.length > 0) {
          const im = new THREE.InstancedMesh(p.geo, p.mat, northTransforms.length);
          northTransforms.forEach((mat4, idx) => im.setMatrixAt(idx, mat4));
          im.instanceMatrix.needsUpdate = true;
          im.computeBoundingSphere();
          im.castShadow = false;
          im.receiveShadow = false;
          northSectorGroup.add(im);
        }
      }
      disposeLoadedModel(loaded.scene);
    } catch (err) {
      console.warn('Distant trees fallback warning:', err);
    }
  })();

  const setPlace = (place: WorldPlaceId) => {
    activePlace = place;
    const isLake = place === 'entebbe_lakeside';
    northSectorGroup.visible = !isLake;
    islandGroup.visible = isLake;
    landPropsGroup.visible = true;
    mountainRingGroup.visible = true;
  };

  setPlace(activePlace);

  const setShadowsEnabled = (_enabled: boolean) => {
    // Distant background horizon props never cast directional shadows so frame pacing stays fast
  };

  const dispose = () => {
    disposed = true;
    for (const g of trackedGeos) {
      if (!isSharedResource(g)) g.dispose();
    }
    for (const t of trackedTexs) {
      if (!isSharedResource(t)) t.dispose();
    }
    for (const m of trackedMats) {
      if (!isSharedResource(m)) m.dispose();
    }
    trackedGeos.clear();
    trackedTexs.clear();
    trackedMats.clear();
  };

  return { group, setPlace, setShadowsEnabled, dispose };
}
