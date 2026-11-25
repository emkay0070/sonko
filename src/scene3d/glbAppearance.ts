import * as THREE from 'three';
import { CompoundTextureLibrary } from './pbrTextures';

export type SkinTonePreset = 'original' | 'ebony' | 'mahogany' | 'chestnut' | 'umber';
export type OutfitStylePreset =
  | 'original'
  | 'kitenge'
  | 'plaid'
  | 'red_jersey'
  | 'mustard'
  | 'indigo'
  | 'forest';
export type ShoeStylePreset = 'original' | 'brown_leather' | 'black_bata' | 'dusty_canvas';

export interface CharacterAppearance {
  skinTone: SkinTonePreset;
  outfitStyle: OutfitStylePreset;
  shoeStyle: ShoeStylePreset;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = {
  skinTone: 'original',
  outfitStyle: 'original',
  shoeStyle: 'original',
};

export const SKIN_TONE_OPTIONS: Array<{ id: SkinTonePreset; label: string; hex: string }> = [
  { id: 'original', label: 'Original', hex: '#c8b8ad' },
  { id: 'ebony', label: 'Deep Ebony', hex: '#381e15' },
  { id: 'mahogany', label: 'Mahogany', hex: '#4d291c' },
  { id: 'chestnut', label: 'Chestnut', hex: '#683926' },
  { id: 'umber', label: 'Golden Umber', hex: '#814c33' },
];

export const OUTFIT_STYLE_OPTIONS: Array<{
  id: OutfitStylePreset;
  label: string;
  hex: string;
}> = [
  { id: 'original', label: 'Original', hex: '#c7c1b8' },
  { id: 'kitenge', label: 'Kitenge Print', hex: '#94281b' },
  { id: 'plaid', label: 'School Plaid', hex: '#1e3c5c' },
  { id: 'red_jersey', label: 'Cranes Red', hex: '#a82820' },
  { id: 'mustard', label: 'Sunlit Ochre', hex: '#cf9532' },
  { id: 'indigo', label: 'Kampala Blue', hex: '#284a6e' },
  { id: 'forest', label: 'Bush Green', hex: '#2a5636' },
];

export const SHOE_STYLE_OPTIONS: Array<{ id: ShoeStylePreset; label: string; hex: string }> = [
  { id: 'original', label: 'Original', hex: '#a89f96' },
  { id: 'brown_leather', label: 'Brown Bata', hex: '#4b2b1a' },
  { id: 'black_bata', label: 'Black Bata', hex: '#1a1919' },
  { id: 'dusty_canvas', label: 'Murram Canvas', hex: '#8b5e49' },
];

/**
 * Samples average linear luminance of a texture once so melanin skin remapping preserves
 * pores, cheek/lip gradients, and knuckle detail cleanly regardless of base texture brightness.
 */
function sampleTextureLinearLum(tex: THREE.Texture | null): number {
  if (!tex || !tex.image) return 0.25;
  const cached = tex.userData.__avgLinearLum as number | undefined;
  if (typeof cached === 'number') return cached;

  try {
    const img = tex.image as CanvasImageSource & { width?: number; height?: number };
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0.25;
    ctx.drawImage(img, 0, 0, 24, 24);
    const data = ctx.getImageData(0, 0, 24, 24).data;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      const lr = Math.pow(data[i] / 255, 2.2);
      const lg = Math.pow(data[i + 1] / 255, 2.2);
      const lb = Math.pow(data[i + 2] / 255, 2.2);
      const l = lr * 0.299 + lg * 0.587 + lb * 0.114;
      if (l > 0.01 && l < 0.92) {
        sum += l;
        count++;
      }
    }
    const avg = count > 0 ? Math.max(0.04, Math.min(0.7, sum / count)) : 0.25;
    tex.userData.__avgLinearLum = avg;
    return avg;
  } catch {
    return 0.25;
  }
}

function snapshotMaterialDefaults(mat: THREE.MeshStandardMaterial) {
  if (mat.userData.__snapshotSaved) return;
  mat.userData.__snapshotSaved = true;
  mat.userData.__origColor = mat.color.clone();
  mat.userData.__origRoughness = mat.roughness;
  mat.userData.__origOpacity = mat.opacity;
  mat.userData.__origNormalScale = mat.normalScale ? mat.normalScale.clone() : new THREE.Vector2(1, 1);
}

/**
 * Applies live customizable skin tone, outfit fabric/pattern, and shoe finish
 * directly to a loaded Blender GLB character without losing baked creases, pores, or normal maps.
 */
export interface CustomGLBColors {
  primaryColor?: string;
  accentColor?: string;
}

export function applyGLBCharacterAppearance(
  model: THREE.Object3D,
  appearance: CharacterAppearance,
  textures: CompoundTextureLibrary,
  customColors?: CustomGLBColors
) {
  const skinSpec = SKIN_TONE_OPTIONS.find((s) => s.id === appearance.skinTone);
  const outfitSpec = OUTFIT_STYLE_OPTIONS.find((o) => o.id === appearance.outfitStyle);
  const shoeSpec = SHOE_STYLE_OPTIONS.find((s) => s.id === appearance.shoeStyle);

  // Measure outfit texture baseline luminance once if needed
  let outfitAvgLum = 0.35;
  let skinAvgLum = 0.22;

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const rawMat of mats) {
      if (!(rawMat instanceof THREE.MeshStandardMaterial)) continue;
      if (rawMat.name === 'Skin' && rawMat.map) {
        skinAvgLum = sampleTextureLinearLum(rawMat.map);
      } else if (rawMat.name === 'Outfit' && rawMat.map) {
        outfitAvgLum = sampleTextureLinearLum(rawMat.map);
      }
    }
  });

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

    for (const mat of mats) {
      if (!(mat instanceof THREE.MeshStandardMaterial)) continue;
      snapshotMaterialDefaults(mat);

      const mName = mat.name;

      // 1. Skin & Skin details
      if (mName === 'Skin') {
        if (appearance.skinTone === 'original' || !skinSpec) {
          mat.color.copy(mat.userData.__origColor as THREE.Color);
          mat.userData.__skinUniform = null;
          mat.onBeforeCompile = () => {};
          mat.customProgramCacheKey = () => 'glb-skin-orig';
          mat.needsUpdate = true;
        } else {
          const targetLinear = new THREE.Color(skinSpec.hex);
          mat.color.set('#ffffff');
          const uniforms = (mat.userData.__skinUniform as {
            uTargetSkinColor: { value: THREE.Color };
            uSkinBaseLum: { value: number };
          }) ?? {
            uTargetSkinColor: { value: targetLinear.clone() },
            uSkinBaseLum: { value: skinAvgLum },
          };
          uniforms.uTargetSkinColor.value.copy(targetLinear);
          uniforms.uSkinBaseLum.value = skinAvgLum;
          mat.userData.__skinUniform = uniforms;

          mat.onBeforeCompile = (shader) => {
            shader.uniforms.uTargetSkinColor = uniforms.uTargetSkinColor;
            shader.uniforms.uSkinBaseLum = uniforms.uSkinBaseLum;
            shader.fragmentShader =
              `uniform vec3 uTargetSkinColor;\nuniform float uSkinBaseLum;\n` +
              shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                float skLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                float relDetail = clamp(skLum / max(uSkinBaseLum, 0.04), 0.42, 1.48);
                vec3 warmShadow = uTargetSkinColor * vec3(0.92, 0.84, 0.80);
                vec3 skinCalibrated = mix(warmShadow, uTargetSkinColor * 1.08, smoothstep(0.42, 1.35, relDetail)) * relDetail;
                diffuseColor.rgb = mix(diffuseColor.rgb, skinCalibrated, 0.92);
                `
              );
          };
          mat.customProgramCacheKey = () => 'glb-skin-custom-v1';
          mat.needsUpdate = true;
        }
      } else if (mName === 'Skin details') {
        if (appearance.skinTone === 'original' || !skinSpec) {
          mat.color.copy(mat.userData.__origColor as THREE.Color);
          mat.opacity = mat.userData.__origOpacity as number;
        } else {
          mat.color.set(skinSpec.hex).lerp(new THREE.Color('#2a150e'), 0.25);
          mat.opacity = 0.52;
        }
        mat.needsUpdate = true;
      }

      // 2. Changeable Outfit Fabrics & Solid Dyes (preserving cloth folds & normal maps!)
      else if (mName === 'Outfit') {
        const hasCustomPrimary = Boolean(customColors?.primaryColor);
        if (!hasCustomPrimary && (appearance.outfitStyle === 'original' || !outfitSpec)) {
          mat.color.copy(mat.userData.__origColor as THREE.Color);
          mat.roughness = mat.userData.__origRoughness as number;
          mat.onBeforeCompile = () => {};
          mat.customProgramCacheKey = () => 'glb-outfit-orig';
          mat.needsUpdate = true;
        } else {
          const isPattern =
            !hasCustomPrimary &&
            (appearance.outfitStyle === 'kitenge' ||
              appearance.outfitStyle === 'plaid' ||
              appearance.outfitStyle === 'red_jersey');

          const patternTex =
            appearance.outfitStyle === 'kitenge'
              ? textures.kitengeSkirtAlbedo
              : appearance.outfitStyle === 'plaid'
                ? textures.plaidDressAlbedo
                : textures.redJerseyAlbedo;

          const dyeCol = new THREE.Color(customColors?.primaryColor ?? outfitSpec?.hex ?? '#15803D');
          const accCol = new THREE.Color(customColors?.accentColor ?? '#FBBF24');
          mat.color.set('#ffffff');
          mat.roughness = 0.86;

          const uniforms = (mat.userData.__outfitUniform as {
            uPatternMap: { value: THREE.Texture };
            uUsePattern: { value: number };
            uDyeColor: { value: THREE.Color };
            uAccentColor: { value: THREE.Color };
            uHasAccentStripe: { value: number };
            uOutfitBaseLum: { value: number };
          }) ?? {
            uPatternMap: { value: patternTex },
            uUsePattern: { value: isPattern ? 1.0 : 0.0 },
            uDyeColor: { value: dyeCol.clone() },
            uAccentColor: { value: accCol.clone() },
            uHasAccentStripe: { value: customColors?.accentColor ? 1.0 : 0.0 },
            uOutfitBaseLum: { value: outfitAvgLum },
          };

          uniforms.uPatternMap.value = patternTex;
          uniforms.uUsePattern.value = isPattern ? 1.0 : 0.0;
          uniforms.uDyeColor.value.copy(dyeCol);
          uniforms.uAccentColor.value.copy(accCol);
          uniforms.uHasAccentStripe.value = customColors?.accentColor ? 1.0 : 0.0;
          uniforms.uOutfitBaseLum.value = outfitAvgLum;
          mat.userData.__outfitUniform = uniforms;

          mat.onBeforeCompile = (shader) => {
            shader.uniforms.uPatternMap = uniforms.uPatternMap;
            shader.uniforms.uUsePattern = uniforms.uUsePattern;
            shader.uniforms.uDyeColor = uniforms.uDyeColor;
            shader.uniforms.uAccentColor = uniforms.uAccentColor;
            shader.uniforms.uHasAccentStripe = uniforms.uHasAccentStripe;
            shader.uniforms.uOutfitBaseLum = uniforms.uOutfitBaseLum;

            shader.fragmentShader =
              `uniform sampler2D uPatternMap;\nuniform float uUsePattern;\nuniform vec3 uDyeColor;\nuniform vec3 uAccentColor;\nuniform float uHasAccentStripe;\nuniform float uOutfitBaseLum;\n` +
              shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                float clLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                float foldShade = clamp(clLum / max(uOutfitBaseLum, 0.05), 0.34, 1.38);
                #ifdef USE_MAP
                  vec3 patSrgb = texture2D(uPatternMap, fract(vMapUv * 4.5)).rgb;
                  vec3 patLinear = pow(patSrgb, vec3(2.2));
                  float weaveDiamond = step(0.84, fract(vMapUv.x * 16.0 + vMapUv.y * 16.0)) * 0.45;
                #else
                  vec3 patLinear = uDyeColor;
                  float weaveDiamond = 0.0;
                #endif
                vec3 baseTarget = mix(uDyeColor, patLinear, uUsePattern);
                vec3 targetCloth = mix(baseTarget, uAccentColor, uHasAccentStripe * weaveDiamond * (1.0 - uUsePattern));
                diffuseColor.rgb = targetCloth * foldShade;
                `
              );
          };
          mat.customProgramCacheKey = () => 'glb-outfit-custom-v2';
          mat.needsUpdate = true;
        }
      }

      // 3. Shoes
      else if (mName === 'Shoes') {
        if (customColors?.accentColor && appearance.shoeStyle === 'original') {
          mat.color.set(customColors.accentColor).lerp(new THREE.Color('#2d1b12'), 0.55);
          mat.roughness = 0.55;
        } else if (appearance.shoeStyle === 'original' || !shoeSpec) {
          mat.color.copy(mat.userData.__origColor as THREE.Color);
          mat.roughness = 0.55;
        } else {
          mat.color.set(shoeSpec.hex);
          mat.roughness = appearance.shoeStyle === 'dusty_canvas' ? 0.88 : 0.48;
        }
        mat.needsUpdate = true;
      }
    }
  });
}

export type CharacterEmotion =
  | 'neutral'
  | 'focused'
  | 'happy'
  | 'laugh'
  | 'annoyed'
  | 'surprised'
  | 'cheer';

interface MorphTargetBinding {
  mesh: THREE.Mesh;
  blinkL?: number;
  blinkR?: number;
  wideL?: number;
  wideR?: number;
  squintL?: number;
  squintR?: number;
  browDownL?: number;
  browDownR?: number;
  browInnerUp?: number;
  browOuterL?: number;
  browOuterR?: number;
  jawOpen?: number;
  smile?: number;
  frown?: number;
  pucker?: number;
  press?: number;
  stretch?: number;
  sneerL?: number;
  sneerR?: number;
  upperUp?: number;
  visemeAa?: number;
  visemeE?: number;
  visemeI?: number;
  visemeO?: number;
  visemeU?: number;
  visemePP?: number;
  visemeSS?: number;
}

export interface AnimatedGLBMorphState {
  meshesWithMorphs: MorphTargetBinding[];
  model: THREE.Object3D;
  baseScaleY: number;
  blinkTimer: number;
  blinkInterval: number;
  phase: number;
  currentWeights: {
    smile: number;
    frown: number;
    press: number;
    stretch: number;
    jawOpen: number;
    browDown: number;
    browInnerUp: number;
    browOuterUp: number;
    squint: number;
    wide: number;
    sneer: number;
  };
}

export function createGLBMorphState(model: THREE.Object3D, phase: number): AnimatedGLBMorphState {
  const meshesWithMorphs: MorphTargetBinding[] = [];

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const dict = mesh.morphTargetDictionary;
    const inf = mesh.morphTargetInfluences;
    if (!dict || !inf) return;

    meshesWithMorphs.push({
      mesh,
      blinkL: dict['eyeBlinkLeft'],
      blinkR: dict['eyeBlinkRight'],
      wideL: dict['eyeWideLeft'],
      wideR: dict['eyeWideRight'],
      squintL: dict['eyeSquintLeft'],
      squintR: dict['eyeSquintRight'],
      browDownL: dict['browDownLeft'],
      browDownR: dict['browDownRight'],
      browInnerUp: dict['browInnerUp'],
      browOuterL: dict['browOuterUpLeft'],
      browOuterR: dict['browOuterUpRight'],
      jawOpen: dict['jawOpen'],
      smile: dict['mouthSmile'],
      frown: dict['mouthFrown'],
      pucker: dict['mouthPucker'],
      press: dict['mouthPress'],
      stretch: dict['mouthStretch'],
      sneerL: dict['noseSneerLeft'],
      sneerR: dict['noseSneerRight'],
      upperUp: dict['mouthUpperUp'],
      visemeAa: dict['viseme_aa'],
      visemeE: dict['viseme_E'],
      visemeI: dict['viseme_I'],
      visemeO: dict['viseme_O'],
      visemeU: dict['viseme_U'],
      visemePP: dict['viseme_PP'],
      visemeSS: dict['viseme_SS'],
    });
  });

  return {
    meshesWithMorphs,
    model,
    baseScaleY: model.scale.y,
    blinkTimer: (phase * 1.7) % 3.4,
    blinkInterval: 2.7 + (phase % 2.1),
    phase,
    currentWeights: {
      smile: 0.14,
      frown: 0,
      press: 0,
      stretch: 0,
      jawOpen: 0,
      browDown: 0,
      browInnerUp: 0.04,
      browOuterUp: 0,
      squint: 0.06,
      wide: 0,
      sneer: 0,
    },
  };
}

export function updateGLBMorphAndBreath(
  state: AnimatedGLBMorphState,
  elapsed: number,
  dt: number,
  emotion: CharacterEmotion = 'neutral',
  speechIntensity = 0
) {
  const t = elapsed + state.phase;

  // Natural blinking across face, eyelashes & brows simultaneously
  state.blinkTimer += dt;
  let blinkVal = 0;
  if (state.blinkTimer >= state.blinkInterval) {
    const over = state.blinkTimer - state.blinkInterval;
    if (over < 0.15) {
      blinkVal = Math.sin((over / 0.15) * Math.PI);
    } else {
      state.blinkTimer = 0;
    }
  }

  // Target emotion weights
  let tSmile = 0.14 + Math.max(0, Math.sin(t * 0.45)) * 0.1;
  let tFrown = 0;
  let tPress = 0;
  let tStretch = 0;
  let tJaw = 0;
  let tBrowDown = 0;
  let tBrowInnerUp = Math.max(0, 0.04 + Math.sin(t * 0.72) * 0.04);
  let tBrowOuterUp = 0;
  let tSquint = 0.06 + Math.max(0, Math.sin(t * 0.45)) * 0.05;
  let tWide = 0;
  let tSneer = 0;

  if (emotion === 'laugh') {
    const laughPulse = 0.5 + 0.5 * Math.sin(t * 17.5);
    tSmile = 0.88;
    tStretch = 0.34;
    tJaw = 0.2 + laughPulse * 0.42;
    tSquint = 0.68;
    tBrowOuterUp = 0.38;
    tBrowInnerUp = 0.25;
  } else if (emotion === 'annoyed') {
    tSmile = 0;
    tFrown = 0.74;
    tPress = 0.48;
    tBrowDown = 0.82;
    tBrowInnerUp = 0;
    tSquint = 0.44;
    tSneer = 0.42;
  } else if (emotion === 'focused') {
    tSmile = 0.04;
    tPress = 0.28;
    tBrowDown = 0.32;
    tSquint = 0.28;
  } else if (emotion === 'surprised') {
    tSmile = 0.05;
    tWide = 0.75;
    tSquint = 0;
    tBrowInnerUp = 0.72;
    tBrowOuterUp = 0.58;
    tJaw = 0.36;
  } else if (emotion === 'happy' || emotion === 'cheer') {
    tSmile = emotion === 'cheer' ? 0.82 : 0.62;
    tStretch = 0.18;
    tSquint = 0.36;
    tBrowOuterUp = 0.28;
    tJaw = emotion === 'cheer' ? 0.22 : 0.06;
  }

  // Smooth exponential damping for facial transitions
  const cw = state.currentWeights;
  const spd = 12;
  cw.smile = THREE.MathUtils.damp(cw.smile, tSmile, spd, dt);
  cw.frown = THREE.MathUtils.damp(cw.frown, tFrown, spd, dt);
  cw.press = THREE.MathUtils.damp(cw.press, tPress, spd, dt);
  cw.stretch = THREE.MathUtils.damp(cw.stretch, tStretch, spd, dt);
  cw.jawOpen = THREE.MathUtils.damp(cw.jawOpen, tJaw, 15, dt);
  cw.browDown = THREE.MathUtils.damp(cw.browDown, tBrowDown, spd, dt);
  cw.browInnerUp = THREE.MathUtils.damp(cw.browInnerUp, tBrowInnerUp, spd, dt);
  cw.browOuterUp = THREE.MathUtils.damp(cw.browOuterUp, tBrowOuterUp, spd, dt);
  cw.squint = THREE.MathUtils.damp(cw.squint, tSquint, spd, dt);
  cw.wide = THREE.MathUtils.damp(cw.wide, tWide, spd, dt);
  cw.sneer = THREE.MathUtils.damp(cw.sneer, tSneer, spd, dt);

  // Real-time speech lip-sync syllable & viseme cycle
  const talk = THREE.MathUtils.clamp(speechIntensity, 0, 1);
  const syllable = talk > 0.02 ? 0.5 + 0.5 * Math.sin(t * 21.0 + Math.sin(t * 7.3) * 1.4) : 0;
  const talkJaw = talk * (0.14 + syllable * 0.42);
  const vPhase = (t * 8.5) % 5;
  const vAa = talk * Math.max(0, 1 - Math.abs(vPhase - 0.8)) * 0.58;
  const vE = talk * Math.max(0, 1 - Math.abs(vPhase - 1.9)) * 0.52;
  const vO = talk * Math.max(0, 1 - Math.abs(vPhase - 3.0)) * 0.55;
  const vPP = talk * Math.max(0, 1 - Math.abs(vPhase - 4.0)) * 0.45;
  const vSS = talk * Math.max(0, 1 - Math.abs(vPhase - 4.6)) * 0.42;

  for (const item of state.meshesWithMorphs) {
    const inf = item.mesh.morphTargetInfluences;
    if (!inf) continue;
    if (item.blinkL !== undefined) inf[item.blinkL] = blinkVal;
    if (item.blinkR !== undefined) inf[item.blinkR] = blinkVal;
    if (item.wideL !== undefined) inf[item.wideL] = cw.wide;
    if (item.wideR !== undefined) inf[item.wideR] = cw.wide;
    if (item.squintL !== undefined) inf[item.squintL] = cw.squint;
    if (item.squintR !== undefined) inf[item.squintR] = cw.squint;
    if (item.browDownL !== undefined) inf[item.browDownL] = cw.browDown;
    if (item.browDownR !== undefined) inf[item.browDownR] = cw.browDown;
    if (item.browInnerUp !== undefined) inf[item.browInnerUp] = cw.browInnerUp;
    if (item.browOuterL !== undefined) inf[item.browOuterL] = cw.browOuterUp;
    if (item.browOuterR !== undefined) inf[item.browOuterR] = cw.browOuterUp;
    if (item.jawOpen !== undefined) inf[item.jawOpen] = Math.min(0.85, Math.max(cw.jawOpen, talkJaw));
    if (item.smile !== undefined) inf[item.smile] = cw.smile * (1 - talk * 0.35);
    if (item.frown !== undefined) inf[item.frown] = cw.frown * (1 - talk * 0.35);
    if (item.press !== undefined) inf[item.press] = cw.press * (1 - talk * 0.65);
    if (item.stretch !== undefined) inf[item.stretch] = cw.stretch;
    if (item.sneerL !== undefined) inf[item.sneerL] = cw.sneer;
    if (item.sneerR !== undefined) inf[item.sneerR] = cw.sneer;
    if (item.visemeAa !== undefined) inf[item.visemeAa] = vAa;
    if (item.visemeE !== undefined) inf[item.visemeE] = vE;
    if (item.visemeO !== undefined) inf[item.visemeO] = emotion === 'surprised' ? Math.max(0.35, vO) : vO;
    if (item.visemePP !== undefined) inf[item.visemePP] = vPP;
    if (item.visemeSS !== undefined) inf[item.visemeSS] = vSS;
  }

  // Subtle calm breathing & tiny natural weight balance
  const breathSpeed = emotion === 'laugh' ? 6.5 : emotion === 'annoyed' ? 3.2 : 2.05;
  const breathAmp = emotion === 'laugh' ? 0.011 : 0.0045;
  const breath = Math.sin(t * breathSpeed);
  state.model.scale.y = state.baseScaleY * (1 + breath * breathAmp);
  state.model.rotation.z = Math.sin(t * 0.65) * 0.007;
}

