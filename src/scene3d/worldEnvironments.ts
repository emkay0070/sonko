import * as THREE from 'three';
import { WorldPlaceId } from '../game/progression';
import { extractOakLod0Prototypes } from './distantWorld';
import { buildEntebbeLakesideEnvironment, EntebbeLakesideRig } from './entebbeLakesideScene';
import { disposeLoadedModel, isSharedResource, load3DModelFromUrl } from './modelLoader';
import { CompoundTextureLibrary } from './pbrTextures';
import {
  buildPrimarySchoolyardEnvironment,
  PrimarySchoolyardRig,
} from './primarySchoolyardScene';
import { groundHeightAt } from './terrain';
import { applyNaturalWindShader } from './treeWind';

export interface ArrivalCameraTarget {
  active: boolean;
  progress: number; // 0 -> 1
  camPos: THREE.Vector3;
  lookAt: THREE.Vector3;
  fov: number;
}

export interface WorldEnvironmentsRig {
  group: THREE.Group;
  setPlace: (place: WorldPlaceId) => void;
  startArrivalSequence: (place: WorldPlaceId) => boolean;
  skipArrivalSequence: () => void;
  isArrivalPlaying: () => boolean;
  getArrivalCameraTarget: () => ArrivalCameraTarget | null;
  update: (dt: number, elapsed: number, wetness?: number) => void;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

interface PlaceModelSpec {
  url: string;
  x: number;
  z: number;
  rotY?: number;
  yOffset?: number;
  targetHeight?: number;
  targetMaxSpan?: number;
  cloneTo?: Array<{ x: number; z: number; rotY?: number; scaleMul?: number; yOffset?: number }>;
  animate?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

function normalizeAssetToTarget(
  root: THREE.Object3D,
  opts: { targetHeight?: number; targetMaxSpan?: number }
): THREE.Vector3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  let scale = 1;
  if (opts.targetHeight && size.y > 0.0001) {
    scale = opts.targetHeight / size.y;
  } else if (opts.targetMaxSpan) {
    const maxSpan = Math.max(0.0001, size.x, size.y, size.z);
    scale = opts.targetMaxSpan / maxSpan;
  }
  root.scale.multiplyScalar(scale);
  root.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(root);
  const center = scaledBox.getCenter(new THREE.Vector3());
  root.position.set(-center.x, -scaledBox.min.y, -center.z);
  return scaledBox.getSize(new THREE.Vector3());
}

export function buildWorldEnvironments(options: {
  textures: CompoundTextureLibrary;
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
  onKampalaToggle: (isKampala: boolean) => void;
  onOuterHillsToggle: (showHills: boolean) => void;
}): WorldEnvironmentsRig {
  const group = new THREE.Group();
  group.name = 'SonkoWorldEnvironments';

  let disposed = false;
  let activePlace: WorldPlaceId = 'kampala_compound';
  const placeGroups = new Map<WorldPlaceId, THREE.Group>();
  const builtOrBuilding = new Set<WorldPlaceId>();

  const trackedGeos = new Set<THREE.BufferGeometry>();
  const trackedMats = new Set<THREE.Material>();
  const trackedTexs = new Set<THREE.Texture>();
  const mixers: THREE.AnimationMixer[] = [];
  const animatedWaterMeshes: Array<{
    mesh: THREE.Mesh;
    baseY: number;
  }> = [];
  const floatingBoats: Array<{
    holder: THREE.Group;
    baseY: number;
    phase: number;
  }> = [];

  const instancedMeshesToDispose: THREE.InstancedMesh[] = [];
  let entebbeRig: EntebbeLakesideRig | null = null;
  let schoolyardRig: PrimarySchoolyardRig | null = null;
  const aniso = Math.min(4, Math.max(1, options.maxAnisotropy));

  // Shared Oak Tree LOD2/LOD1 prototypes (loaded lazily once at module level & reused cleanly across worlds)
  const getOakProtos = () =>
    extractOakLod0Prototypes(aniso).catch(() => []);

  const spawnOakTrees = async (
    targetGroup: THREE.Group,
    spots: Array<{ x: number; z: number; height: number; rotY: number; variant: number }>
  ) => {
    const protos = await getOakProtos();
    if (disposed || protos.length === 0 || spots.length === 0) return;
    const sh = !options.isSoftwareGl && options.shadowsEnabled();

    const buckets = new Map<number, THREE.Matrix4[]>();
    const dummy = new THREE.Object3D();
    for (const s of spots) {
      const vIdx = s.variant % protos.length;
      dummy.position.set(s.x, groundHeightAt(s.x, s.z) - 0.06, s.z);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.setScalar(s.height);
      dummy.updateMatrix();
      const list = buckets.get(vIdx) ?? [];
      list.push(dummy.matrix.clone());
      buckets.set(vIdx, list);
    }

    for (const [vIdx, matrices] of buckets.entries()) {
      const proto = protos[vIdx];
      proto.forEach((part, pIdx) => {
        const im = new THREE.InstancedMesh(part.geometry, part.material, matrices.length);
        im.name = `WorldOakTree_v${vIdx}_p${pIdx}`;
        matrices.forEach((mat4, idx) => im.setMatrixAt(idx, mat4));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();

        im.userData.__persistentShared = true;
        im.userData.__noCastShadow = true;
        im.userData.__noReceiveShadow = part.isFoliage;
        im.castShadow = false;
        im.receiveShadow = sh && !part.isFoliage;

        targetGroup.add(im);
        instancedMeshesToDispose.push(im);
      });
    }
  };

  // Legacy arrival state kept inert for backward API compatibility
  let arrivalActive = false;

  const getOrCreatePlaceGroup = (place: WorldPlaceId): THREE.Group => {
    let pg = placeGroups.get(place);
    if (!pg) {
      pg = new THREE.Group();
      pg.name = `WorldEnv_${place}`;
      pg.visible = place === activePlace;
      placeGroups.set(place, pg);
      group.add(pg);
    }
    return pg;
  };

  const configureLoadedMeshes = (
    root: THREE.Object3D,
    allowCastShadow = true,
    allowReceiveShadow = true
  ) => {
    const shadowsActive = !options.isSoftwareGl && options.shadowsEnabled();
    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) {
        mesh.frustumCulled = false;
      }
      if (mesh.geometry) trackedGeos.add(mesh.geometry);
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let isAlphaFoliage = false;
      for (const mat of mats) {
        if (!mat) continue;
        trackedMats.add(mat);
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (mat.alphaTest > 0 || mat.transparent) {
            isAlphaFoliage = true;
          }
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = aniso;
            mat.map.needsUpdate = true;
            trackedTexs.add(mat.map);
          }
          if (mat.normalMap) {
            mat.normalMap.anisotropy = aniso;
            trackedTexs.add(mat.normalMap);
          }
        }
      }

      const canCast = allowCastShadow && !isAlphaFoliage;
      const canReceive = allowReceiveShadow;
      mesh.userData.__noCastShadow = !canCast;
      mesh.userData.__noReceiveShadow = !canReceive;
      mesh.castShadow = shadowsActive && canCast;
      mesh.receiveShadow = shadowsActive && canReceive;
    });
  };

  const spawnPlacedModel = async (
    targetGroup: THREE.Group,
    spec: PlaceModelSpec
  ): Promise<THREE.Group | null> => {
    try {
      const loaded = await load3DModelFromUrl(spec.url, spec.url, aniso);
      if (disposed) {
        disposeLoadedModel(loaded.scene);
        return null;
      }

      const baseRoot = loaded.scene;
      normalizeAssetToTarget(baseRoot, {
        targetHeight: spec.targetHeight,
        targetMaxSpan: spec.targetMaxSpan,
      });
      configureLoadedMeshes(
        baseRoot,
        spec.castShadow !== false,
        spec.receiveShadow !== false
      );

      const primaryHolder = new THREE.Group();
      primaryHolder.add(baseRoot);
      const gy = groundHeightAt(spec.x, spec.z);
      primaryHolder.position.set(spec.x, gy + (spec.yOffset ?? 0), spec.z);
      primaryHolder.rotation.y = spec.rotY ?? 0;
      targetGroup.add(primaryHolder);

      if (spec.animate && loaded.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(baseRoot);
        const clip = loaded.animations[0];
        const action = mixer.clipAction(clip);
        action.play();
        mixers.push(mixer);
      }

      if (spec.cloneTo) {
        for (const c of spec.cloneTo) {
          const cloneRoot = baseRoot.clone(true);
          const cHolder = new THREE.Group();
          cHolder.add(cloneRoot);
          if (c.scaleMul && c.scaleMul !== 1) {
            cHolder.scale.setScalar(c.scaleMul);
          }
          const cy = groundHeightAt(c.x, c.z);
          cHolder.position.set(c.x, cy + (c.yOffset ?? 0), c.z);
          cHolder.rotation.y = c.rotY ?? 0;
          targetGroup.add(cHolder);
        }
      }
      return primaryHolder;
    } catch (err) {
      console.warn(`Could not load world asset ${spec.url}:`, err);
      return null;
    }
  };

  // Extract discrete botanical clumps from Scanned_Plants_and_Grass_Free_Download.usdz via InstancedMesh
  const spawnScatteredUsdzPlants = async (
    targetGroup: THREE.Group,
    url: string,
    placements: Array<{ x: number; z: number; rotY: number; targetHeight: number }>
  ) => {
    try {
      const loaded = await load3DModelFromUrl(url, url, aniso);
      if (disposed) {
        disposeLoadedModel(loaded.scene);
        return;
      }
      loaded.scene.updateMatrixWorld(true);

      const candidates: THREE.Mesh[] = [];
      loaded.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (!mesh.geometry) return;
          const b = new THREE.Box3().setFromObject(mesh);
          const sz = b.getSize(new THREE.Vector3());
          if (sz.y > 0.02 && Math.max(sz.x, sz.z) > 0.02 && Math.max(sz.x, sz.z) < 6.0) {
            candidates.push(mesh);
          }
        }
      });

      if (candidates.length === 0 || placements.length === 0) {
        disposeLoadedModel(loaded.scene);
        return;
      }

      const maxProtos = Math.min(6, placements.length);
      const step = Math.max(1, Math.floor(candidates.length / maxProtos));
      const protos: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];

      for (let i = 0; i < candidates.length && protos.length < maxProtos; i += step) {
        const src = candidates[i];
        const geo = src.geometry.clone();
        geo.applyMatrix4(src.matrixWorld);
        geo.computeBoundingBox();
        if (!geo.boundingBox) {
          geo.dispose();
          continue;
        }
        const sz = geo.boundingBox.getSize(new THREE.Vector3());
        const center = geo.boundingBox.getCenter(new THREE.Vector3());
        const normScale = 1 / Math.max(0.02, sz.y);
        geo.translate(-center.x, -geo.boundingBox.min.y, -center.z);
        geo.scale(normScale, normScale, normScale);
        geo.computeBoundingSphere();
        trackedGeos.add(geo);

        const srcMat = Array.isArray(src.material) ? src.material[0] : src.material;
        const mat = srcMat ? srcMat.clone() : new THREE.MeshStandardMaterial({ color: '#4d7c3f' });
        trackedMats.add(mat);
        if (mat instanceof THREE.MeshStandardMaterial) {
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.anisotropy = aniso;
            trackedTexs.add(mat.map);
          }
          mat.transparent = false;
          mat.alphaTest = 0.32;
          mat.side = THREE.DoubleSide;
          mat.depthWrite = true;
        }
        applyNaturalWindShader(mat, {
          swayScaleM: 0.042,
          flutterScaleM: 0.016,
          heightMode: 'worldMeters',
          heightBaseM: 0.02,
          refHeightM: 0.65,
          useModelRoot: false,
          bendExponent: 1.45,
        });
        protos.push({ geo, mat });
      }

      const buckets = new Map<number, THREE.Matrix4[]>();
      const dummy = new THREE.Object3D();
      placements.forEach((p, idx) => {
        const vIdx = idx % protos.length;
        dummy.position.set(p.x, groundHeightAt(p.x, p.z) - 0.02, p.z);
        dummy.rotation.set(0, p.rotY, 0);
        dummy.scale.setScalar(p.targetHeight);
        dummy.updateMatrix();
        const list = buckets.get(vIdx) ?? [];
        list.push(dummy.matrix.clone());
        buckets.set(vIdx, list);
      });

      for (const [vIdx, matrices] of buckets.entries()) {
        const proto = protos[vIdx];
        const im = new THREE.InstancedMesh(proto.geo, proto.mat, matrices.length);
        im.name = `LakesideGrass_v${vIdx}`;
        matrices.forEach((m4, idx) => im.setMatrixAt(idx, m4));
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.userData.__noCastShadow = true;
        im.userData.__noReceiveShadow = true;
        im.castShadow = false;
        im.receiveShadow = false;
        targetGroup.add(im);
        instancedMeshesToDispose.push(im);
      }

      disposeLoadedModel(loaded.scene);
    } catch (err) {
      console.warn(`Could not scatter plants from ${url}:`, err);
    }
  };

  // =========================================================================
  // 1. KAMPALA COMPOUND EXTRAS
  // =========================================================================
  const buildKampalaExtras = (pg: THREE.Group) => {
    void Promise.all([
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/chicken_coop_free.glb',
        x: 5.55,
        z: -4.9,
        rotY: -0.58,
        targetHeight: 1.65,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/chicken__1_.glb',
        x: 3.95,
        z: -3.55,
        rotY: -0.95,
        targetHeight: 0.44,
        animate: true,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/a_chicken_in_low_poly.glb',
        x: 4.55,
        z: -4.15,
        rotY: 1.45,
        targetHeight: 0.36,
      }),
    ]);
  };

  // =========================================================================
  // 2. TRADING CENTRE (Independent Ugandan Market Plaza + Shopfronts + Street)
  // =========================================================================
  const buildTradingCentre = (pg: THREE.Group) => {
    // Laterite roadside avenue behind the market square
    const roadGeo = new THREE.PlaneGeometry(46, 5.2);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: '#3f3b38',
      roughness: 0.92,
      metalness: 0.02,
    });
    trackedGeos.add(roadGeo);
    trackedMats.add(roadMat);
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.position.set(0, 0.015, -10.8);
    roadMesh.receiveShadow = true;
    pg.add(roadMesh);

    // Sunlit dusty market sidewalk curb separating court plaza from road
    const curbGeo = new THREE.BoxGeometry(36, 0.14, 0.45);
    const curbMat = new THREE.MeshStandardMaterial({ color: '#9c8a78', roughness: 0.9 });
    trackedGeos.add(curbGeo);
    trackedMats.add(curbMat);
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.position.set(0, 0.05, -8.1);
    curb.receiveShadow = true;
    pg.add(curb);

    // Small Ugandan colorful shopfronts framing outer market alley (left/right back corners)
    const addMarketDuka = (dx: number, dz: number, wallHex: string, roofHex: string, rotY: number) => {
      const duka = new THREE.Group();
      const wMat = new THREE.MeshStandardMaterial({ color: wallHex, roughness: 0.88 });
      const rMat = new THREE.MeshStandardMaterial({ color: roofHex, roughness: 0.55, metalness: 0.35 });
      const aMat = new THREE.MeshStandardMaterial({ color: '#c2410c', roughness: 0.72 });
      trackedMats.add(wMat);
      trackedMats.add(rMat);
      trackedMats.add(aMat);

      const bGeo = new THREE.BoxGeometry(4.4, 2.9, 3.4);
      const rfGeo = new THREE.BoxGeometry(4.8, 0.14, 4.1);
      const awnGeo = new THREE.BoxGeometry(4.4, 0.08, 1.3);
      trackedGeos.add(bGeo);
      trackedGeos.add(rfGeo);
      trackedGeos.add(awnGeo);

      const body = new THREE.Mesh(bGeo, wMat);
      body.position.y = 1.45;
      body.castShadow = true;
      body.receiveShadow = true;
      duka.add(body);

      const roof = new THREE.Mesh(rfGeo, rMat);
      roof.position.y = 2.96;
      roof.rotation.x = 0.08;
      roof.castShadow = true;
      duka.add(roof);

      const awning = new THREE.Mesh(awnGeo, aMat);
      awning.position.set(0, 2.25, 2.15);
      awning.rotation.x = 0.25;
      awning.castShadow = true;
      duka.add(awning);

      duka.position.set(dx, groundHeightAt(dx, dz) - 0.05, dz);
      duka.rotation.y = rotY;
      pg.add(duka);
    };

    addMarketDuka(-9.6, -4.6, '#e7d5b8', '#8c3b28', Math.PI * 0.42);
    addMarketDuka(10.1, -4.2, '#d9e3d0', '#2b5f44', -Math.PI * 0.42);
    addMarketDuka(-9.8, 4.4, '#f0dec2', '#9c4c27', Math.PI * 0.54);

    void Promise.all([
      spawnPlacedModel(pg, {
        url: '/assets/worlds/trading_centre/market_stall.glb',
        x: -4.45,
        z: -1.1,
        rotY: Math.PI * 0.44,
        targetHeight: 2.75,
        cloneTo: [
          { x: -4.65, z: 2.85, rotY: Math.PI * 0.54 },
          { x: 5.15, z: -1.65, rotY: -Math.PI * 0.46 },
        ],
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/trading_centre/market_stall__sleeping_dogs_universe__opt.ver..glb',
        x: 0.35,
        z: -6.15,
        rotY: 0,
        targetHeight: 2.85,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/trading_centre/drink_booth.glb',
        x: -4.15,
        z: -5.1,
        rotY: Math.PI * 0.25,
        targetHeight: 2.65,
        cloneTo: [{ x: 5.05, z: 2.55, rotY: -Math.PI * 0.58 }],
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/trading_centre/bananas_with_a_surprise.glb',
        x: -3.2,
        z: -0.45,
        rotY: 0.4,
        targetHeight: 0.72,
        castShadow: false,
        cloneTo: [{ x: 3.95, z: -0.7, rotY: -0.75 }],
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/trading_centre/low-poly_simple_wooden_crate.glb',
        x: -3.3,
        z: 2.0,
        rotY: 0.25,
        targetHeight: 0.58,
        cloneTo: [
          { x: -3.55, z: 2.62, rotY: -0.3 },
          { x: 4.1, z: 1.85, rotY: 0.6 },
        ],
      }),
      spawnPlacedModel(pg, {
        url: '/assets/vehicles/low_poly_2013_toyota_hiace.glb',
        x: -4.8,
        z: -10.5,
        rotY: Math.PI * 0.5,
        targetHeight: 2.02,
        castShadow: false,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/vehicles/honda_prelude_bp1.glb',
        x: 5.2,
        z: -10.9,
        rotY: -Math.PI * 0.5,
        targetHeight: 1.48,
        castShadow: false,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/bicycle_classic.glb',
        x: 4.1,
        z: 4.6,
        rotY: -0.8,
        targetHeight: 1.05,
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/chicken__1_.glb',
        x: 3.6,
        z: -3.2,
        rotY: -1.2,
        targetHeight: 0.42,
        animate: true,
      }),
      spawnOakTrees(pg, [
        { x: -12.4, z: -9.8, height: 7.4, rotY: 0.4, variant: 0 },
        { x: 12.6, z: -9.5, height: 7.8, rotY: 1.9, variant: 2 },
        { x: -12.2, z: 8.8, height: 6.9, rotY: 2.5, variant: 4 },
        { x: 11.8, z: 8.6, height: 7.2, rotY: 0.9, variant: 6 },
      ]),
    ]);
  };

  // =========================================================================
  // 3. PRIMARY SCHOOLYARD (Authentic Ugandan UPE Brick Classrooms & Murram Yard)
  // =========================================================================
  const buildPrimarySchoolyard = (pg: THREE.Group) => {
    schoolyardRig = buildPrimarySchoolyardEnvironment({
      textures: options.textures,
      isSoftwareGl: options.isSoftwareGl,
      shadowsEnabled: options.shadowsEnabled,
      maxAnisotropy: aniso,
    });
    pg.add(schoolyardRig.group);

    // Mature shade oak trees framing outer school compound & football pitch perimeter
    void spawnOakTrees(pg, [
      { x: -12.6, z: -13.8, height: 8.0, rotY: 0.5, variant: 1 },
      { x: 12.8, z: -14.2, height: 7.6, rotY: 2.1, variant: 3 },
      { x: -12.5, z: 7.2, height: 7.2, rotY: 1.3, variant: 5 },
      { x: 11.4, z: 7.4, height: 7.4, rotY: 0.8, variant: 9 },
      { x: -13.2, z: -29.0, height: 8.6, rotY: 2.8, variant: 7 },
      { x: 12.4, z: -31.0, height: 8.4, rotY: 1.6, variant: 11 },
      { x: -7.5, z: -42.5, height: 8.2, rotY: 0.4, variant: 13 },
      { x: 9.2, z: -44.0, height: 8.5, rotY: 2.4, variant: 15 },
    ]);
  };

  // =========================================================================
  // 4. ENTEBBE LAKESIDE (Curved Golden Cove + Turquoise Lake Victoria + Palms)
  // =========================================================================
  const buildEntebbeLakeside = (pg: THREE.Group) => {
    entebbeRig = buildEntebbeLakesideEnvironment({
      isSoftwareGl: options.isSoftwareGl,
      shadowsEnabled: options.shadowsEnabled,
      maxAnisotropy: aniso,
    });
    pg.add(entebbeRig.group);

    void (async () => {
      const b1 = await spawnPlacedModel(pg, {
        url: '/assets/worlds/entebbe_lakeside/fishing_boat.glb',
        x: 3.1,
        z: -11.8,
        rotY: 0.65,
        targetMaxSpan: 5.2,
        castShadow: false,
      });
      if (b1) {
        b1.position.y = -0.82;
        floatingBoats.push({ holder: b1, baseY: -0.82, phase: 0 });
      }
    })();
  };

  // =========================================================================
  // 5. NDERE FESTIVAL (Village Huts, Full Oak Trees & Glowing Cultural Lanterns)
  // =========================================================================
  const buildNdereFestival = (pg: THREE.Group) => {
    const poleGeo = new THREE.CylinderGeometry(0.055, 0.075, 2.35, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: '#422313', roughness: 0.88 });
    const globeGeo = new THREE.SphereGeometry(0.18, 12, 10);
    const globeMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#f59e0b',
      emissiveIntensity: 1.9,
      roughness: 0.3,
    });
    trackedGeos.add(poleGeo);
    trackedGeos.add(globeGeo);
    trackedMats.add(poleMat);
    trackedMats.add(globeMat);

    const lanternCoords: Array<[number, number]> = [
      [-3.1, -3.5],
      [3.6, -3.5],
      [-3.1, 0.4],
      [3.6, 0.4],
      [-3.1, 4.1],
      [3.6, 4.1],
    ];
    for (let i = 0; i < lanternCoords.length; i++) {
      const [lx, lz] = lanternCoords[i];
      const ly = groundHeightAt(lx, lz);
      const post = new THREE.Mesh(poleGeo, poleMat);
      post.position.set(lx, ly + 1.15, lz);
      post.castShadow = !options.isSoftwareGl && options.shadowsEnabled();
      pg.add(post);

      const globe = new THREE.Mesh(globeGeo, globeMat);
      globe.position.set(lx, ly + 2.38, lz);
      pg.add(globe);

      if (i % 2 === 0) {
        const pt = new THREE.PointLight('#ffaa3b', 3.6, 10.5, 1.5);
        pt.position.set(lx, ly + 2.4, lz);
        pg.add(pt);
      }
    }

    void Promise.all([
      spawnPlacedModel(pg, {
        url: '/assets/worlds/ndere_festival/luo_hut.usdz',
        x: -5.8,
        z: -5.4,
        rotY: 0.52,
        targetHeight: 3.65,
        cloneTo: [
          { x: 6.3, z: -5.8, rotY: -0.65, scaleMul: 0.92 },
          { x: 0.4, z: -8.9, rotY: 0.08, scaleMul: 1.05 },
        ],
      }),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/kampala_compound/bicycle_classic.glb',
        x: -3.9,
        z: -4.2,
        rotY: 1.1,
        targetHeight: 1.04,
      }),
      spawnOakTrees(pg, [
        { x: -10.2, z: -8.6, height: 7.2, rotY: 0.4, variant: 0 },
        { x: 10.4, z: -8.2, height: 7.6, rotY: 1.9, variant: 3 },
        { x: -10.6, z: 3.0, height: 6.8, rotY: 2.5, variant: 5 },
        { x: 10.2, z: 3.2, height: 7.1, rotY: 0.8, variant: 8 },
        { x: -7.8, z: 9.4, height: 6.5, rotY: 1.4, variant: 11 },
        { x: 8.0, z: 9.2, height: 6.9, rotY: 2.9, variant: 14 },
      ]),
    ]);
  };

  const ensurePlaceBuilt = (place: WorldPlaceId) => {
    const pg = getOrCreatePlaceGroup(place);
    if (builtOrBuilding.has(place)) return;
    builtOrBuilding.add(place);

    if (place === 'kampala_compound') {
      buildKampalaExtras(pg);
    } else if (place === 'trading_centre') {
      buildTradingCentre(pg);
    } else if (place === 'primary_schoolyard') {
      buildPrimarySchoolyard(pg);
    } else if (place === 'entebbe_lakeside') {
      buildEntebbeLakeside(pg);
    } else if (place === 'ndere_festival') {
      buildNdereFestival(pg);
    }
  };

  const setPlace = (place: WorldPlaceId) => {
    activePlace = place;
    ensurePlaceBuilt(place);
    for (const [key, pg] of placeGroups.entries()) {
      pg.visible = key === place;
    }
    if (place !== 'primary_schoolyard') {
      arrivalActive = false;
    }
    options.onKampalaToggle(place === 'kampala_compound');
    options.onOuterHillsToggle(place !== 'entebbe_lakeside' && place !== 'primary_schoolyard');
  };

  const startArrivalSequence = (_place: WorldPlaceId): boolean => {
    arrivalActive = false;
    return false;
  };

  const skipArrivalSequence = () => {
    arrivalActive = false;
  };

  const isArrivalPlaying = () => false;

  const getArrivalCameraTarget = (): ArrivalCameraTarget | null => null;

  // Start Kampala Compound extras immediately
  setPlace('kampala_compound');

  const update = (dt: number, elapsed: number, wetness = 0) => {
    for (const mixer of mixers) {
      mixer.update(dt);
    }
    if (entebbeRig && entebbeRig.group.parent?.visible) {
      entebbeRig.update(elapsed, wetness);
    }
    if (schoolyardRig && schoolyardRig.group.parent?.visible) {
      schoolyardRig.update(elapsed, wetness);
    }
    for (const w of animatedWaterMeshes) {
      if (w.mesh.parent?.visible) {
        w.mesh.position.y = w.baseY + Math.sin(elapsed * 1.4) * 0.025;
      }
    }
    for (const b of floatingBoats) {
      if (b.holder.parent?.visible) {
        b.holder.position.y = b.baseY + Math.sin(elapsed * 1.5 + b.phase) * 0.035;
        b.holder.rotation.z = Math.sin(elapsed * 1.1 + b.phase) * 0.028;
      }
    }
  };

  const setShadowsEnabled = (enabled: boolean) => {
    const active = !options.isSoftwareGl && enabled;
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = active && !obj.userData.__noCastShadow;
        obj.receiveShadow = active && !obj.userData.__noReceiveShadow;
      }
    });
    entebbeRig?.setShadowsEnabled(enabled);
    schoolyardRig?.setShadowsEnabled(enabled);
  };

  const dispose = () => {
    disposed = true;
    arrivalActive = false;
    entebbeRig?.dispose();
    entebbeRig = null;
    schoolyardRig?.dispose();
    schoolyardRig = null;
    for (const m of mixers) m.stopAllAction();
    mixers.length = 0;
    for (const im of instancedMeshesToDispose) im.dispose();
    instancedMeshesToDispose.length = 0;
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
    placeGroups.clear();
  };

  return {
    group,
    setPlace,
    startArrivalSequence,
    skipArrivalSequence,
    isArrivalPlaying,
    getArrivalCameraTarget,
    update,
    setShadowsEnabled,
    dispose,
  };
}
