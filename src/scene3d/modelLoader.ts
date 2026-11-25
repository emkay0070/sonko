import * as THREE from 'three';
import { GLTFLoader, GLTFParser } from 'three/addons/loaders/GLTFLoader.js';
import { USDLoader } from 'three/addons/loaders/USDLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export interface Loaded3DModel {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
}

export interface AssetLoadMetric {
  url: string;
  loadDecodeMs: number;
  cached: boolean;
  hits: number;
}

const SHARED_RESOURCE_FLAG = '__sharedCacheResource';

const cachedModelTemplates = new Map<string, Promise<Loaded3DModel>>();
const assetLoadMetrics = new Map<string, AssetLoadMetric>();
let pendingModelLoads = 0;

export function getPendingModelLoadCount(): number {
  return pendingModelLoads;
}

export function getAssetLoadMetrics(): AssetLoadMetric[] {
  return Array.from(assetLoadMetrics.values()).map((m) => ({ ...m }));
}

export function clearAssetLoadMetrics(): void {
  assetLoadMetrics.clear();
}

export function markAsSharedResource(
  resource: THREE.BufferGeometry | THREE.Material | THREE.Texture | null | undefined
): void {
  if (!resource) return;
  if (!resource.userData) resource.userData = {};
  resource.userData[SHARED_RESOURCE_FLAG] = true;
}

export function isSharedResource(
  resource: { userData?: Record<string, unknown> } | null | undefined
): boolean {
  return Boolean(resource?.userData?.[SHARED_RESOURCE_FLAG]);
}

function getMaterialTextures(mat: THREE.Material): THREE.Texture[] {
  const std = mat as THREE.MeshStandardMaterial &
    THREE.MeshPhysicalMaterial &
    THREE.MeshBasicMaterial & { specularMap?: THREE.Texture | null };
  const candidates = [
    std.map,
    std.normalMap,
    std.roughnessMap,
    std.metalnessMap,
    std.aoMap,
    std.emissiveMap,
    std.alphaMap,
    std.bumpMap,
    std.displacementMap,
    std.lightMap,
    std.envMap,
    std.specularMap,
  ];
  return candidates.filter((t): t is THREE.Texture => Boolean(t));
}

function markTemplateSharedResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    markAsSharedResource(mesh.geometry);
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const tex of getMaterialTextures(mat)) {
        markAsSharedResource(tex);
      }
    }
  });
}

function cloneSceneWithInstanceMaterials(templateScene: THREE.Object3D): THREE.Object3D {
  const cloned = SkeletonUtils.clone(templateScene);
  const materialMap = new Map<THREE.Material, THREE.Material>();

  cloned.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((origMat) => {
        if (!origMat) return origMat;
        let copy = materialMap.get(origMat);
        if (!copy) {
          copy = origMat.clone();
          if (copy.userData) {
            delete copy.userData[SHARED_RESOURCE_FLAG];
          }
          materialMap.set(origMat, copy);
        }
        return copy;
      });
    } else if (mesh.material) {
      const origMat = mesh.material;
      let copy = materialMap.get(origMat);
      if (!copy) {
        copy = origMat.clone();
        if (copy.userData) {
          delete copy.userData[SHARED_RESOURCE_FLAG];
        }
        materialMap.set(origMat, copy);
      }
      mesh.material = copy;
    }
  });

  return cloned;
}

/**
 * Safely disposes instance-owned geometries, materials, and textures under `root`
 * while preserving any shared cached geometries or textures (`__sharedCacheResource`).
 */
export function disposeLoadedModel(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  const texs = new Set<THREE.Texture>();

  root.traverse((obj) => {
    const isRenderable =
      (obj as THREE.Mesh).isMesh ||
      (obj as THREE.Points).isPoints ||
      (obj as THREE.Line).isLine;
    if (!isRenderable) {
      return;
    }
    const renderable = obj as THREE.Mesh | THREE.Points | THREE.Line;
    if (renderable.geometry && !isSharedResource(renderable.geometry)) {
      geos.add(renderable.geometry);
    }
    const matList = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material];
    for (const mat of matList) {
      if (!mat || isSharedResource(mat)) continue;
      mats.add(mat);
      for (const tex of getMaterialTextures(mat)) {
        if (!isSharedResource(tex)) {
          texs.add(tex);
        }
      }
    }
  });

  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
  for (const m of mats) m.dispose();
}

function isCacheableAssetUrl(url: string): boolean {
  if (!url) return false;
  if (/^(blob:|data:)/i.test(url)) return false;
  if (url.includes('?')) return false;
  return true;
}

export function isUsdAssetUrl(url: string, fileNameHint?: string): boolean {
  const cleanPath = (fileNameHint ?? url).split(/[?#]/)[0].toLowerCase();
  return /\.(usdz|usd|usda|usdc)$/.test(cleanPath);
}

interface SpecGlossExtensionDef {
  diffuseFactor?: number[];
  diffuseTexture?: { index: number; texCoord?: number; extensions?: Record<string, unknown> };
  specularFactor?: number[];
  glossinessFactor?: number;
  specularGlossinessTexture?: { index: number; texCoord?: number; extensions?: Record<string, unknown> };
}

/**
 * Legacy glTF 2.0 `KHR_materials_pbrSpecularGlossiness` converter plugin for Three.js r160+ GLTFLoader.
 * Converts Sketchfab & older glTF Specular-Glossiness materials into PBR MeshStandardMaterial
 * so diffuse textures, colors, and glossiness load properly instead of rendering plain white.
 */
function createSpecGlossPlugin(parser: GLTFParser) {
  const EXT_NAME = 'KHR_materials_pbrSpecularGlossiness';

  return {
    name: EXT_NAME,
    getMaterialType(materialIndex: number): typeof THREE.MeshStandardMaterial | null {
      const materialDef = parser.json.materials?.[materialIndex];
      if (!materialDef?.extensions?.[EXT_NAME]) return null;
      return THREE.MeshStandardMaterial;
    },
    extendMaterialParams(
      materialIndex: number,
      materialParams: Record<string, unknown>
    ): Promise<void> | null {
      const materialDef = parser.json.materials?.[materialIndex];
      const ext = materialDef?.extensions?.[EXT_NAME] as SpecGlossExtensionDef | undefined;
      if (!ext) return null;

      const pending: Array<Promise<unknown>> = [];

      const color = new THREE.Color(1, 1, 1);
      let opacity = 1.0;
      if (Array.isArray(ext.diffuseFactor)) {
        const df = ext.diffuseFactor;
        color.setRGB(df[0] ?? 1, df[1] ?? 1, df[2] ?? 1, THREE.LinearSRGBColorSpace);
        if (typeof df[3] === 'number') {
          opacity = df[3];
        }
      }
      materialParams.color = color;
      materialParams.opacity = opacity;

      const glossiness = typeof ext.glossinessFactor === 'number' ? ext.glossinessFactor : 0.45;
      // Convert glossiness (1 = mirror, 0 = matte) to PBR roughness with realistic sunlit bounds
      materialParams.roughness = THREE.MathUtils.clamp(1.0 - glossiness * 0.85, 0.34, 0.94);

      let maxSpec = 0.05;
      if (Array.isArray(ext.specularFactor)) {
        maxSpec = Math.max(ext.specularFactor[0] ?? 0, ext.specularFactor[1] ?? 0, ext.specularFactor[2] ?? 0);
      }
      // Dielectric wood/cloth stalls stay non-metallic; only strongly tinted bright speculars get subtle metalness
      materialParams.metalness = maxSpec > 0.55 ? 0.18 : 0.03;

      if (ext.diffuseTexture !== undefined) {
        pending.push(
          parser.assignTexture(materialParams, 'map', ext.diffuseTexture, THREE.SRGBColorSpace)
        );
      }

      return Promise.all(pending).then(() => undefined);
    },
  };
}

/**
 * Normalizes materials across loaded GLB & USDZ models:
 * - Fixes over-aggressive `alphaMode: BLEND` on opaque wood/fabric/feather textures (uses crisp alphaTest cutout instead)
 * - Hides broken zero-alpha white emissive overlay meshes (common on vehicle glass/decal shells)
 * - Ensures SRGBColorSpace & anisotropic filtering on albedo/emissive maps
 * - Clamps accidental mirror-white roughness=0 / metalness=1 on diffuse-textured surfaces
 */
export function normalizeLoadedModelMaterials(root: THREE.Object3D, maxAnisotropy = 4): void {
  const aniso = Math.min(4, Math.max(1, maxAnisotropy));

  root.traverse((obj) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of mats) {
      if (!mat) continue;
      const matName = (mat.name || '').toLowerCase();
      const meshName = (mesh.name || '').toLowerCase();

      if (mat instanceof THREE.MeshStandardMaterial) {
        if (mat.map) {
          mat.map.colorSpace = THREE.SRGBColorSpace;
          mat.map.anisotropy = aniso;
          mat.map.needsUpdate = true;
        }
        if (mat.emissiveMap) {
          mat.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          mat.emissiveMap.anisotropy = aniso;
          mat.emissiveMap.needsUpdate = true;
        }
        if (mat.normalMap) {
          mat.normalMap.colorSpace = THREE.NoColorSpace;
          mat.normalMap.anisotropy = aniso;
        }
        if (mat.roughnessMap) {
          mat.roughnessMap.colorSpace = THREE.NoColorSpace;
          mat.roughnessMap.anisotropy = aniso;
        }
        if (mat.aoMap) {
          mat.aoMap.colorSpace = THREE.NoColorSpace;
          mat.aoMap.anisotropy = aniso;
        }

        const isGlassOrPlastic = /glass|window|windshield|lens|lamp_glass|plastic_cover/.test(matName);
        const isShadowPlane = /shadow/.test(matName) || /shadow/.test(meshName);
        const isWater = /water|pond|lake|puddle/.test(matName);
        const isBlendOverlay = /texblendmaterial|decal|stripe_overlay/.test(matName);

        // Fix zero-opacity / white-emissive glTF blend layers (e.g. Hiace glass_with_squares, Prelude TexBlendMaterial)
        if (mat.transparent && mat.opacity <= 0.08) {
          if (isGlassOrPlastic) {
            mat.color.set('#182430');
            mat.emissive.set('#000000');
            mat.emissiveIntensity = 0;
            mat.opacity = 0.44;
            mat.roughness = 0.14;
            mat.metalness = 0.15;
            mat.depthWrite = false;
            mat.needsUpdate = true;
          } else if (isBlendOverlay) {
            mesh.visible = false;
          } else {
            mat.emissive.set('#000000');
            mat.emissiveIntensity = 0;
            mat.opacity = 0.32;
            mat.needsUpdate = true;
          }
          continue;
        }

        if (isGlassOrPlastic) {
          mat.emissive.set('#000000');
          mat.emissiveIntensity = 0;
          if (mat.opacity > 0.78) {
            mat.transparent = true;
            mat.opacity = 0.46;
            mat.depthWrite = false;
          }
          mat.roughness = Math.min(mat.roughness, 0.18);
          mat.needsUpdate = true;
          continue;
        }

        if (isShadowPlane || isWater) {
          mat.depthWrite = false;
          mat.needsUpdate = true;
          continue;
        }

        // Convert Sketchfab/USDZ `alphaMode: BLEND` on solid textures/foliage/feathers into crisp opaque cutout
        const isCutoutCandidate =
          Boolean(mat.map) &&
          mat.transparent &&
          mat.opacity > 0.7;

        const isFoliageOrThatch =
          /foliage|leaf|leaves|cluster|thatch|fern|grass|bush|plant|tree|feather|cutoff/.test(matName) ||
          /foliage|leaf|leaves|cluster|thatch|fern|grass|bush|plant|tree/.test(meshName);

        if (isCutoutCandidate || isFoliageOrThatch) {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.depthWrite = true;
          mat.alphaTest = isFoliageOrThatch ? 0.35 : 0.25;
          mat.side = isFoliageOrThatch ? THREE.DoubleSide : mat.side;
          mat.needsUpdate = true;
        }

        // Prevent washed-out pure-white specular glare on textured matte surfaces
        if (mat.map && !/chrome|metal|steel|aluminum|mirror|rim|hubcap/.test(matName)) {
          if (mat.roughness < 0.28) mat.roughness = 0.42;
          if (mat.metalness > 0.85 && mat.roughness < 0.4) mat.metalness = 0.12;
          mat.envMapIntensity = Math.min(mat.envMapIntensity ?? 1, 0.78);
        }
      } else if (mat instanceof THREE.MeshBasicMaterial && mat.map) {
        mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.map.anisotropy = aniso;
        mat.map.needsUpdate = true;
      }
    }
  });
}

async function loadRawModelFromUrl(
  url: string,
  fileNameHint?: string,
  maxAnisotropy = 4
): Promise<Loaded3DModel> {
  if (isUsdAssetUrl(url, fileNameHint)) {
    const loader = new USDLoader();
    const group = await loader.loadAsync(url);
    normalizeLoadedModelMaterials(group, maxAnisotropy);
    return {
      scene: group,
      animations: group.animations ?? [],
    };
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => createSpecGlossPlugin(parser));
  const gltf = await loader.loadAsync(url);
  normalizeLoadedModelMaterials(gltf.scene, maxAnisotropy);
  return {
    scene: gltf.scene,
    animations: gltf.animations ?? [],
  };
}

export async function load3DModelFromUrl(
  url: string,
  fileNameHint?: string,
  maxAnisotropy = 4
): Promise<Loaded3DModel> {
  pendingModelLoads += 1;
  try {
    if (!isCacheableAssetUrl(url)) {
      const t0 = performance.now();
      const loaded = await loadRawModelFromUrl(url, fileNameHint, maxAnisotropy);
      const label = fileNameHint ? `${url.slice(0, 24)}:${fileNameHint}` : url;
      assetLoadMetrics.set(label, {
        url: label,
        loadDecodeMs: Math.round(performance.now() - t0),
        cached: false,
        hits: 1,
      });
      return loaded;
    }

    let templatePromise = cachedModelTemplates.get(url);
    const wasCached = Boolean(templatePromise);

    if (!templatePromise) {
      const t0 = performance.now();
      templatePromise = loadRawModelFromUrl(url, fileNameHint, maxAnisotropy)
        .then((loaded) => {
          markTemplateSharedResources(loaded.scene);
          const existing = assetLoadMetrics.get(url);
          assetLoadMetrics.set(url, {
            url,
            loadDecodeMs: Math.round(performance.now() - t0),
            cached: false,
            hits: existing ? existing.hits : 1,
          });
          return loaded;
        })
        .catch((err) => {
          cachedModelTemplates.delete(url);
          throw err;
        });
      cachedModelTemplates.set(url, templatePromise);
    } else {
      const existing = assetLoadMetrics.get(url);
      if (existing) {
        existing.hits += 1;
        existing.cached = true;
      }
    }

    const template = await templatePromise;
    if (wasCached) {
      const existing = assetLoadMetrics.get(url);
      if (existing) existing.cached = true;
    }
    return {
      scene: cloneSceneWithInstanceMaterials(template.scene),
      animations: template.animations,
    };
  } finally {
    pendingModelLoads = Math.max(0, pendingModelLoads - 1);
  }
}
