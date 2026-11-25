import * as THREE from 'three';
import { WorldPlaceId } from '../game/progression';
import { extractOakLod0Prototypes } from './distantWorld';
import { disposeLoadedModel, isSharedResource, load3DModelFromUrl } from './modelLoader';
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
  update: (dt: number, elapsed: number) => void;
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

  // Car Arrival Sequence state (used in Primary Schoolyard / Park & Playground)
  let arrivalCarHolder: THREE.Group | null = null;
  let arrivalActive = false;
  let arrivalElapsed = 0;
  const ARRIVAL_TOTAL_DURATION = 5.4;
  const _arrivalCamPos = new THREE.Vector3();
  const _arrivalLookAt = new THREE.Vector3();

  const PARKED_CAR_POS = { x: -5.85, z: -8.35, rotY: 0.24 };

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
  // 3. PRIMARY SCHOOLYARD & PARK + TRAILER PARK LANE + CAR ARRIVAL + PLAYGROUND
  // =========================================================================
  const buildPrimarySchoolyard = (pg: THREE.Group) => {
    // Paved approach lane linking Trailer Park neighborhood to the Playground & Park court
    const laneGeo = new THREE.PlaneGeometry(34, 4.2);
    laneGeo.rotateX(-Math.PI / 2);
    const laneMat = new THREE.MeshStandardMaterial({
      color: '#524e4b',
      roughness: 0.9,
      metalness: 0.02,
    });
    trackedGeos.add(laneGeo);
    trackedMats.add(laneMat);
    const lane = new THREE.Mesh(laneGeo, laneMat);
    lane.position.set(-7.5, 0.012, -8.5);
    lane.receiveShadow = true;
    pg.add(lane);

    void Promise.all([
      // A. Complete Park Environment kept at TRUE human scale (0.78x) so lamp posts & trees are 3.5–4m tall!
      (async () => {
        try {
          const loaded = await load3DModelFromUrl(
            '/assets/worlds/primary_schoolyard/Park.usdz',
            'Park.usdz',
            aniso
          );
          if (disposed) {
            disposeLoadedModel(loaded.scene);
            return;
          }
          const parkRoot = loaded.scene;
          parkRoot.scale.setScalar(0.78);
          parkRoot.updateMatrixWorld(true);

          // Hide giant 224m Plane_001 outer slab that causes Z-fighting, keep walkways/lamps/trees
          parkRoot.traverse((obj) => {
            if ((obj as THREE.Mesh).isMesh) {
              const b = new THREE.Box3().setFromObject(obj);
              const s = b.getSize(new THREE.Vector3());
              if (Math.max(s.x, s.z) > 85 && s.y < 0.25) {
                obj.visible = false;
              }
            }
          });

          configureLoadedMeshes(parkRoot);

          const parkHolder = new THREE.Group();
          parkHolder.name = 'CompleteParkScene';
          parkHolder.add(parkRoot);
          // Align the near park lamp/walkway cluster nicely around the court & playground
          parkHolder.position.set(16.5, -0.02, -4.5);
          pg.add(parkHolder);
          parkHolder.updateMatrixWorld(true);

          // Move any trees/lamps inside central hopscotch court clearing outward cleanly,
          // and disable shadow casting on distant outer Park props (> 12m from court)
          const tempBox = new THREE.Box3();
          const tempCenter = new THREE.Vector3();
          const tempSize = new THREE.Vector3();
          const moved = new Set<THREE.Object3D>();
          parkRoot.traverse((obj) => {
            if (!(obj as THREE.Mesh).isMesh || !obj.visible) return;
            const targetObj =
              obj.parent && obj.parent !== parkRoot && obj.parent.children.length <= 4
                ? obj.parent
                : obj;
            tempBox.setFromObject(obj);
            tempBox.getCenter(tempCenter);
            tempBox.getSize(tempSize);
            if (Math.hypot(tempCenter.x, tempCenter.z) > 12 || tempSize.y < 0.25) {
              obj.userData.__noCastShadow = true;
              obj.castShadow = false;
            }
            if (moved.has(targetObj)) return;
            if (tempSize.y < 0.35 || Math.max(tempSize.x, tempSize.z) > 15) return;
            if (Math.abs(tempCenter.x - 0.25) < 2.9 && Math.abs(tempCenter.z - 0.35) < 4.9) {
              moved.add(targetObj);
              const dirX = tempCenter.x >= 0.25 ? 1 : -1;
              targetObj.position.x += (dirX * 6.4 - (tempCenter.x - 0.25)) / 0.78;
            }
          });
        } catch (err) {
          console.warn('Could not load complete Park environment:', err);
        }
      })(),

      // B. Trailer Park Neighborhood along the Western Approach Avenue (true 34x human scale!)
      (async () => {
        try {
          const loaded = await load3DModelFromUrl(
            '/assets/props/Trailer_Park.usdz',
            'Trailer_Park.usdz',
            aniso
          );
          if (disposed) {
            disposeLoadedModel(loaded.scene);
            return;
          }
          const tpRoot = loaded.scene;
          // Hide sky backdrop cards & occluded interior furniture inside trailers for crisp FPS
          tpRoot.traverse((obj) => {
            if (
              obj.name &&
              /^(Background|Bed|Stove|Couch|Casserole|Skillet|knife|Cereal|washbasin|Cookware|Toilet|trash_can|Champoo|soap|Books|Clock|Picture_frames|Fridge|Table|Chair|Pillow|Blanket|Sink|Shower|Bathtub)/i.test(
                obj.name
              )
            ) {
              obj.visible = false;
            }
          });

          tpRoot.scale.setScalar(34);
          tpRoot.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(tpRoot);
          const center = box.getCenter(new THREE.Vector3());
          tpRoot.position.set(-center.x, -box.min.y, -center.z);
          // Far neighborhood along x=-19.5 skips directional shadow casting
          configureLoadedMeshes(tpRoot, false, true);

          const tpHolder = new THREE.Group();
          tpHolder.name = 'TrailerParkApproachNeighborhood';
          tpHolder.add(tpRoot);
          // Line the neighborhood along the approach road (left-rear) leading to the playground!
          tpHolder.position.set(-19.5, -0.04, -15.5);
          tpHolder.rotation.y = Math.PI * 0.5;
          pg.add(tpHolder);
        } catch (err) {
          console.warn('Could not load Trailer Park scene:', err);
        }
      })(),

      // C. Schoolyard Playground directly beside the court
      spawnPlacedModel(pg, {
        url: '/assets/worlds/primary_schoolyard/playground.usdz',
        x: -5.5,
        z: -2.6,
        rotY: 0.48,
        targetHeight: 3.15,
      }),

      // D. Arrival Car (parks right beside Playground / starts back at Trailer Park lane on Arrival Intro)
      (async () => {
        const carHolder = await spawnPlacedModel(pg, {
          url: '/assets/vehicles/honda_odyssey_2021_low_detail_asian_market.glb',
          x: PARKED_CAR_POS.x,
          z: PARKED_CAR_POS.z,
          rotY: PARKED_CAR_POS.rotY,
          targetHeight: 1.68,
        });
        if (carHolder && !disposed) {
          carHolder.name = 'PlaygroundArrivalCar';
          arrivalCarHolder = carHolder;
        }
      })(),

      // E. Complete Full-Canopy Oak Trees framing the park & playground
      spawnOakTrees(pg, [
        { x: 6.4, z: -5.8, height: 6.8, rotY: 0.5, variant: 1 },
        { x: 6.8, z: 4.8, height: 7.4, rotY: 2.1, variant: 3 },
        { x: -8.8, z: 5.4, height: 6.6, rotY: 1.3, variant: 5 },
        { x: 0.8, z: -12.6, height: 7.8, rotY: 3.0, variant: 7 },
        { x: 10.6, z: -1.4, height: 7.1, rotY: 0.8, variant: 9 },
      ]),
    ]);
  };

  // =========================================================================
  // 4. ENTEBBE LAKESIDE (Golden Sand Beach + Lake Victoria + Boats + Scanned Rocks/Plants)
  // =========================================================================
  const buildEntebbeLakeside = (pg: THREE.Group) => {
    const sandGeo = new THREE.PlaneGeometry(180, 120, 14, 14);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({
      color: '#cfb077',
      roughness: 0.92,
      metalness: 0.02,
    });
    trackedGeos.add(sandGeo);
    trackedMats.add(sandMat);
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.set(0, -0.02, 52);
    sandMesh.userData.__noCastShadow = true;
    sandMesh.castShadow = false;
    sandMesh.receiveShadow = true;
    pg.add(sandMesh);

    const waterGeo = new THREE.PlaneGeometry(260, 185, 14, 14);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: '#186a84',
      roughness: 0.14,
      metalness: 0.36,
      transparent: true,
      opacity: 0.93,
    });
    trackedGeos.add(waterGeo);
    trackedMats.add(waterMat);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(0, -0.18, -99);
    waterMesh.userData.__noCastShadow = true;
    waterMesh.castShadow = false;
    waterMesh.receiveShadow = true;
    pg.add(waterMesh);
    animatedWaterMeshes.push({ mesh: waterMesh, baseY: -0.18 });

    const foamGeo = new THREE.PlaneGeometry(180, 1.45);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: '#dff4f9',
      transparent: true,
      opacity: 0.42,
    });
    trackedGeos.add(foamGeo);
    trackedMats.add(foamMat);
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.position.set(0, -0.11, -7.4);
    foamMesh.userData.__noCastShadow = true;
    foamMesh.userData.__noReceiveShadow = true;
    foamMesh.castShadow = false;
    foamMesh.receiveShadow = false;
    pg.add(foamMesh);

    void Promise.all([
      (async () => {
        const b1 = await spawnPlacedModel(pg, {
          url: '/assets/worlds/entebbe_lakeside/fishing_boat.glb',
          x: -4.6,
          z: -9.3,
          rotY: 0.42,
          yOffset: -0.14,
          targetMaxSpan: 6.4,
          castShadow: false,
        });
        if (b1) floatingBoats.push({ holder: b1, baseY: b1.position.y, phase: 0 });
      })(),
      (async () => {
        const b2 = await spawnPlacedModel(pg, {
          url: '/assets/worlds/entebbe_lakeside/gislinge_viking_boat.glb',
          x: 6.0,
          z: -12.0,
          rotY: -0.38,
          yOffset: -0.2,
          targetMaxSpan: 7.2,
          castShadow: false,
        });
        if (b2) floatingBoats.push({ holder: b2, baseY: b2.position.y, phase: 1.7 });
      })(),
      spawnPlacedModel(pg, {
        url: '/assets/worlds/entebbe_lakeside/rock_formation_scan_2.usdz',
        x: -7.6,
        z: -6.4,
        rotY: 0.8,
        yOffset: -0.1,
        targetHeight: 1.85,
        castShadow: false,
        cloneTo: [
          { x: 7.4, z: -6.0, rotY: -1.1, scaleMul: 0.92, yOffset: -0.08 },
          { x: -9.5, z: -1.8, rotY: 2.2, scaleMul: 0.82, yOffset: -0.06 },
        ],
      }),
      spawnScatteredUsdzPlants(
        pg,
        '/assets/worlds/entebbe_lakeside/Scanned_Plants_and_Grass_Free_Download.usdz',
        [
          { x: -5.4, z: -5.1, rotY: 0.3, targetHeight: 0.72 },
          { x: -4.2, z: -5.8, rotY: 1.8, targetHeight: 0.58 },
          { x: 4.3, z: -5.3, rotY: 2.4, targetHeight: 0.68 },
          { x: 5.5, z: -4.6, rotY: 0.9, targetHeight: 0.62 },
          { x: -6.2, z: 2.4, rotY: 1.2, targetHeight: 0.75 },
          { x: 6.1, z: 2.8, rotY: 2.7, targetHeight: 0.68 },
          { x: -4.9, z: 5.8, rotY: 0.5, targetHeight: 0.64 },
          { x: 5.2, z: 5.4, rotY: 1.9, targetHeight: 0.7 },
        ]
      ),
      spawnOakTrees(pg, [
        { x: -9.6, z: 4.4, height: 6.5, rotY: 0.7, variant: 10 },
        { x: 9.4, z: 4.2, height: 6.8, rotY: 2.1, variant: 12 },
        { x: -11.5, z: 9.8, height: 7.2, rotY: 1.4, variant: 14 },
        { x: 11.2, z: 9.6, height: 7.0, rotY: 2.8, variant: 16 },
      ]),
    ]);
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
    options.onOuterHillsToggle(place !== 'entebbe_lakeside');
  };

  const startArrivalSequence = (place: WorldPlaceId): boolean => {
    if (place !== 'primary_schoolyard') {
      arrivalActive = false;
      return false;
    }
    ensurePlaceBuilt('primary_schoolyard');
    arrivalActive = true;
    arrivalElapsed = 0;
    return true;
  };

  const skipArrivalSequence = () => {
    arrivalActive = false;
    if (arrivalCarHolder) {
      const py = groundHeightAt(PARKED_CAR_POS.x, PARKED_CAR_POS.z);
      arrivalCarHolder.position.set(PARKED_CAR_POS.x, py, PARKED_CAR_POS.z);
      arrivalCarHolder.rotation.set(0, PARKED_CAR_POS.rotY, 0);
    }
  };

  const isArrivalPlaying = () => arrivalActive;

  const getArrivalCameraTarget = (): ArrivalCameraTarget | null => {
    if (!arrivalActive) return null;
    const progress = THREE.MathUtils.clamp(arrivalElapsed / ARRIVAL_TOTAL_DURATION, 0, 1);

    // Phase 1 (0 -> 0.56): Car drives down Trailer Park road toward Playground
    if (progress < 0.56) {
      const t = progress / 0.56;
      const ease = 1 - Math.pow(1 - t, 2.2);
      const carX = THREE.MathUtils.lerp(-15.5, PARKED_CAR_POS.x, ease);
      const carZ = THREE.MathUtils.lerp(-13.4, PARKED_CAR_POS.z, ease);

      _arrivalCamPos.set(carX + 5.2, 2.65 + (1 - ease) * 0.5, carZ + 5.4);
      _arrivalLookAt.set(carX - 0.5, 0.95, carZ - 0.3);
      return { active: true, progress, camPos: _arrivalCamPos, lookAt: _arrivalLookAt, fov: 44 };
    }

    // Phase 2 (0.56 -> 1.0): Camera sweeps from parked car across playground swings onto Sonko court
    const t2 = (progress - 0.56) / 0.44;
    const smooth = t2 * t2 * (3 - 2 * t2);
    _arrivalCamPos.set(
      THREE.MathUtils.lerp(-0.65, 0.32, smooth),
      THREE.MathUtils.lerp(2.65, 3.05, smooth),
      THREE.MathUtils.lerp(-2.95, 6.25, smooth)
    );
    _arrivalLookAt.set(
      THREE.MathUtils.lerp(-5.4, 0.25, smooth),
      THREE.MathUtils.lerp(1.15, 0.35, smooth),
      THREE.MathUtils.lerp(-4.5, 0.25, smooth)
    );
    return {
      active: true,
      progress,
      camPos: _arrivalCamPos,
      lookAt: _arrivalLookAt,
      fov: THREE.MathUtils.lerp(44, 45, smooth),
    };
  };

  // Start Kampala Compound extras immediately
  setPlace('kampala_compound');

  const update = (dt: number, elapsed: number) => {
    for (const mixer of mixers) {
      mixer.update(dt);
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

    // Drive Car Arrival animation when active
    if (arrivalActive) {
      arrivalElapsed += dt;
      const tDrive = THREE.MathUtils.clamp(arrivalElapsed / (ARRIVAL_TOTAL_DURATION * 0.56), 0, 1);
      const easeDrive = 1 - Math.pow(1 - tDrive, 2.2);

      if (arrivalCarHolder) {
        const cx = THREE.MathUtils.lerp(-15.5, PARKED_CAR_POS.x, easeDrive);
        const cz = THREE.MathUtils.lerp(-13.4, PARKED_CAR_POS.z, easeDrive);
        const roadBounce = tDrive < 0.96 ? Math.sin(arrivalElapsed * 24) * 0.012 : 0;
        const brakePitch =
          tDrive > 0.72 && tDrive < 0.98
            ? Math.sin(((tDrive - 0.72) / 0.26) * Math.PI) * 0.032
            : 0;
        arrivalCarHolder.position.set(cx, groundHeightAt(cx, cz) + roadBounce, cz);
        arrivalCarHolder.rotation.set(
          brakePitch,
          THREE.MathUtils.lerp(0.95, PARKED_CAR_POS.rotY, easeDrive),
          0
        );
      }

      if (arrivalElapsed >= ARRIVAL_TOTAL_DURATION) {
        skipArrivalSequence();
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
  };

  const dispose = () => {
    disposed = true;
    arrivalActive = false;
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
