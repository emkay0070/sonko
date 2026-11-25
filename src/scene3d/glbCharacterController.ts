import * as THREE from 'three';
import { disposeLoadedModel, load3DModelFromUrl } from './modelLoader';
import { StoneCatalogItem } from '../game/progression';
import { SpeechState } from '../game/types';
import { CHARACTER_SLOTS, ChildStyle } from './characters';
import {
  AnimatedGLBMorphState,
  applyGLBCharacterAppearance,
  CharacterAppearance,
  CharacterEmotion,
  createGLBMorphState,
  CustomGLBColors,
  updateGLBMorphAndBreath,
} from './glbAppearance';
import { autoRigHumanoidIfNeeded } from './humanoidAutoRig';
import { CompoundTextureLibrary } from './pbrTextures';
import { createProceduralChildCharacter } from './proceduralCharacter';
import { groundHeightAt } from './terrain';
import { readBuiltInAppearances } from '../game/modelPersistence';

export type ModelSlotId = ChildStyle | 'prop' | 'stone' | 'surface';

export type CharacterViewportPose = 'idle' | 'hopping' | 'balancing' | 'landing' | 'victory';

export type CharacterActionMode =
  | 'IDLE_AIM'
  | 'THROW_FOLLOW'
  | 'HOP_LEFT_FOOT'
  | 'HOP_RIGHT_FOOT'
  | 'HOP_TWO_FEET'
  | 'STAND_TWO_FEET'
  | 'BEND_PICKUP'
  | 'SIDELINE_IDLE'
  | 'SIDELINE_CHEER'
  | 'VICTORY_DANCE'
  | 'WALK_STRIDE'
  | 'EMOTE_LAUGH'
  | 'EMOTE_ANNOYED';

export interface CharacterPoseCommand {
  worldX: number;
  worldZ: number;
  zLift: number;
  facingYaw: number;
  mode: CharacterActionMode;
  emotion: CharacterEmotion;
  speechIntensity: number;
  speechState?: SpeechState;
  hopProgress: number;
  aimPower: number;
  aimAngleOffset: number;
  balanceSway: number;
  actionTimer: number;
  stoneInHand: boolean;
  isClaimPose: boolean;
  activeColor?: string;
}

interface MappedBones {
  hips?: THREE.Bone;
  spine?: THREE.Bone;
  chest?: THREE.Bone;
  neck?: THREE.Bone;
  head?: THREE.Bone;
  shoulderL?: THREE.Bone;
  upperArmL?: THREE.Bone;
  foreArmL?: THREE.Bone;
  handL?: THREE.Bone;
  shoulderR?: THREE.Bone;
  upperArmR?: THREE.Bone;
  foreArmR?: THREE.Bone;
  handR?: THREE.Bone;
  thighL?: THREE.Bone;
  shinL?: THREE.Bone;
  footL?: THREE.Bone;
  thighR?: THREE.Bone;
  shinR?: THREE.Bone;
  footR?: THREE.Bone;
}

interface LoadedGLBSlot {
  slot: ModelSlotId;
  wrapper: THREE.Group;
  model: THREE.Object3D;
  bones: MappedBones;
  bindQuats: Map<THREE.Bone, THREE.Quaternion>;
  hipsRestY: number;
  mixer?: THREE.AnimationMixer;
  morphState?: AnimatedGLBMorphState;
  handStoneSocket: THREE.Group;
  handStoneMesh: THREE.Mesh;
  appearance: CharacterAppearance;
  customColors?: CustomGLBColors;
  baseRotY: number;
  modelHeight: number;
  walkBlend: number;
  isBuiltIn?: boolean;
}

// Module-scope scratch math objects (zero GC per frame)
const _deltaEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const _deltaQuat = new THREE.Quaternion();
const _targetQuat = new THREE.Quaternion();

function matchBoneName(name: string, patterns: RegExp[]): boolean {
  const clean = name.replace(/mixamorig[:_]?/i, '');
  return patterns.some((re) => re.test(clean));
}

function extractSkeletonBones(root: THREE.Object3D): {
  bones: MappedBones;
  bindQuats: Map<THREE.Bone, THREE.Quaternion>;
  hipsRestY: number;
} {
  const allBones: THREE.Bone[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) {
      allBones.push(obj as THREE.Bone);
    }
  });

  const find = (patterns: RegExp[], exclude?: RegExp) =>
    allBones.find((b) => matchBoneName(b.name, patterns) && (!exclude || !exclude.test(b.name)));

  const leftRe = /(^|[._-])(l|left)([._-]|$)|left/i;
  const rightRe = /(^|[._-])(r|right)([._-]|$)|right/i;

  const bones: MappedBones = {
    hips: find([/^hips?$/i, /^pelvis$/i, /^root$/i]),
    spine: find([/^spine$/i, /^spine[_.]?0?1$/i]),
    chest: find([/^upper[_.]?chest$/i, /^chest$/i, /^spine[_.]?0?2$/i]),
    neck: find([/^neck/i]),
    head: find([/^head$/i, /^head[_.]?top/i]),
    shoulderL: allBones.find((b) => leftRe.test(b.name) && /clavicle|shoulder/i.test(b.name)),
    upperArmL: allBones.find((b) => leftRe.test(b.name) && /upper[_.]?arm|^arm[._-]|arm$/i.test(b.name) && !/fore|lower/i.test(b.name)),
    foreArmL: allBones.find((b) => leftRe.test(b.name) && /fore[_.]?arm|lower[_.]?arm|elbow/i.test(b.name)),
    handL: allBones.find((b) => leftRe.test(b.name) && /hand|wrist/i.test(b.name) && !/thumb|index|middle|ring|pinky/i.test(b.name)),
    shoulderR: allBones.find((b) => rightRe.test(b.name) && /clavicle|shoulder/i.test(b.name)),
    upperArmR: allBones.find((b) => rightRe.test(b.name) && /upper[_.]?arm|^arm[._-]|arm$/i.test(b.name) && !/fore|lower/i.test(b.name)),
    foreArmR: allBones.find((b) => rightRe.test(b.name) && /fore[_.]?arm|lower[_.]?arm|elbow/i.test(b.name)),
    handR: allBones.find((b) => rightRe.test(b.name) && /hand|wrist/i.test(b.name) && !/thumb|index|middle|ring|pinky/i.test(b.name)),
    thighL: allBones.find((b) => leftRe.test(b.name) && /up[_.]?leg|thigh|hip/i.test(b.name)),
    shinL: allBones.find((b) => leftRe.test(b.name) && /leg|shin|calf|knee/i.test(b.name) && !/up[_.]?leg|thigh/i.test(b.name)),
    footL: allBones.find((b) => leftRe.test(b.name) && /foot|ankle/i.test(b.name)),
    thighR: allBones.find((b) => rightRe.test(b.name) && /up[_.]?leg|thigh|hip/i.test(b.name)),
    shinR: allBones.find((b) => rightRe.test(b.name) && /leg|shin|calf|knee/i.test(b.name) && !/up[_.]?leg|thigh/i.test(b.name)),
    footR: allBones.find((b) => rightRe.test(b.name) && /foot|ankle/i.test(b.name)),
  };

  const bindQuats = new Map<THREE.Bone, THREE.Quaternion>();
  for (const b of Object.values(bones)) {
    if (b) bindQuats.set(b, b.quaternion.clone());
  }

  return {
    bones,
    bindQuats,
    hipsRestY: bones.hips ? bones.hips.position.y : 0,
  };
}

function applyBoneOffset(
  bone: THREE.Bone | undefined,
  bindQuats: Map<THREE.Bone, THREE.Quaternion>,
  rx: number,
  ry: number,
  rz: number,
  dt = 0.016,
  lambda = 16
) {
  if (!bone) return;
  const bind = bindQuats.get(bone);
  if (!bind) return;
  _deltaEuler.set(rx, ry, rz, 'XYZ');
  _deltaQuat.setFromEuler(_deltaEuler);
  _targetQuat.copy(bind).multiply(_deltaQuat);
  const alpha = 1 - Math.exp(-lambda * Math.max(0.001, dt));
  bone.quaternion.slerp(_targetQuat, alpha);
}

export class GLBCharacterController {
  public readonly group = new THREE.Group();
  private slots = new Map<ModelSlotId, LoadedGLBSlot>();
  private floorMarkers = new Map<ChildStyle, THREE.Group>();
  private customHandStoneTemplate: THREE.Object3D | null = null;
  private previewPose: CharacterViewportPose = 'idle';
  private previewSpeechState: SpeechState = 'silent';
  private disposed = false;

  constructor(
    private textures: CompoundTextureLibrary,
    private isSoftwareGl: boolean
  ) {
    this.group.name = 'SonkoGLBCharacters';
    this.initSlotFloorMarkers();
    const savedBuiltInApps = readBuiltInAppearances();
    for (const spec of CHARACTER_SLOTS) {
      this.installBuiltInSlot(spec.id, savedBuiltInApps[spec.id]);
    }
  }

  public setPose(pose: CharacterViewportPose) {
    this.previewPose = pose;
  }

  public getPose(): CharacterViewportPose {
    return this.previewPose;
  }

  public setSpeechState(state: SpeechState) {
    this.previewSpeechState = state;
  }

  public getSpeechState(): SpeechState {
    return this.previewSpeechState;
  }

  private applyHandStoneMeshToSlot(entry: LoadedGLBSlot) {
    // Clear any previous custom stone node inside socket
    const prevCustom = entry.handStoneSocket.getObjectByName('CustomHandStone');
    if (prevCustom) {
      entry.handStoneSocket.remove(prevCustom);
    }

    if (this.customHandStoneTemplate) {
      entry.handStoneMesh.visible = false;
      const clone = this.customHandStoneTemplate.clone(true);
      clone.name = 'CustomHandStone';
      clone.scale.multiplyScalar(0.62);
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = !this.isSoftwareGl;
          child.receiveShadow = true;
        }
      });
      entry.handStoneSocket.add(clone);
    } else {
      entry.handStoneMesh.visible = true;
    }
  }

  public setCustomHandStoneModel(normalizedStone: THREE.Object3D | null) {
    this.customHandStoneTemplate = normalizedStone ? normalizedStone.clone(true) : null;
    for (const entry of this.slots.values()) {
      this.applyHandStoneMeshToSlot(entry);
    }
  }

  private initSlotFloorMarkers() {
    for (const spec of CHARACTER_SLOTS) {
      const marker = new THREE.Group();
      marker.name = `FloorMarker_${spec.id}`;
      const ringGeo = new THREE.RingGeometry(0.18, 0.24, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: spec.id === 'kato' ? '#FBBF24' : '#FAF3E8',
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      marker.add(ring);

      const arrowGeo = new THREE.ConeGeometry(0.06, 0.14, 3);
      arrowGeo.rotateX(Math.PI / 2);
      const arrow = new THREE.Mesh(arrowGeo, ringMat);
      arrow.position.set(0, 0.02, 0.26);
      marker.add(arrow);

      const gy = groundHeightAt(spec.x, spec.z);
      marker.position.set(spec.x, gy + 0.015, spec.z);
      marker.rotation.y = Math.atan2(spec.lookTarget[0] - spec.x, spec.lookTarget[1] - spec.z);
      this.group.add(marker);
      this.floorMarkers.set(spec.id, marker);
    }
  }

  public hasLoadedSlot(slot: ModelSlotId): boolean {
    return this.slots.has(slot);
  }

  public isUsingBuiltIn(slot: ModelSlotId): boolean {
    return Boolean(this.slots.get(slot)?.isBuiltIn);
  }

  public installBuiltInSlot(
    slot: ChildStyle,
    appearance?: CharacterAppearance,
    customColors?: CustomGLBColors
  ) {
    const slotSpec = CHARACTER_SLOTS.find((s) => s.id === slot);
    if (!slotSpec) return;

    this.clearSlot(slot, false);

    const model = createProceduralChildCharacter(slot, this.isSoftwareGl);
    const wrapper = new THREE.Group();
    wrapper.name = `BuiltInActor_${slot}`;
    wrapper.add(model);

    const gy = groundHeightAt(slotSpec.x, slotSpec.z);
    const baseRotY = Math.atan2(slotSpec.lookTarget[0] - slotSpec.x, slotSpec.lookTarget[1] - slotSpec.z);
    wrapper.position.set(slotSpec.x, gy, slotSpec.z);
    wrapper.rotation.y = baseRotY;

    const marker = this.floorMarkers.get(slotSpec.id);
    if (marker) marker.visible = false;

    const shadowGeo = new THREE.CircleGeometry(slotSpec.height * 0.2, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#200f09',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const contact = new THREE.Mesh(shadowGeo, shadowMat);
    contact.position.y = 0.008;
    wrapper.add(contact);

    const resolvedAppearance: CharacterAppearance = appearance ?? {
      skinTone: 'original',
      outfitStyle: 'original',
      shoeStyle: 'original',
    };
    applyGLBCharacterAppearance(model, resolvedAppearance, this.textures, customColors);

    const { bones, bindQuats, hipsRestY } = extractSkeletonBones(model);

    const handStoneSocket = new THREE.Group();
    handStoneSocket.name = `StoneSocket_${slot}`;
    const handStoneMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.04, 0.016, 16),
      new THREE.MeshStandardMaterial({ color: '#8A817C', roughness: 0.58, metalness: 0.06 })
    );
    handStoneMesh.scale.set(1.18, 1, 0.94);
    handStoneMesh.castShadow = !this.isSoftwareGl;
    handStoneSocket.add(handStoneMesh);

    if (bones.handR) {
      bones.handR.add(handStoneSocket);
      handStoneSocket.position.set(0, -0.045, 0.04);
    } else {
      wrapper.add(handStoneSocket);
      handStoneSocket.position.set(-0.22, slotSpec.height * 0.48, 0.18);
    }
    handStoneSocket.visible = false;

    this.group.add(wrapper);
    const newEntry: LoadedGLBSlot = {
      slot,
      wrapper,
      model,
      bones,
      bindQuats,
      hipsRestY,
      handStoneSocket,
      handStoneMesh,
      appearance: resolvedAppearance,
      customColors,
      baseRotY,
      modelHeight: slotSpec.height,
      walkBlend: 0,
      isBuiltIn: true,
    };
    this.applyHandStoneMeshToSlot(newEntry);
    this.slots.set(slot, newEntry);
  }

  public getSlotWorldHeadPos(slot: ChildStyle, out: THREE.Vector3): boolean {
    const entry = this.slots.get(slot);
    if (!entry) return false;
    out.copy(entry.wrapper.position);
    out.y += entry.modelHeight + 0.14;
    return true;
  }

  public clearSlot(slot: ModelSlotId, restoreBuiltIn = true) {
    const existing = this.slots.get(slot);
    if (existing) {
      existing.mixer?.stopAllAction();
      this.group.remove(existing.wrapper);
      disposeLoadedModel(existing.wrapper);
      this.slots.delete(slot);
    }
    if (slot !== 'prop' && slot !== 'stone' && slot !== 'surface') {
      if (restoreBuiltIn && !this.disposed) {
        const savedBuiltInApps = readBuiltInAppearances();
        this.installBuiltInSlot(slot, savedBuiltInApps[slot]);
        return;
      }
      const marker = this.floorMarkers.get(slot);
      if (marker) marker.visible = true;
    }
  }

  public updateAppearance(
    slot: ModelSlotId,
    appearance: CharacterAppearance,
    customColors?: CustomGLBColors
  ) {
    const entry = this.slots.get(slot);
    if (!entry) return;
    entry.appearance = { ...appearance };
    entry.customColors = customColors ? { ...customColors } : undefined;
    applyGLBCharacterAppearance(entry.model, appearance, this.textures, customColors);
  }

  public updateHandStoneSpec(stoneSpec: StoneCatalogItem) {
    for (const entry of this.slots.values()) {
      const mat = entry.handStoneMesh.material as THREE.MeshStandardMaterial;
      mat.color.set(stoneSpec.midColor);
      mat.emissive.set(stoneSpec.motifColor).multiplyScalar(0.08);
    }
  }

  public async loadSlotFromUrl(
    slot: ModelSlotId,
    url: string,
    appearance?: CharacterAppearance,
    customColors?: CustomGLBColors,
    fileNameHint?: string
  ): Promise<{ animations: string[]; hasSkeleton: boolean }> {
    const gltf = await load3DModelFromUrl(url, fileNameHint);
    if (this.disposed) {
      disposeLoadedModel(gltf.scene);
      return { animations: [], hasSkeleton: false };
    }

    this.clearSlot(slot, false);

    const model = gltf.scene;
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = !this.isSoftwareGl;
        child.receiveShadow = true;
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
          child.frustumCulled = false;
        }
      }
    });

    const wrapper = new THREE.Group();
    wrapper.name = `BlenderActor_${slot}`;
    wrapper.add(model);

    const isDecorProp = slot === 'prop' || slot === 'stone' || slot === 'surface';
    const slotSpec = !isDecorProp ? CHARACTER_SLOTS.find((s) => s.id === slot) : undefined;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const rawH = Math.max(0.01, box.max.y - box.min.y);

    const targetH = slotSpec ? slotSpec.height : 1.0;
    let baseRotY = 0;

    if (slotSpec) {
      const scale = slotSpec.height / rawH;
      model.scale.multiplyScalar(scale);
      model.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(model);
      const centerX = (scaledBox.min.x + scaledBox.max.x) * 0.5;
      const centerZ = (scaledBox.min.z + scaledBox.max.z) * 0.5;
      model.position.set(-centerX, -scaledBox.min.y, -centerZ);

      // Procedurally rig unrigged humanoid GLBs while wrapper is at origin
      autoRigHumanoidIfNeeded(model);

      const gy = groundHeightAt(slotSpec.x, slotSpec.z);
      baseRotY = Math.atan2(slotSpec.lookTarget[0] - slotSpec.x, slotSpec.lookTarget[1] - slotSpec.z);
      wrapper.position.set(slotSpec.x, gy, slotSpec.z);
      wrapper.rotation.y = baseRotY;

      const marker = this.floorMarkers.get(slotSpec.id);
      if (marker) marker.visible = false;
    } else {
      const centerX = (box.min.x + box.max.x) * 0.5;
      const centerZ = (box.min.z + box.max.z) * 0.5;
      model.position.set(-centerX, -box.min.y, -centerZ);
      const gx = 2.45;
      const gz = 1.15;
      wrapper.position.set(gx, groundHeightAt(gx, gz), gz);
    }

    // Contact shadow grounding
    const shadowGeo = new THREE.CircleGeometry(targetH * 0.2, 24);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: '#200f09',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const contact = new THREE.Mesh(shadowGeo, shadowMat);
    contact.position.y = 0.008;
    wrapper.add(contact);

    const resolvedAppearance: CharacterAppearance = appearance ?? {
      skinTone: slot === 'ssemakula' ? 'chestnut' : 'original',
      outfitStyle: 'original',
      shoeStyle: 'original',
    };
    if (slotSpec) {
      applyGLBCharacterAppearance(model, resolvedAppearance, this.textures, customColors);
    }

    const { bones, bindQuats, hipsRestY } = extractSkeletonBones(model);
    const morphState = slotSpec ? createGLBMorphState(model, slotSpec.phase) : undefined;

    // Attach playable River Stone socket to Right Hand bone
    const handStoneSocket = new THREE.Group();
    handStoneSocket.name = `StoneSocket_${slot}`;
    const handStoneMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.04, 0.016, 16),
      new THREE.MeshStandardMaterial({ color: '#8A817C', roughness: 0.58, metalness: 0.06 })
    );
    handStoneMesh.scale.set(1.18, 1, 0.94);
    handStoneMesh.castShadow = !this.isSoftwareGl;
    handStoneSocket.add(handStoneMesh);

    if (bones.handR) {
      bones.handR.add(handStoneSocket);
      handStoneSocket.position.set(0, -0.045, 0.04);
    } else {
      wrapper.add(handStoneSocket);
      handStoneSocket.position.set(-0.22, targetH * 0.48, 0.18);
    }
    handStoneSocket.visible = false;

    const animNames: string[] = [];
    let mixer: THREE.AnimationMixer | undefined;
    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      const preferred =
        gltf.animations.find((c) => /idle|stand|breath|play|wait/i.test(c.name)) ??
        gltf.animations[0];
      mixer.clipAction(preferred).play();
      for (const clip of gltf.animations) animNames.push(clip.name || 'Animation');
    }

    this.group.add(wrapper);
    const newEntry: LoadedGLBSlot = {
      slot,
      wrapper,
      model,
      bones,
      bindQuats,
      hipsRestY,
      mixer,
      morphState,
      handStoneSocket,
      handStoneMesh,
      appearance: resolvedAppearance,
      customColors,
      baseRotY,
      modelHeight: targetH,
      walkBlend: 0,
    };
    this.applyHandStoneMeshToSlot(newEntry);
    this.slots.set(slot, newEntry);

    return {
      animations: animNames,
      hasSkeleton: Object.values(bones).some(Boolean),
    };
  }

  public updateCharacters(
    elapsed: number,
    dt: number,
    poses: Partial<Record<ChildStyle, CharacterPoseCommand>>,
    applyPreviewPose = false
  ) {
    for (const slotSpec of CHARACTER_SLOTS) {
      let cmd = poses[slotSpec.id];
      const entry = this.slots.get(slotSpec.id);
      const marker = this.floorMarkers.get(slotSpec.id);

      // Apply external viewport pose override when in title/diorama preview mode
      if (applyPreviewPose && this.previewPose !== 'idle' && slotSpec.id === 'kato' && cmd) {
        const pt = elapsed + slotSpec.phase;
        if (this.previewPose === 'hopping') {
          const hopP = (pt * 2.15) % 1;
          const jumpArc = Math.sin(hopP * Math.PI) * 0.16;
          cmd = {
            ...cmd,
            mode: 'HOP_LEFT_FOOT',
            emotion: 'happy',
            hopProgress: hopP,
            zLift: jumpArc,
            balanceSway: Math.sin(pt * 2.6) * 0.18,
          };
        } else if (this.previewPose === 'balancing') {
          cmd = {
            ...cmd,
            mode: 'HOP_LEFT_FOOT',
            emotion: 'surprised',
            hopProgress: 0,
            zLift: 0,
            balanceSway: Math.sin(pt * 3.1) * 0.85,
          };
        } else if (this.previewPose === 'landing') {
          const cycle = (pt * 0.8) % 1;
          const inHop = cycle < 0.36;
          const p = inHop ? cycle / 0.36 : 0;
          cmd = {
            ...cmd,
            mode: inHop ? 'HOP_TWO_FEET' : 'STAND_TWO_FEET',
            emotion: 'happy',
            hopProgress: p,
            zLift: inHop ? Math.sin(p * Math.PI) * 0.15 : 0,
            balanceSway: 0,
          };
        } else if (this.previewPose === 'victory') {
          cmd = {
            ...cmd,
            mode: 'VICTORY_DANCE',
            emotion: 'cheer',
            hopProgress: 0,
            zLift: 0,
            balanceSway: 0,
            actionTimer: elapsed,
            stoneInHand: false,
          };
        }
      }

      // Apply external viewport speechState override when in title/diorama preview mode
      if (applyPreviewPose && this.previewSpeechState !== 'silent' && slotSpec.id === 'kato' && cmd) {
        const speechModeMap: Partial<Record<SpeechState, CharacterActionMode>> = {
          laughing: 'EMOTE_LAUGH',
          annoyed: 'EMOTE_ANNOYED',
          cheering: 'SIDELINE_CHEER',
          celebrating: 'SIDELINE_CHEER',
          throwing: 'THROW_FOLLOW',
          aiming: 'IDLE_AIM',
          wobbling: 'HOP_LEFT_FOOT',
          banter: 'SIDELINE_IDLE',
        };
        const speechEmoMap: Partial<Record<SpeechState, CharacterEmotion>> = {
          laughing: 'laugh',
          annoyed: 'annoyed',
          cheering: 'cheer',
          celebrating: 'cheer',
          throwing: 'focused',
          aiming: 'focused',
          wobbling: 'surprised',
          banter: 'happy',
        };
        cmd = {
          ...cmd,
          mode: this.previewPose === 'idle' ? (speechModeMap[this.previewSpeechState] ?? cmd.mode) : cmd.mode,
          emotion: speechEmoMap[this.previewSpeechState] ?? cmd.emotion,
          speechState: this.previewSpeechState,
          speechIntensity: Math.max(cmd.speechIntensity, 0.72),
        };
      }

      if (cmd) {
        const gy = groundHeightAt(cmd.worldX, cmd.worldZ);
        if (marker && marker.visible) {
          marker.position.set(cmd.worldX, gy + 0.015, cmd.worldZ);
          marker.rotation.y = cmd.facingYaw;
        }
      }

      if (!entry) continue;

      if (entry.mixer) {
        entry.mixer.update(dt);
      }
      if (entry.morphState) {
        updateGLBMorphAndBreath(
          entry.morphState,
          elapsed,
          dt,
          cmd?.emotion ?? 'neutral',
          cmd?.speechIntensity ?? 0
        );
      }

      const { bones, bindQuats } = entry;
      const t = elapsed + slotSpec.phase;

      if (!cmd) {
        entry.handStoneSocket.visible = slotSpec.id === 'kato';
        applyBoneOffset(bones.spine, bindQuats, Math.sin(t * 1.4) * 0.03, 0, 0, dt, 8);
        applyBoneOffset(bones.head, bindQuats, 0, Math.sin(t * 0.65) * 0.09, 0, dt, 8);
        continue;
      }

      // 1. World placement + hop elevation + ground contact + natural walking between sideline & baseline
      const dxMove = cmd.worldX - entry.wrapper.position.x;
      const dzMove = cmd.worldZ - entry.wrapper.position.z;
      const moveDist = Math.hypot(dxMove, dzMove);
      const isSidelineOrWalk =
        cmd.mode === 'WALK_STRIDE' ||
        cmd.mode === 'SIDELINE_IDLE' ||
        cmd.mode === 'VICTORY_DANCE' ||
        (cmd.mode === 'IDLE_AIM' && moveDist > 0.08);
      const isCurrentlyWalking = isSidelineOrWalk && moveDist > 0.06;

      const posLambda = cmd.mode === 'VICTORY_DANCE' ? 5.6 : isSidelineOrWalk ? 4.3 : 18;
      entry.wrapper.position.x = THREE.MathUtils.damp(entry.wrapper.position.x, cmd.worldX, posLambda, dt);
      entry.wrapper.position.z = THREE.MathUtils.damp(entry.wrapper.position.z, cmd.worldZ, posLambda, dt);
      const walkStepBounce =
        isCurrentlyWalking ? Math.abs(Math.sin(t * 7.2)) * 0.028 * Math.min(1, moveDist * 2.2) : 0;
      const gy = groundHeightAt(entry.wrapper.position.x, entry.wrapper.position.z);
      entry.wrapper.position.y = gy + cmd.zLift + walkStepBounce;

      entry.walkBlend = THREE.MathUtils.damp(
        entry.walkBlend,
        isCurrentlyWalking ? Math.min(1, moveDist * 2.4) : 0,
        10,
        dt
      );

      // Face walking direction naturally while crossing the courtyard, then turn smoothly to target yaw
      const desiredYaw =
        isCurrentlyWalking && moveDist > 0.16 ? Math.atan2(dxMove, dzMove) : cmd.facingYaw;
      let diffYaw = desiredYaw - entry.wrapper.rotation.y;
      while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
      while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
      entry.wrapper.rotation.y += diffYaw * (1 - Math.exp(-(isCurrentlyWalking ? 9 : 14) * dt));

      if (cmd.mode !== 'VICTORY_DANCE' && Math.abs(entry.model.rotation.y) > 0.001) {
        entry.model.rotation.y = THREE.MathUtils.damp(entry.model.rotation.y, 0, 12, dt);
      }

      entry.handStoneSocket.visible = cmd.stoneInHand;

      const hasBones = Boolean(bones.spine || bones.upperArmR || bones.thighL);
      if (!hasBones) {
        continue;
      }

      // Smooth hip vertical position damping
      const setHipsOffset = (dropFrac: number) => {
        if (!bones.hips) return;
        const targetY = entry.hipsRestY * (1 - dropFrac);
        bones.hips.position.y = THREE.MathUtils.damp(bones.hips.position.y, targetY, 16, dt);
      };

      const spState = cmd.speechState ?? 'silent';
      const talkBob =
        cmd.speechIntensity > 0.05 || spState !== 'silent'
          ? Math.sin(t * 11) * (spState === 'laughing' ? 0.08 : 0.045) * Math.max(cmd.speechIntensity, 0.4)
          : 0;

      if (cmd.mode === 'WALK_STRIDE' || entry.walkBlend > 0.14) {
        const w = THREE.MathUtils.clamp(Math.max(entry.walkBlend, cmd.mode === 'WALK_STRIDE' ? 0.75 : 0), 0, 1);
        const stride = Math.sin(t * 7.2);
        const oppStride = -stride;
        setHipsOffset(0.025);

        applyBoneOffset(bones.spine, bindQuats, 0.07 * w, stride * 0.06 * w, 0, dt, 14);
        applyBoneOffset(bones.chest, bindQuats, 0.03 * w, -stride * 0.08 * w, 0, dt, 14);
        applyBoneOffset(bones.head, bindQuats, -0.02 + talkBob, stride * 0.03 * w, 0, dt, 14);

        // Natural opposite-arm walking swing
        applyBoneOffset(bones.upperArmL, bindQuats, oppStride * 0.36 * w, 0, -0.28, dt, 14);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.32 - Math.max(0, oppStride) * 0.18 * w, 0, 0, dt, 14);
        applyBoneOffset(bones.upperArmR, bindQuats, stride * 0.36 * w, 0, 0.28, dt, 14);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.32 - Math.max(0, stride) * 0.18 * w, 0, 0, dt, 14);

        // Natural alternating leg & knee stride
        const kneeLiftL = Math.max(0, Math.cos(t * 7.2)) * 0.48 * w;
        const kneeLiftR = Math.max(0, -Math.cos(t * 7.2)) * 0.48 * w;
        applyBoneOffset(bones.thighL, bindQuats, stride * 0.42 * w - 0.04, 0, 0.03, dt, 16);
        applyBoneOffset(bones.shinL, bindQuats, 0.14 + kneeLiftL, 0, 0, dt, 16);
        applyBoneOffset(bones.footL, bindQuats, -0.08 - kneeLiftL * 0.35, 0, 0, dt, 16);

        applyBoneOffset(bones.thighR, bindQuats, oppStride * 0.42 * w - 0.04, 0, -0.03, dt, 16);
        applyBoneOffset(bones.shinR, bindQuats, 0.14 + kneeLiftR, 0, 0, dt, 16);
        applyBoneOffset(bones.footR, bindQuats, -0.08 - kneeLiftR * 0.35, 0, 0, dt, 16);
      } else if (cmd.mode === 'IDLE_AIM') {
        const crouch = 0.035 + cmd.aimPower * 0.06;
        setHipsOffset(crouch);
        const windUp = cmd.aimPower * 0.72;
        const headTwist = cmd.isClaimPose ? 0.58 : 0;

        applyBoneOffset(bones.spine, bindQuats, 0.14 + windUp * 0.14, cmd.aimAngleOffset * 0.3, 0, dt, 14);
        applyBoneOffset(bones.chest, bindQuats, 0.08, -windUp * 0.28, 0, dt, 14);
        applyBoneOffset(bones.head, bindQuats, -0.08 + talkBob, headTwist, 0, dt, 14);

        // Right arm draws back cleanly as throw power charges
        applyBoneOffset(bones.upperArmR, bindQuats, 0.35 + windUp * 0.92, 0, 0.24, dt, 16);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.48 - windUp * 0.25, 0, 0, dt, 16);

        // Left arm relaxes forward for balance
        applyBoneOffset(bones.upperArmL, bindQuats, -0.22, 0, -0.24, dt, 14);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.35, 0, 0, dt, 14);

        // Athletic knee bend ready to hop
        applyBoneOffset(bones.thighL, bindQuats, -0.22 - windUp * 0.12, 0, 0.04, dt, 14);
        applyBoneOffset(bones.shinL, bindQuats, 0.42 + windUp * 0.22, 0, 0, dt, 14);
        applyBoneOffset(bones.footL, bindQuats, -0.18, 0, 0, dt, 14);
        applyBoneOffset(bones.thighR, bindQuats, -0.15 - windUp * 0.1, 0, -0.04, dt, 14);
        applyBoneOffset(bones.shinR, bindQuats, 0.3 + windUp * 0.2, 0, 0, dt, 14);
        applyBoneOffset(bones.footR, bindQuats, -0.14, 0, 0, dt, 14);
      } else if (cmd.mode === 'THROW_FOLLOW') {
        setHipsOffset(0.02);
        applyBoneOffset(bones.spine, bindQuats, 0.2, 0.16, 0, dt, 18);
        applyBoneOffset(bones.chest, bindQuats, 0.1, 0.2, 0, dt, 18);
        applyBoneOffset(bones.head, bindQuats, -0.06, 0, 0, dt, 18);
        applyBoneOffset(bones.upperArmR, bindQuats, -1.18, 0, 0.14, dt, 20);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.22, 0, 0, dt, 20);
        applyBoneOffset(bones.upperArmL, bindQuats, 0.24, 0, -0.28, dt, 16);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.25, 0, 0, dt, 16);
        applyBoneOffset(bones.thighL, bindQuats, -0.18, 0, 0.03, dt, 16);
        applyBoneOffset(bones.shinL, bindQuats, 0.32, 0, 0, dt, 16);
        applyBoneOffset(bones.footL, bindQuats, -0.14, 0, 0, dt, 16);
        applyBoneOffset(bones.thighR, bindQuats, 0.06, 0, -0.03, dt, 16);
        applyBoneOffset(bones.shinR, bindQuats, 0.12, 0, 0, dt, 16);
        applyBoneOffset(bones.footR, bindQuats, -0.08, 0, 0, dt, 16);
      } else if (cmd.mode === 'HOP_LEFT_FOOT' || cmd.mode === 'HOP_RIGHT_FOOT') {
        // Dynamic single-foot hopscotch: knee bends on takeoff/landing, free leg tucked sharply!
        const leftPlanted = cmd.mode === 'HOP_LEFT_FOOT';
        const isAirborne = cmd.zLift > 0.015;
        const p = THREE.MathUtils.clamp(cmd.hopProgress, 0, 1);
        const airArc = isAirborne ? Math.sin(p * Math.PI) : 0;
        const cushion = isAirborne ? Math.sin(Math.pow(p, 2.2) * Math.PI) * 0.22 : 0.12;
        const hopKneeBend = 0.46 + airArc * 0.38 + cushion;
        const hopThighBend = -0.23 - airArc * 0.18 - cushion * 0.5;

        setHipsOffset(0.055 + cushion * 0.18);

        const sway = THREE.MathUtils.clamp(cmd.balanceSway, -1, 1);
        applyBoneOffset(bones.spine, bindQuats, 0.12 + airArc * 0.06, 0, sway * 0.22, dt, 18);
        applyBoneOffset(bones.chest, bindQuats, 0.04, 0, -sway * 0.12, dt, 18);
        applyBoneOffset(bones.head, bindQuats, 0.06 + talkBob, 0, -sway * 0.1, dt, 18);

        // Arms flared outward like balance wings
        applyBoneOffset(bones.upperArmL, bindQuats, -0.12, 0, 0.62 + sway * 0.36 + airArc * 0.18, dt, 18);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.32, 0, 0, dt, 18);
        applyBoneOffset(bones.upperArmR, bindQuats, -0.12, 0, -0.62 + sway * 0.36 - airArc * 0.18, dt, 18);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.32, 0, 0, dt, 18);

        if (leftPlanted) {
          // Left leg supporting with real knee bend + ankle flex; Right leg bent high behind
          applyBoneOffset(bones.thighL, bindQuats, hopThighBend, 0, 0.04, dt, 22);
          applyBoneOffset(bones.shinL, bindQuats, hopKneeBend, 0, 0, dt, 22);
          applyBoneOffset(bones.footL, bindQuats, -hopKneeBend * 0.45, 0, 0, dt, 22);

          applyBoneOffset(bones.thighR, bindQuats, -0.34 - airArc * 0.14, 0, -0.08, dt, 22);
          applyBoneOffset(bones.shinR, bindQuats, 1.58 + airArc * 0.2, 0, 0, dt, 22);
          applyBoneOffset(bones.footR, bindQuats, 0.22, 0, 0, dt, 22);
        } else {
          // Right leg supporting with real knee bend; Left leg bent high behind
          applyBoneOffset(bones.thighR, bindQuats, hopThighBend, 0, -0.04, dt, 22);
          applyBoneOffset(bones.shinR, bindQuats, hopKneeBend, 0, 0, dt, 22);
          applyBoneOffset(bones.footR, bindQuats, -hopKneeBend * 0.45, 0, 0, dt, 22);

          applyBoneOffset(bones.thighL, bindQuats, -0.34 - airArc * 0.14, 0, 0.08, dt, 22);
          applyBoneOffset(bones.shinL, bindQuats, 1.58 + airArc * 0.2, 0, 0, dt, 22);
          applyBoneOffset(bones.footL, bindQuats, 0.22, 0, 0, dt, 22);
        }
      } else if (cmd.mode === 'HOP_TWO_FEET' || cmd.mode === 'STAND_TWO_FEET') {
        // Split / double-square straddle stance: both legs spread wide & land with bent knees!
        const isAirborne = cmd.mode === 'HOP_TWO_FEET' && cmd.zLift > 0.015;
        const p = THREE.MathUtils.clamp(cmd.hopProgress, 0, 1);
        const airArc = isAirborne ? Math.sin(p * Math.PI) : 0;
        const straddleAngle = isAirborne ? 0.3 + airArc * 0.12 : 0.36;
        const kneeFlex = isAirborne ? 0.42 + airArc * 0.34 : 0.48;
        const thighFlex = isAirborne ? -0.22 - airArc * 0.18 : -0.25;

        setHipsOffset(isAirborne ? 0.06 + airArc * 0.04 : 0.085);

        applyBoneOffset(bones.spine, bindQuats, 0.1 + airArc * 0.06, 0, 0, dt, 18);
        applyBoneOffset(bones.chest, bindQuats, 0.05, 0, 0, dt, 18);
        applyBoneOffset(bones.head, bindQuats, 0.04 + talkBob, 0, 0, dt, 18);

        // Balanced symmetric arm spread on split squares
        applyBoneOffset(bones.upperArmL, bindQuats, -0.06, 0, 0.42 + airArc * 0.25, dt, 18);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.38, 0, 0, dt, 18);
        applyBoneOffset(bones.upperArmR, bindQuats, -0.06, 0, -0.42 - airArc * 0.25, dt, 18);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.38, 0, 0, dt, 18);

        // Both legs abducted symmetrically into split landing
        applyBoneOffset(bones.thighL, bindQuats, thighFlex, 0, straddleAngle, dt, 22);
        applyBoneOffset(bones.shinL, bindQuats, kneeFlex, 0, -straddleAngle * 0.38, dt, 22);
        applyBoneOffset(bones.footL, bindQuats, -kneeFlex * 0.46, 0, -straddleAngle * 0.45, dt, 22);

        applyBoneOffset(bones.thighR, bindQuats, thighFlex, 0, -straddleAngle, dt, 22);
        applyBoneOffset(bones.shinR, bindQuats, kneeFlex, 0, straddleAngle * 0.38, dt, 22);
        applyBoneOffset(bones.footR, bindQuats, -kneeFlex * 0.46, 0, straddleAngle * 0.45, dt, 22);
      } else if (cmd.mode === 'BEND_PICKUP') {
        setHipsOffset(0.14);
        applyBoneOffset(bones.spine, bindQuats, 0.64, 0, 0, dt, 16);
        applyBoneOffset(bones.chest, bindQuats, 0.36, 0, 0, dt, 16);
        applyBoneOffset(bones.head, bindQuats, -0.28, 0, 0, dt, 16);
        applyBoneOffset(bones.upperArmR, bindQuats, -0.92, 0, 0.16, dt, 18);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.2, 0, 0, dt, 18);
        applyBoneOffset(bones.upperArmL, bindQuats, 0.36, 0, -0.22, dt, 16);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.32, 0, 0, dt, 16);
        applyBoneOffset(bones.thighL, bindQuats, -0.38, 0, 0.05, dt, 18);
        applyBoneOffset(bones.shinL, bindQuats, 0.72, 0, 0, dt, 18);
        applyBoneOffset(bones.footL, bindQuats, -0.32, 0, 0, dt, 18);
        applyBoneOffset(bones.thighR, bindQuats, -0.48, 0, -0.05, dt, 18);
        applyBoneOffset(bones.shinR, bindQuats, 1.38, 0, 0, dt, 18);
        applyBoneOffset(bones.footR, bindQuats, 0.2, 0, 0, dt, 18);
      } else if (cmd.mode === 'EMOTE_LAUGH') {
        const chuckle = Math.sin(t * 14);
        const hopBounce = Math.abs(Math.sin(t * 6.5)) * 0.05;
        entry.wrapper.position.y = gy + hopBounce;
        setHipsOffset(0.03);
        applyBoneOffset(bones.spine, bindQuats, -0.08 + chuckle * 0.05, Math.sin(t * 3.5) * 0.08, 0, dt, 14);
        applyBoneOffset(bones.chest, bindQuats, -0.06 + chuckle * 0.06, 0, 0, dt, 14);
        applyBoneOffset(bones.head, bindQuats, -0.16 + chuckle * 0.09, Math.sin(t * 4.2) * 0.14, 0, dt, 14);
        // Right hand holds belly laughing, left arm waves playfully
        applyBoneOffset(bones.upperArmR, bindQuats, -0.35, 0, 0.35, dt, 12);
        applyBoneOffset(bones.foreArmR, bindQuats, -1.15, 0, -0.45, dt, 12);
        applyBoneOffset(bones.upperArmL, bindQuats, -0.45 + chuckle * 0.15, 0, 0.25, dt, 12);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.75, 0, 0, dt, 12);
        applyBoneOffset(bones.thighL, bindQuats, -0.1, 0, 0.06, dt, 12);
        applyBoneOffset(bones.shinL, bindQuats, 0.2, 0, 0, dt, 12);
        applyBoneOffset(bones.footL, bindQuats, -0.1, 0, 0, dt, 12);
        applyBoneOffset(bones.thighR, bindQuats, -0.1, 0, -0.06, dt, 12);
        applyBoneOffset(bones.shinR, bindQuats, 0.2, 0, 0, dt, 12);
        applyBoneOffset(bones.footR, bindQuats, -0.1, 0, 0, dt, 12);
      } else if (cmd.mode === 'EMOTE_ANNOYED') {
        const headShake = Math.sin(t * 8.5) * 0.2;
        setHipsOffset(0.02);
        applyBoneOffset(bones.spine, bindQuats, 0.05, 0, Math.sin(t * 2.4) * 0.04, dt, 12);
        applyBoneOffset(bones.chest, bindQuats, 0.04, 0, 0, dt, 12);
        applyBoneOffset(bones.head, bindQuats, 0.1, headShake, 0.04, dt, 14);
        // Hands on hips / frustrated exasperation gesture
        applyBoneOffset(bones.upperArmL, bindQuats, 0.08, 0, 0.26, dt, 12);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.95, 0, -0.95, dt, 12);
        applyBoneOffset(bones.upperArmR, bindQuats, -0.55 + Math.sin(t * 7) * 0.18, 0, -0.28, dt, 12);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.75, 0, 0.35, dt, 12);
        applyBoneOffset(bones.thighL, bindQuats, -0.06, 0, 0.08, dt, 12);
        applyBoneOffset(bones.shinL, bindQuats, 0.14, 0, 0, dt, 12);
        applyBoneOffset(bones.footL, bindQuats, -0.08, 0, 0, dt, 12);
        applyBoneOffset(bones.thighR, bindQuats, -0.04, 0, -0.08, dt, 12);
        applyBoneOffset(bones.shinR, bindQuats, 0.1, 0, 0, dt, 12);
        applyBoneOffset(bones.footR, bindQuats, -0.06, 0, 0, dt, 12);
      } else if (cmd.mode === 'VICTORY_DANCE') {
        // 3-part joyful courtyard victory dance sequence (5.4s seamless loop):
        // 1) Hands-up celebration bounce & step groove -> 2) Afro-beat shoulder/hip shimmy -> 3) 360 spin + star-jump
        const cycleDur = 5.4;
        const danceTime = cmd.actionTimer;
        const phaseT = ((danceTime % cycleDur) + cycleDur) % cycleDur;
        const circDist = (center: number) => {
          const d = Math.abs(phaseT - center);
          return Math.min(d, cycleDur - d);
        };
        const falloff = (d: number) => {
          const s = THREE.MathUtils.clamp(1 - d / 1.35, 0, 1);
          return s * s * (3 - 2 * s);
        };
        const rawW1 = falloff(circDist(0.9));
        const rawW2 = falloff(circDist(2.7));
        const rawW3 = falloff(circDist(4.5));
        const wSum = Math.max(0.001, rawW1 + rawW2 + rawW3);
        const w1 = rawW1 / wSum;
        const w2 = rawW2 / wSum;
        const w3 = rawW3 / wSum;

        const beat = danceTime * 7.2;
        const halfBeat = danceTime * 3.6;

        // Smooth 360-degree celebratory spin (3.6s..4.55s) followed by star-jump leap (4.45s..5.05s)
        const spinFrac = THREE.MathUtils.clamp((phaseT - 3.6) / 0.95, 0, 1);
        const spinEase = spinFrac * spinFrac * (3 - 2 * spinFrac);
        entry.model.rotation.y = phaseT >= 3.6 && phaseT <= 5.25 ? spinEase * Math.PI * 2 : 0;

        const jumpFrac = THREE.MathUtils.clamp((phaseT - 4.45) / 0.62, 0, 1);
        const starArc = phaseT >= 4.45 && phaseT <= 5.07 ? Math.sin(jumpFrac * Math.PI) * 0.17 : 0;
        const hopBounce = Math.abs(Math.sin(beat)) * (0.085 * w1 + 0.032 * w2);
        entry.wrapper.position.y = gy + cmd.zLift + hopBounce + starArc + walkStepBounce;

        setHipsOffset(0.045 + Math.abs(Math.sin(beat)) * 0.025 * (w1 + w2));

        // Spine & chest groove + celebratory nod
        const swayZ = Math.sin(halfBeat) * (0.09 * w1 + 0.16 * w2);
        const chestTwist = -Math.sin(halfBeat) * (0.1 * w1 + 0.2 * w2);
        applyBoneOffset(bones.spine, bindQuats, -0.05 + Math.cos(beat) * 0.06, chestTwist * 0.45, swayZ, dt, 16);
        applyBoneOffset(bones.chest, bindQuats, -0.04 + Math.sin(beat) * 0.05, chestTwist, -swayZ * 0.45, dt, 16);
        applyBoneOffset(bones.head, bindQuats, -0.1 + Math.sin(beat) * 0.07 + talkBob, Math.sin(halfBeat) * 0.15, -swayZ * 0.3, dt, 16);

        // Blended arm choreography across moves 1, 2, 3
        const armL_X =
          w1 * (-1.62 + Math.sin(beat) * 0.24) +
          w2 * (-0.58 + Math.sin(halfBeat) * 0.48) +
          w3 * (-1.45 - starArc * 1.4);
        const armR_X =
          w1 * (-1.62 + Math.cos(beat) * 0.24) +
          w2 * (-0.58 - Math.sin(halfBeat) * 0.48) +
          w3 * (-1.45 - starArc * 1.4);
        const armFlare = w1 * 0.52 + w2 * 0.36 + w3 * (0.68 + starArc * 1.5);
        const foreL_X = w1 * (-0.28 - Math.cos(beat) * 0.2) + w2 * (-0.98 + Math.sin(beat) * 0.26) + w3 * -0.16;
        const foreR_X = w1 * (-0.28 - Math.sin(beat) * 0.2) + w2 * (-0.98 - Math.sin(beat) * 0.26) + w3 * -0.16;

        applyBoneOffset(bones.upperArmL, bindQuats, armL_X, 0, armFlare, dt, 18);
        applyBoneOffset(bones.foreArmL, bindQuats, foreL_X, 0, 0, dt, 18);
        applyBoneOffset(bones.upperArmR, bindQuats, armR_X, 0, -armFlare, dt, 18);
        applyBoneOffset(bones.foreArmR, bindQuats, foreR_X, 0, 0, dt, 18);

        // Alternating step-knee groove + star-jump straddle
        const stepL = Math.max(0, Math.sin(halfBeat)) * (w1 * 0.85 + w2 * 1.0);
        const stepR = Math.max(0, -Math.sin(halfBeat)) * (w1 * 0.85 + w2 * 1.0);
        const starStraddle = w3 * (starArc > 0.02 ? 0.34 * (starArc / 0.17) : 0.08);
        const kneeBase = 0.22;

        applyBoneOffset(bones.thighL, bindQuats, -0.14 - stepL * 0.36 - starArc * 0.4, 0, 0.05 + starStraddle, dt, 18);
        applyBoneOffset(bones.shinL, bindQuats, kneeBase + stepL * 0.65 + w3 * 0.18, 0, 0, dt, 18);
        applyBoneOffset(bones.footL, bindQuats, -0.1 - stepL * 0.24, 0, 0, dt, 18);

        applyBoneOffset(bones.thighR, bindQuats, -0.14 - stepR * 0.36 - starArc * 0.4, 0, -0.05 - starStraddle, dt, 18);
        applyBoneOffset(bones.shinR, bindQuats, kneeBase + stepR * 0.65 + w3 * 0.18, 0, 0, dt, 18);
        applyBoneOffset(bones.footR, bindQuats, -0.1 - stepR * 0.24, 0, 0, dt, 18);
      } else if (cmd.mode === 'SIDELINE_CHEER') {
        const jump = Math.abs(Math.sin(t * 7.2));
        entry.wrapper.position.y = gy + jump * 0.12;
        setHipsOffset(0.02);
        applyBoneOffset(bones.spine, bindQuats, -0.06, Math.sin(t * 4.5) * 0.08, 0, dt, 14);
        applyBoneOffset(bones.chest, bindQuats, -0.04, 0, 0, dt, 14);
        applyBoneOffset(bones.head, bindQuats, -0.12 + talkBob, Math.sin(t * 3.1) * 0.12, 0, dt, 14);
        // Arms lifted high in celebration
        applyBoneOffset(bones.upperArmL, bindQuats, -1.65 + Math.sin(t * 8.5) * 0.22, 0, 0.55, dt, 14);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.25, 0, 0, dt, 14);
        applyBoneOffset(bones.upperArmR, bindQuats, -1.65 + Math.cos(t * 8.5) * 0.22, 0, -0.55, dt, 14);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.25, 0, 0, dt, 14);
        applyBoneOffset(bones.thighL, bindQuats, -0.12, 0, 0.04, dt, 14);
        applyBoneOffset(bones.shinL, bindQuats, 0.24, 0, 0, dt, 14);
        applyBoneOffset(bones.footL, bindQuats, -0.12, 0, 0, dt, 14);
        applyBoneOffset(bones.thighR, bindQuats, -0.12, 0, -0.04, dt, 14);
        applyBoneOffset(bones.shinR, bindQuats, 0.24, 0, 0, dt, 14);
        applyBoneOffset(bones.footR, bindQuats, -0.12, 0, 0, dt, 14);
      } else {
        // SIDELINE_IDLE: relaxed natural stance, weight shift, animated talking gestures when speaking
        const sway = Math.sin(t * 0.95);
        const talkGesture = cmd.speechIntensity > 0.05 ? Math.sin(t * 6.5) * 0.22 * cmd.speechIntensity : 0;
        setHipsOffset(0.015);
        applyBoneOffset(bones.spine, bindQuats, 0.03, 0, sway * 0.035, dt, 10);
        applyBoneOffset(bones.chest, bindQuats, 0.02, 0, -sway * 0.025, dt, 10);
        applyBoneOffset(bones.head, bindQuats, 0.02 + talkBob, Math.sin(t * 0.55) * 0.14, 0, dt, 10);
        // Relax A-pose arms naturally down alongside torso
        applyBoneOffset(bones.upperArmL, bindQuats, 0.05 - talkGesture * 0.6, 0, -0.34, dt, 10);
        applyBoneOffset(bones.foreArmL, bindQuats, -0.34 - Math.sin(t * 1.1) * 0.06 - talkGesture, 0, 0, dt, 10);
        applyBoneOffset(bones.upperArmR, bindQuats, 0.04 - talkGesture, 0, 0.34, dt, 10);
        applyBoneOffset(bones.foreArmR, bindQuats, -0.3 + Math.sin(t * 1.1) * 0.06 - talkGesture * 1.2, 0, 0, dt, 10);
        applyBoneOffset(bones.thighL, bindQuats, -0.05, 0, 0.03, dt, 10);
        applyBoneOffset(bones.shinL, bindQuats, 0.1, 0, 0, dt, 10);
        applyBoneOffset(bones.footL, bindQuats, -0.05, 0, 0, dt, 10);
        applyBoneOffset(bones.thighR, bindQuats, 0.02, 0, -0.03, dt, 10);
        applyBoneOffset(bones.shinR, bindQuats, 0.06, 0, 0, dt, 10);
        applyBoneOffset(bones.footR, bindQuats, -0.04, 0, 0, dt, 10);
      }
    }
  }

  public dispose() {
    this.disposed = true;
    for (const slot of Array.from(this.slots.keys())) {
      this.clearSlot(slot, false);
    }
  }
}

