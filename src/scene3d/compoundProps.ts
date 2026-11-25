import * as THREE from 'three';
import { disposeLoadedModel, isSharedResource, load3DModelFromUrl } from './modelLoader';
import { groundHeightAt } from './terrain';

export interface CompoundPropsRig {
  group: THREE.Group;
  setShadowsEnabled: (enabled: boolean) => void;
  dispose: () => void;
}

export function buildCompoundProps(options: {
  isSoftwareGl: boolean;
  shadowsEnabled: () => boolean;
  maxAnisotropy: number;
}): CompoundPropsRig {
  const group = new THREE.Group();
  group.name = 'UgandanCompoundProps';

  let disposed = false;
  const loadedGeos = new Set<THREE.BufferGeometry>();
  const loadedMats = new Set<THREE.Material>();
  const loadedTexs = new Set<THREE.Texture>();
  const aniso = Math.min(16, Math.max(1, options.maxAnisotropy));

  void (async () => {
    try {
      const gltf = await load3DModelFromUrl('/assets/worlds/kampala_compound/bicycle.glb');
      const root = gltf.scene;
      if (disposed) {
        disposeLoadedModel(root);
        return;
      }

      root.updateMatrixWorld(true);
      const rawBox = new THREE.Box3().setFromObject(root);
      const rawSize = rawBox.getSize(new THREE.Vector3());
      const targetHeight = 1.04;
      const scale = targetHeight / Math.max(0.01, rawSize.y);
      root.scale.multiplyScalar(scale);
      root.updateMatrixWorld(true);

      const scaledBox = new THREE.Box3().setFromObject(root);
      const center = scaledBox.getCenter(new THREE.Vector3());
      root.position.set(-center.x, -scaledBox.min.y, -center.z);

      const shadowsActive = !options.isSoftwareGl && options.shadowsEnabled();
      root.traverse((obj) => {
        if (!(obj as THREE.Mesh).isMesh) return;
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = shadowsActive;
        mesh.receiveShadow = shadowsActive;
        if (mesh.geometry) loadedGeos.add(mesh.geometry);
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          loadedMats.add(mat);
          if (mat instanceof THREE.MeshStandardMaterial) {
            if (mat.map) {
              mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.map.anisotropy = aniso;
              mat.map.needsUpdate = true;
              loadedTexs.add(mat.map);
            }
            if (mat.normalMap) {
              mat.normalMap.anisotropy = aniso;
              loadedTexs.add(mat.normalMap);
            }
          }
        }
      });

      // Lean naturally against the right brick perimeter wall beside the slatted gate
      const leanPivot = new THREE.Group();
      leanPivot.add(root);
      leanPivot.rotation.x = 0.14; // +Z in local frame leans into +X brick wall

      const bikeWrapper = new THREE.Group();
      bikeWrapper.name = 'CompoundBicycle';
      const bx = 7.26;
      const bz = 1.48;
      bikeWrapper.position.set(bx, groundHeightAt(bx, bz) - 0.01, bz);
      bikeWrapper.rotation.y = Math.PI * 0.5 - 0.08;
      bikeWrapper.add(leanPivot);

      group.add(bikeWrapper);
    } catch (err) {
      console.warn('Compound bicycle prop could not load:', err);
    }
  })();

  const setShadowsEnabled = (enabled: boolean) => {
    const active = !options.isSoftwareGl && enabled;
    group.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = active;
        obj.receiveShadow = active;
      }
    });
  };

  const dispose = () => {
    disposed = true;
    for (const g of loadedGeos) {
      if (!isSharedResource(g)) g.dispose();
    }
    for (const t of loadedTexs) {
      if (!isSharedResource(t)) t.dispose();
    }
    for (const m of loadedMats) {
      if (!isSharedResource(m)) m.dispose();
    }
    loadedGeos.clear();
    loadedTexs.clear();
    loadedMats.clear();
  };

  return { group, setShadowsEnabled, dispose };
}
