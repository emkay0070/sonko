import * as THREE from 'three';

export interface AutoRiggedHumanoidResult {
  hips: THREE.Bone;
  skeleton: THREE.Skeleton;
  skinnedMeshes: THREE.SkinnedMesh[];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Procedurally rigs an unrigged A-pose humanoid GLB scene into a 19-bone SkinnedMesh hierarchy
 * while preserving all existing PBR materials, UVs, and facial morph targets.
 */
export function autoRigHumanoidIfNeeded(model: THREE.Object3D): AutoRiggedHumanoidResult | null {
  let alreadyHasBones = false;
  const candidateMeshes: THREE.Mesh[] = [];

  model.traverse((obj) => {
    if ((obj as THREE.Bone).isBone || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
      alreadyHasBones = true;
    } else if ((obj as THREE.Mesh).isMesh) {
      candidateMeshes.push(obj as THREE.Mesh);
    }
  });

  if (alreadyHasBones || candidateMeshes.length === 0) {
    return null;
  }

  // Measure mesh-local bounding box across all primitives
  const localBox = new THREE.Box3();
  const v = new THREE.Vector3();
  for (const mesh of candidateMeshes) {
    const pos = mesh.geometry.getAttribute('position');
    if (!pos) continue;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      localBox.expandByPoint(v);
    }
  }

  const minY = localBox.min.y;
  const H = Math.max(0.01, localBox.max.y - minY);
  const centerX = (localBox.min.x + localBox.max.x) * 0.5;
  const centerZ = (localBox.min.z + localBox.max.z) * 0.5;

  // Anatomical joint coordinates in mesh-local space (spine/pelvis axis sits near z=0)
  const pt = (nx: number, ny: number, nz: number) =>
    new THREE.Vector3(centerX + nx * H, minY + ny * H, nz * H);

  // Build 19-bone humanoid hierarchy (names match extractSkeletonBones in glbCharacterController.ts)
  const boneList: THREE.Bone[] = [];
  const makeBone = (name: string, parent: THREE.Bone | null, worldPos: THREE.Vector3) => {
    const b = new THREE.Bone();
    b.name = name;
    if (parent) {
      const parentWorld = new THREE.Vector3();
      parent.updateMatrixWorld(true);
      parent.getWorldPosition(parentWorld);
      b.position.copy(worldPos).sub(parentWorld);
      parent.add(b);
    } else {
      b.position.copy(worldPos);
    }
    boneList.push(b);
    return b;
  };

  // Root / Spine / Head
  const hipsPos = pt(0, 0.485, 0.015);
  const hips = makeBone('Hips', null, hipsPos); // 0
  const spine = makeBone('Spine', hips, pt(0, 0.555, 0.02)); // 1
  const chest = makeBone('Chest', spine, pt(0, 0.675, 0.025)); // 2
  const neck = makeBone('Neck', chest, pt(0, 0.79, 0.032)); // 3
  const head = makeBone('Head', neck, pt(0, 0.85, 0.048)); // 4

  // Left Arm (+X side)
  const shoulderLPos = pt(0.09, 0.735, 0.015);
  const upperArmLPos = pt(0.138, 0.722, 0.016);
  const foreArmLPos = pt(0.214, 0.638, 0.035);
  const handLPos = pt(0.278, 0.558, 0.125);

  const shoulderL = makeBone('LeftShoulder', chest, shoulderLPos); // 5
  const upperArmL = makeBone('LeftUpperArm', shoulderL, upperArmLPos); // 6
  const foreArmL = makeBone('LeftForeArm', upperArmL, foreArmLPos); // 7
  const handL = makeBone('LeftHand', foreArmL, handLPos); // 8

  // Right Arm (-X side)
  const shoulderRPos = pt(-0.09, 0.735, 0.015);
  const upperArmRPos = pt(-0.138, 0.722, 0.016);
  const foreArmRPos = pt(-0.214, 0.638, 0.035);
  const handRPos = pt(-0.278, 0.558, 0.125);

  const shoulderR = makeBone('RightShoulder', chest, shoulderRPos); // 9
  const upperArmR = makeBone('RightUpperArm', shoulderR, upperArmRPos); // 10
  const foreArmR = makeBone('RightForeArm', upperArmR, foreArmRPos); // 11
  const handR = makeBone('RightHand', foreArmR, handRPos); // 12

  // Left Leg (+X side)
  const thighL = makeBone('LeftUpLeg', hips, pt(0.078, 0.45, 0.034)); // 13
  const shinL = makeBone('LeftLeg', thighL, pt(0.098, 0.255, 0.025)); // 14
  const footL = makeBone('LeftFoot', shinL, pt(0.112, 0.055, 0.02)); // 15

  // Right Leg (-X side)
  const thighR = makeBone('RightUpLeg', hips, pt(-0.078, 0.45, 0.034)); // 16
  const shinR = makeBone('RightLeg', thighR, pt(-0.098, 0.255, 0.025)); // 17
  const footR = makeBone('RightFoot', shinR, pt(-0.112, 0.055, 0.02)); // 18

  const BONE_IDX = {
    hips: 0,
    spine: 1,
    chest: 2,
    neck: 3,
    head: 4,
    shoulderL: 5,
    upperArmL: 6,
    foreArmL: 7,
    handL: 8,
    shoulderR: 9,
    upperArmR: 10,
    foreArmR: 11,
    handR: 12,
    thighL: 13,
    shinL: 14,
    footL: 15,
    thighR: 16,
    shinR: 17,
    footR: 18,
  } as const;

  // Precompute arm axis projections in normalized (nx, ny) space
  const armStartNX = 0.138;
  const armStartNY = 0.722;
  const armEndNX = 0.278;
  const armEndNY = 0.558;
  const armDX = armEndNX - armStartNX;
  const armDY = armEndNY - armStartNY;
  const armLenSq = armDX * armDX + armDY * armDY;

  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  const skeletonParent = candidateMeshes[0].parent ?? model;
  skeletonParent.add(hips);
  model.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(boneList);
  skeleton.calculateInverses();

  for (const mesh of candidateMeshes) {
    const geom = mesh.geometry;
    const pos = geom.getAttribute('position');
    if (!pos) continue;

    const count = pos.count;
    const skinIndices = new Uint16Array(count * 4);
    const skinWeights = new Float32Array(count * 4);

    for (let i = 0; i < count; i++) {
      const vx = pos.getX(i);
      const vy = pos.getY(i);

      const nx = (vx - centerX) / H;
      const ny = (vy - minY) / H;
      const ax = Math.abs(nx);
      const isLeft = nx >= 0;

      // Collect up to 4 bone influences then normalize
      const pairs: Array<[number, number]> = [];
      const addWeight = (idx: number, w: number) => {
        if (w <= 0.0005) return;
        const existing = pairs.find((p) => p[0] === idx);
        if (existing) {
          existing[1] += w;
        } else {
          pairs.push([idx, w]);
        }
      };

      // 1. Head & Face (rigid skull lock above 0.84 so eyes/teeth/morphs never shear)
      if (ny >= 0.84) {
        addWeight(BONE_IDX.head, 1.0);
      } else if (ny >= 0.785) {
        const wHead = smoothstep(0.79, 0.84, ny);
        const wNeck = smoothstep(0.785, 0.81, ny) * (1 - wHead * 0.7);
        const wChest = Math.max(0, 1 - wHead - wNeck);
        addWeight(BONE_IDX.head, wHead);
        addWeight(BONE_IDX.neck, wNeck);
        addWeight(BONE_IDX.chest, wChest);
      } else if (ny < 0.475) {
        // 2. Legs & Pelvis boundary
        const legThigh = isLeft ? BONE_IDX.thighL : BONE_IDX.thighR;
        const legShin = isLeft ? BONE_IDX.shinL : BONE_IDX.shinR;
        const legFoot = isLeft ? BONE_IDX.footL : BONE_IDX.footR;
        const otherThigh = isLeft ? BONE_IDX.thighR : BONE_IDX.thighL;

        // Crotch / Pelvis transition (0.425..0.475)
        const wHips = smoothstep(0.43, 0.475, ny);
        const legWeight = 1 - wHips;
        addWeight(BONE_IDX.hips, wHips);

        if (legWeight > 0.001) {
          // Subtle inner-crotch cross-thigh blend only for centermost vertices
          const crossBlend = ny > 0.40 && ax < 0.025 ? (0.025 - ax) / 0.05 : 0;

          if (ny < 0.045) {
            addWeight(legFoot, legWeight);
          } else if (ny < 0.085) {
            const wShin = smoothstep(0.045, 0.085, ny);
            addWeight(legFoot, legWeight * (1 - wShin));
            addWeight(legShin, legWeight * wShin);
          } else if (ny < 0.225) {
            addWeight(legShin, legWeight);
          } else if (ny < 0.285) {
            const wThigh = smoothstep(0.225, 0.285, ny);
            addWeight(legShin, legWeight * (1 - wThigh));
            addWeight(legThigh, legWeight * wThigh);
          } else {
            addWeight(legThigh, legWeight * (1 - crossBlend));
            addWeight(otherThigh, legWeight * crossBlend);
          }
        }
      } else {
        // 3. Mid-body (0.475..0.785): Separate A-pose Arms from Torso cleanly
        const torsoHalfW = 0.142 - 0.042 * smoothstep(0.5, 0.72, ny);
        const armBlend =
          ny <= 0.71
            ? smoothstep(torsoHalfW, torsoHalfW + 0.032, ax)
            : smoothstep(0.088, 0.15, ax) * (1 - smoothstep(0.755, 0.785, ny));

        if (armBlend > 0.001) {
          const bShoulder = isLeft ? BONE_IDX.shoulderL : BONE_IDX.shoulderR;
          const bUpper = isLeft ? BONE_IDX.upperArmL : BONE_IDX.upperArmR;
          const bFore = isLeft ? BONE_IDX.foreArmL : BONE_IDX.foreArmR;
          const bHand = isLeft ? BONE_IDX.handL : BONE_IDX.handR;

          const tArm =
            ((ax - armStartNX) * armDX + (ny - armStartNY) * armDY) / Math.max(1e-5, armLenSq);

          if (tArm < 0.06) {
            const wUpper = smoothstep(-0.18, 0.06, tArm);
            addWeight(bShoulder, armBlend * (1 - wUpper));
            addWeight(bUpper, armBlend * wUpper);
          } else if (tArm < 0.41) {
            addWeight(bUpper, armBlend);
          } else if (tArm < 0.56) {
            const wFore = smoothstep(0.41, 0.56, tArm);
            addWeight(bUpper, armBlend * (1 - wFore));
            addWeight(bFore, armBlend * wFore);
          } else if (tArm < 0.78) {
            addWeight(bFore, armBlend);
          } else if (tArm < 0.92) {
            const wHand = smoothstep(0.78, 0.92, tArm);
            addWeight(bFore, armBlend * (1 - wHand));
            addWeight(bHand, armBlend * wHand);
          } else {
            addWeight(bHand, armBlend);
          }
        }

        const torsoWeight = 1 - armBlend;
        if (torsoWeight > 0.001) {
          if (ny < 0.54) {
            const wSpine = smoothstep(0.475, 0.54, ny);
            addWeight(BONE_IDX.hips, torsoWeight * (1 - wSpine));
            addWeight(BONE_IDX.spine, torsoWeight * wSpine);
          } else if (ny < 0.65) {
            const wChest = smoothstep(0.55, 0.65, ny);
            addWeight(BONE_IDX.spine, torsoWeight * (1 - wChest));
            addWeight(BONE_IDX.chest, torsoWeight * wChest);
          } else {
            addWeight(BONE_IDX.chest, torsoWeight);
          }
        }
      }

      if (pairs.length === 0) {
        pairs.push([BONE_IDX.hips, 1]);
      }

      // Sort descending and keep top 4 normalized
      pairs.sort((a, b) => b[1] - a[1]);
      const top = pairs.slice(0, 4);
      let total = 0;
      for (const p of top) total += p[1];
      const inv = total > 1e-6 ? 1 / total : 1;

      for (let k = 0; k < 4; k++) {
        skinIndices[i * 4 + k] = top[k]?.[0] ?? 0;
        skinWeights[i * 4 + k] = (top[k]?.[1] ?? 0) * inv;
      }
    }

    geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const skinned = new THREE.SkinnedMesh(geom, mesh.material);
    skinned.name = mesh.name;
    skinned.position.copy(mesh.position);
    skinned.rotation.copy(mesh.rotation);
    skinned.scale.copy(mesh.scale);
    skinned.castShadow = mesh.castShadow;
    skinned.receiveShadow = mesh.receiveShadow;
    skinned.frustumCulled = false;

    // Preserve morph target bindings (34 facial expressions + visemes!)
    if (mesh.morphTargetDictionary) {
      skinned.morphTargetDictionary = { ...mesh.morphTargetDictionary };
    }
    if (mesh.morphTargetInfluences) {
      skinned.morphTargetInfluences = [...mesh.morphTargetInfluences];
    }

    const parent = mesh.parent;
    if (parent) {
      const idx = parent.children.indexOf(mesh);
      parent.remove(mesh);
      parent.add(skinned);
      if (idx >= 0 && idx < parent.children.length - 1) {
        parent.children.splice(parent.children.length - 1, 1);
        parent.children.splice(idx, 0, skinned);
      }
    }

    skinned.updateMatrixWorld(true);
    skinned.bind(skeleton, skinned.matrixWorld);
    skinnedMeshes.push(skinned);
  }

  return {
    hips,
    skeleton,
    skinnedMeshes,
  };
}
