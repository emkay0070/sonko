import * as THREE from 'three';
import { disposeLoadedModel, isSharedResource, load3DModelFromUrl } from './modelLoader';
import { groundHeightAt } from './terrain';
import { applyNaturalWindShader } from './treeWind';

export interface PineForestRig {
  group: THREE.Group;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

interface NormalizedPart {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  isFoliage: boolean;
}

type NormalizedPrototype = NormalizedPart[];

interface PlacementSpec {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  variant: number;
  sink?: number;
}

function getCategoryPrefix(node: THREE.Object3D): string | null {
  let cur: THREE.Object3D | null = node;
  while (cur) {
    if (cur.name) {
      if (/^(FlorasynthTree(?:_\d+)?|Ponderosa_Pine_seedling_\d+|Ponderosa_Pine_seedling)(?:_branches|_foliage)/.test(cur.name)) {
        return cur.name.replace(/_(branches|foliage).*$/, '');
      }
      if (/^(rock(?:_\d+)?|log(?:_\d+)?)(?:_\d+)?$/.test(cur.name)) {
        return cur.name;
      }
    }
    cur = cur.parent;
  }
  return null;
}

function isFoliageNode(node: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = node;
  while (cur) {
    if (/foliage|leaves|leaf/i.test(cur.name)) return true;
    cur = cur.parent;
  }
  return false;
}

function createNormalizedPrototype(
  rawMeshes: THREE.Mesh[],
  materialCache: Map<string, THREE.Material>,
  keptGeos: Set<THREE.BufferGeometry>,
  keptMats: Set<THREE.Material>,
  keptTexs: Set<THREE.Texture>,
  anisotropy: number,
  windAnimated = false
): NormalizedPrototype | null {
  if (rawMeshes.length === 0) return null;

  const bakedParts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material; isFoliage: boolean }> = [];
  const totalBox = new THREE.Box3();
  const partBox = new THREE.Box3();

  for (const mesh of rawMeshes) {
    if (!mesh.geometry) continue;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox();
    if (!geo.boundingBox) {
      geo.dispose();
      continue;
    }
    partBox.copy(geo.boundingBox);
    totalBox.union(partBox);

    const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!srcMat) {
      geo.dispose();
      continue;
    }

    const foliage = isFoliageNode(mesh);
    const cacheKey = `${windAnimated ? 'W' : 'S'}:${foliage ? 'F' : 'B'}:${srcMat.uuid}`;
    let fixedMat = materialCache.get(cacheKey);
    if (!fixedMat) {
      fixedMat = srcMat.clone();
      if (fixedMat instanceof THREE.MeshStandardMaterial) {
        if (fixedMat.map) {
          fixedMat.map.colorSpace = THREE.SRGBColorSpace;
          fixedMat.map.anisotropy = anisotropy;
          fixedMat.map.needsUpdate = true;
          keptTexs.add(fixedMat.map);
        }
        if (fixedMat.normalMap) {
          fixedMat.normalMap.colorSpace = THREE.NoColorSpace;
          fixedMat.normalMap.anisotropy = anisotropy;
          fixedMat.normalMap.needsUpdate = true;
          keptTexs.add(fixedMat.normalMap);
        }
        if (foliage) {
          fixedMat.transparent = false;
          fixedMat.alphaTest = 0.36;
          fixedMat.side = THREE.DoubleSide;
          fixedMat.depthWrite = true;
          fixedMat.roughness = 0.72;
          fixedMat.metalness = 0.0;
        } else {
          fixedMat.transparent = false;
          fixedMat.side = THREE.FrontSide;
          fixedMat.roughness = 0.88;
          fixedMat.metalness = 0.02;
        }
        if (windAnimated) {
          applyNaturalWindShader(fixedMat, {
            swayScaleM: 0.088,
            flutterScaleM: foliage ? 0.024 : 0,
            heightMode: 'worldMeters',
            heightBaseM: 0.14,
            refHeightM: 5.5,
            useModelRoot: false,
            bendExponent: 1.6,
          });
        } else {
          fixedMat.needsUpdate = true;
        }
      }
      materialCache.set(cacheKey, fixedMat);
      keptMats.add(fixedMat);
    }

    bakedParts.push({ geo, mat: fixedMat, isFoliage: foliage });
  }

  if (bakedParts.length === 0 || totalBox.isEmpty()) return null;

  const center = totalBox.getCenter(new THREE.Vector3());
  const dx = -center.x;
  const dy = -totalBox.min.y;
  const dz = -center.z;

  for (const part of bakedParts) {
    part.geo.translate(dx, dy, dz);
    part.geo.computeBoundingBox();
    part.geo.computeBoundingSphere();
    keptGeos.add(part.geo);
  }

  return bakedParts.map((p) => ({ geometry: p.geo, material: p.mat, isFoliage: p.isFoliage }));
}

function addInstancedPlacements(
  targetGroup: THREE.Group,
  protos: NormalizedPrototype[],
  specs: PlacementSpec[],
  opts: {
    shadowsActive: boolean;
    allowCastShadow: boolean;
    allowReceiveShadow: boolean;
    label: string;
    instancedMeshes: THREE.InstancedMesh[];
  }
) {
  if (protos.length === 0 || specs.length === 0) return;

  const buckets = new Map<number, THREE.Matrix4[]>();
  const dummy = new THREE.Object3D();

  for (const spec of specs) {
    const vIdx = spec.variant % protos.length;
    const y = groundHeightAt(spec.x, spec.z) - (spec.sink ?? 0.05);
    dummy.position.set(spec.x, y, spec.z);
    dummy.rotation.set(0, spec.rotY, 0);
    dummy.scale.setScalar(spec.scale);
    dummy.updateMatrix();
    const list = buckets.get(vIdx) ?? [];
    list.push(dummy.matrix.clone());
    buckets.set(vIdx, list);
  }

  for (const [vIdx, matrices] of buckets.entries()) {
    const proto = protos[vIdx];
    proto.forEach((part, pIdx) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
      im.name = `${opts.label}_v${vIdx}_p${pIdx}`;
      matrices.forEach((mat4, idx) => im.setMatrixAt(idx, mat4));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();

      const canCast = opts.allowCastShadow && !part.isFoliage;
      const canReceive = opts.allowReceiveShadow && !part.isFoliage;
      im.userData.__noCastShadow = !canCast;
      im.userData.__noReceiveShadow = !canReceive;
      im.castShadow = opts.shadowsActive && canCast;
      im.receiveShadow = opts.shadowsActive && canReceive;

      targetGroup.add(im);
      opts.instancedMeshes.push(im);
    });
  }
}

const MATURE_PINE_PLACEMENTS: PlacementSpec[] = [
  // Behind & West of the Ugandan Homestead House (framing gable & mabati roof)
  { x: -12.2, z: -7.8, scale: 3.45, rotY: 0.4, variant: 0, sink: 0.08 },
  { x: -13.6, z: -2.8, scale: 3.95, rotY: 1.9, variant: 1, sink: 0.08 },
  { x: -11.9, z: 1.5, scale: 3.25, rotY: 3.6, variant: 2, sink: 0.08 },
  { x: -14.5, z: 5.3, scale: 3.7, rotY: 5.1, variant: 0, sink: 0.08 },
  { x: -11.6, z: -10.9, scale: 4.1, rotY: 2.3, variant: 1, sink: 0.09 },
  { x: -16.8, z: -6.2, scale: 4.35, rotY: 4.2, variant: 2, sink: 0.1 },
  { x: -17.4, z: 2.6, scale: 4.15, rotY: 0.9, variant: 0, sink: 0.1 },

  // Behind the North Brick Perimeter Wall
  { x: -7.4, z: -11.4, scale: 3.6, rotY: 1.2, variant: 2, sink: 0.08 },
  { x: -3.2, z: -11.8, scale: 4.05, rotY: 3.1, variant: 0, sink: 0.08 },
  { x: 1.4, z: -11.5, scale: 3.55, rotY: 4.8, variant: 1, sink: 0.08 },
  { x: 5.8, z: -11.2, scale: 3.85, rotY: 0.7, variant: 2, sink: 0.08 },
  { x: 9.9, z: -10.6, scale: 3.45, rotY: 2.6, variant: 0, sink: 0.08 },
  { x: -4.8, z: -15.6, scale: 4.45, rotY: 5.4, variant: 1, sink: 0.12 },
  { x: 2.2, z: -16.2, scale: 4.3, rotY: 1.7, variant: 2, sink: 0.12 },
  { x: 8.6, z: -15.1, scale: 4.4, rotY: 3.9, variant: 0, sink: 0.12 },

  // East Outside Right Brick Wall (keeping slatted gate view open)
  { x: 10.6, z: -6.4, scale: 3.5, rotY: 2.1, variant: 1, sink: 0.08 },
  { x: 12.2, z: -1.6, scale: 3.9, rotY: 4.5, variant: 2, sink: 0.08 },
  { x: 10.9, z: 8.8, scale: 3.4, rotY: 0.3, variant: 0, sink: 0.08 },
  { x: 15.2, z: 3.6, scale: 4.15, rotY: 2.9, variant: 1, sink: 0.1 },
  { x: 15.4, z: -9.2, scale: 4.3, rotY: 5.7, variant: 2, sink: 0.12 },
  { x: 14.4, z: 12.2, scale: 3.85, rotY: 1.4, variant: 0, sink: 0.1 },

  // Far Outer South Flanks (safe behind camera positions)
  { x: -9.6, z: 11.4, scale: 3.65, rotY: 3.8, variant: 1, sink: 0.08 },
  { x: -4.6, z: 13.6, scale: 3.95, rotY: 0.6, variant: 2, sink: 0.1 },
  { x: 10.8, z: 12.8, scale: 3.7, rotY: 2.4, variant: 0, sink: 0.1 },
];

const SEEDLING_PLACEMENTS: PlacementSpec[] = [
  { x: -10.4, z: -6.8, scale: 1.45, rotY: 0.5, variant: 0, sink: 0.04 },
  { x: -10.3, z: -1.8, scale: 1.3, rotY: 2.1, variant: 1, sink: 0.04 },
  { x: -10.2, z: 2.6, scale: 1.55, rotY: 4.1, variant: 2, sink: 0.04 },
  { x: -8.4, z: 6.2, scale: 1.4, rotY: 1.3, variant: 3, sink: 0.04 },
  { x: -7.8, z: -10.0, scale: 1.5, rotY: 3.2, variant: 4, sink: 0.04 },
  { x: -1.2, z: -10.1, scale: 1.35, rotY: 5.0, variant: 0, sink: 0.04 },
  { x: 3.6, z: -10.0, scale: 1.65, rotY: 0.9, variant: 2, sink: 0.04 },
  { x: 8.8, z: -7.8, scale: 1.45, rotY: 2.7, variant: 1, sink: 0.04 },
  { x: 8.9, z: -3.2, scale: 1.3, rotY: 4.4, variant: 3, sink: 0.04 },
  { x: 8.9, z: 1.4, scale: 1.25, rotY: 1.8, variant: 4, sink: 0.04 },
  { x: 9.1, z: 6.2, scale: 1.4, rotY: 3.5, variant: 0, sink: 0.04 },
  { x: 8.8, z: 9.2, scale: 1.55, rotY: 5.6, variant: 2, sink: 0.04 },
];

const ROCK_PLACEMENTS: PlacementSpec[] = [
  // Outside slatted gate & along right wall exterior
  { x: 8.8, z: 1.9, scale: 1.45, rotY: 0.6, variant: 0, sink: 0.06 },
  { x: 9.2, z: 5.7, scale: 1.65, rotY: 2.3, variant: 1, sink: 0.06 },
  { x: 8.7, z: -4.4, scale: 1.35, rotY: 4.1, variant: 2, sink: 0.06 },
  { x: 8.6, z: 8.2, scale: 1.8, rotY: 1.2, variant: 3, sink: 0.07 },
  // House flanks & rear wall edge
  { x: -9.8, z: -6.4, scale: 1.7, rotY: 3.4, variant: 4, sink: 0.07 },
  { x: -10.2, z: 0.2, scale: 1.5, rotY: 5.0, variant: 5, sink: 0.06 },
  { x: -2.8, z: -8.0, scale: 1.2, rotY: 1.7, variant: 6, sink: 0.05 },
  { x: 3.2, z: -8.1, scale: 1.15, rotY: 2.9, variant: 7, sink: 0.05 },
  // Near mango tree shade & west compound edge
  { x: -6.9, z: 5.4, scale: 1.4, rotY: 0.4, variant: 1, sink: 0.06 },
  { x: -7.4, z: 3.4, scale: 1.25, rotY: 3.8, variant: 3, sink: 0.05 },
  { x: -6.5, z: 6.6, scale: 1.6, rotY: 4.7, variant: 0, sink: 0.07 },
  { x: -8.9, z: 9.2, scale: 1.85, rotY: 2.0, variant: 4, sink: 0.08 },
];

const LOG_PLACEMENTS: PlacementSpec[] = [
  { x: -8.2, z: 6.8, scale: 1.35, rotY: 0.75, variant: 0, sink: 0.04 },
  { x: 9.5, z: -1.4, scale: 1.25, rotY: 1.9, variant: 1, sink: 0.04 },
  { x: -10.1, z: -4.2, scale: 1.4, rotY: 0.25, variant: 2, sink: 0.04 },
  { x: 4.8, z: -10.3, scale: 1.3, rotY: 2.8, variant: 3, sink: 0.04 },
  { x: -3.8, z: -10.2, scale: 1.2, rotY: 1.15, variant: 4, sink: 0.04 },
];

export function buildPineForestSurroundings(options: {
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
  onLoaded?: () => void;
}): PineForestRig {
  const group = new THREE.Group();
  group.name = 'PineForestSurroundings';

  let disposed = false;
  const keptGeos = new Set<THREE.BufferGeometry>();
  const keptMats = new Set<THREE.Material>();
  const keptTexs = new Set<THREE.Texture>();
  const instancedMeshes: THREE.InstancedMesh[] = [];
  const aniso = Math.min(4, Math.max(1, options.maxAnisotropy));

  void (async () => {
    try {
      const gltf = await load3DModelFromUrl('/assets/worlds/kampala_compound/pine_forest.usdz', undefined, aniso);
      if (disposed) {
        disposeLoadedModel(gltf.scene);
        return;
      }

      const usdScene = gltf.scene;
      usdScene.updateMatrixWorld(true);

      const treeBuckets = new Map<string, THREE.Mesh[]>();
      const seedlingBuckets = new Map<string, THREE.Mesh[]>();
      const rockCandidates: Array<{ mesh: THREE.Mesh; span: number }> = [];
      const logMeshes: THREE.Mesh[] = [];
      const allSourceMeshes: THREE.Mesh[] = [];

      usdScene.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        allSourceMeshes.push(mesh);

        const prefix = getCategoryPrefix(mesh);
        if (!prefix) return;

        if (prefix.startsWith('FlorasynthTree')) {
          const list = treeBuckets.get(prefix) ?? [];
          list.push(mesh);
          treeBuckets.set(prefix, list);
        } else if (prefix.startsWith('Ponderosa_Pine_seedling')) {
          if (seedlingBuckets.size < 6 || seedlingBuckets.has(prefix)) {
            const list = seedlingBuckets.get(prefix) ?? [];
            list.push(mesh);
            seedlingBuckets.set(prefix, list);
          }
        } else if (prefix.startsWith('rock')) {
          const box = new THREE.Box3().setFromObject(mesh);
          const sz = box.getSize(new THREE.Vector3());
          const span = Math.max(sz.x, sz.z);
          if (span >= 0.35) {
            rockCandidates.push({ mesh, span });
          }
        } else if (prefix.startsWith('log')) {
          logMeshes.push(mesh);
        }
      });

      const materialCache = new Map<string, THREE.Material>();

      const matureTreeProtos: NormalizedPrototype[] = [];
      for (const meshes of treeBuckets.values()) {
        const proto = createNormalizedPrototype(meshes, materialCache, keptGeos, keptMats, keptTexs, aniso, true);
        if (proto) matureTreeProtos.push(proto);
      }

      const seedlingProtos: NormalizedPrototype[] = [];
      for (const meshes of seedlingBuckets.values()) {
        const proto = createNormalizedPrototype(meshes, materialCache, keptGeos, keptMats, keptTexs, aniso, true);
        if (proto) seedlingProtos.push(proto);
      }

      rockCandidates.sort((a, b) => b.span - a.span);
      const rockProtos: NormalizedPrototype[] = [];
      for (const cand of rockCandidates.slice(0, 6)) {
        const proto = createNormalizedPrototype([cand.mesh], materialCache, keptGeos, keptMats, keptTexs, aniso, false);
        if (proto) rockProtos.push(proto);
      }

      const logProtos: NormalizedPrototype[] = [];
      for (const lm of logMeshes.slice(0, 4)) {
        const proto = createNormalizedPrototype([lm], materialCache, keptGeos, keptMats, keptTexs, aniso, false);
        if (proto) logProtos.push(proto);
      }

      // Free instance-owned wrappers while keeping shared cached geometries/textures intact
      disposeLoadedModel(usdScene);

      const shadowsActive = !options.isSoftwareGl && options.shadowsEnabled();

      // Batch all trees, seedlings, rocks & logs into InstancedMeshes (~10 draw calls total instead of 120+)
      addInstancedPlacements(group, matureTreeProtos, MATURE_PINE_PLACEMENTS, {
        shadowsActive,
        allowCastShadow: true, // trunks only; foliage excluded automatically
        allowReceiveShadow: true,
        label: 'PonderosaPine',
        instancedMeshes,
      });

      addInstancedPlacements(group, seedlingProtos, SEEDLING_PLACEMENTS, {
        shadowsActive,
        allowCastShadow: false,
        allowReceiveShadow: false,
        label: 'PineSeedling',
        instancedMeshes,
      });

      addInstancedPlacements(group, rockProtos, ROCK_PLACEMENTS, {
        shadowsActive,
        allowCastShadow: false,
        allowReceiveShadow: true,
        label: 'ForestRock',
        instancedMeshes,
      });

      addInstancedPlacements(group, logProtos, LOG_PLACEMENTS, {
        shadowsActive,
        allowCastShadow: false,
        allowReceiveShadow: true,
        label: 'FallenPineLog',
        instancedMeshes,
      });

      options.onLoaded?.();
    } catch (err) {
      console.warn('Pine forest surroundings could not load:', err);
    }
  })();

  const setShadowsEnabled = (enabled: boolean) => {
    const active = !options.isSoftwareGl && enabled;
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = active && !obj.userData.__noCastShadow;
        obj.receiveShadow = active && !obj.userData.__noReceiveShadow;
      }
    });
  };

  const dispose = () => {
    disposed = true;
    for (const im of instancedMeshes) im.dispose();
    instancedMeshes.length = 0;
    for (const g of keptGeos) {
      if (!isSharedResource(g)) g.dispose();
    }
    for (const t of keptTexs) {
      if (!isSharedResource(t)) t.dispose();
    }
    for (const m of keptMats) {
      if (!isSharedResource(m)) m.dispose();
    }
    keptGeos.clear();
    keptTexs.clear();
    keptMats.clear();
  };

  return { group, setShadowsEnabled, dispose };
}
