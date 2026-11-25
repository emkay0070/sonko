import * as THREE from 'three';

export interface TreeWindUniforms {
  uWindTime: { value: number };
  uWindStrength: { value: number };
  uWindDir: { value: THREE.Vector2 };
}

export interface TreeWindState {
  timeSec: number;
  strength: number;
  dirX: number;
  dirZ: number;
  liveGust: number;
}

export const SHARED_TREE_WIND_UNIFORMS: TreeWindUniforms = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 0.42 },
  uWindDir: { value: new THREE.Vector2(0.84, 0.54).normalize() },
};

export const SHARED_TREE_WIND_STATE: TreeWindState = {
  timeSec: 0,
  strength: 0.42,
  dirX: 0.841,
  dirZ: 0.541,
  liveGust: 0.65,
};

export function computeTreeWindGustEnvelope(
  timeSec: number,
  x = 0.25,
  z = 0.35,
  dirX = 0.841,
  dirZ = 0.541
): number {
  const len = Math.hypot(dirX, dirZ) || 1;
  const wx = dirX / len;
  const wz = dirZ / len;
  const px = -wz;
  const pz = wx;
  const crossSeed = x * 0.23 - z * 0.31;
  const gustA = Math.sin((x * wx + z * wz) * 0.11 - timeSec * 0.44 + 0.35 * Math.sin(crossSeed * 0.7));
  const gustB = Math.sin((x * px + z * pz) * 0.075 - timeSec * 0.29 + 1.7);
  const clamped = Math.max(0, Math.min(1, 0.5 + 0.34 * gustA + 0.22 * gustB));
  return 0.32 + 0.68 * clamped;
}

export function updateGlobalTreeWind(
  timeSec: number,
  windStrength: number,
  dirX = 0.84,
  dirZ = 0.54
): void {
  const strength = Math.max(0.15, windStrength);
  SHARED_TREE_WIND_UNIFORMS.uWindTime.value = timeSec;
  SHARED_TREE_WIND_UNIFORMS.uWindStrength.value = strength;

  const len = Math.hypot(dirX, dirZ);
  const nx = len > 0.0001 ? dirX / len : 0.841;
  const nz = len > 0.0001 ? dirZ / len : 0.541;
  if (len > 0.0001) {
    SHARED_TREE_WIND_UNIFORMS.uWindDir.value.set(nx, nz);
  }

  SHARED_TREE_WIND_STATE.timeSec = timeSec;
  SHARED_TREE_WIND_STATE.strength = strength;
  SHARED_TREE_WIND_STATE.dirX = nx;
  SHARED_TREE_WIND_STATE.dirZ = nz;
  SHARED_TREE_WIND_STATE.liveGust = computeTreeWindGustEnvelope(timeSec, 0.25, 0.35, nx, nz);
}

export interface NaturalWindOptions {
  /** Primary macro crown sway amplitude in meters at reference height (or full UV tip). */
  swayScaleM: number;
  /** Secondary delicate leaf/frond flutter amplitude in meters (0 for rigid trunks/bark). */
  flutterScaleM?: number;
  /** Height measurement strategy: world meters above tree root, or UV.y for leaf blades/grass. */
  heightMode?: 'worldMeters' | 'uv';
  /** Height in meters above root where trunks begin to flex (roots <= base stay anchored). */
  heightBaseM?: number;
  /** Reference crown height in meters where bendWeight reaches ~1.0 (for 'worldMeters'). */
  refHeightM?: number;
  /**
   * When true, uses modelMatrix[3] as the tree's world root (so Hero Mango branches and its
   * child InstancedMesh foliage sprays share the exact same tree root and phase).
   */
  useModelRoot?: boolean;
  /** Exponential curve shaping flexibility from root to crown tip (default 1.6). */
  bendExponent?: number;
}

/**
 * Applies multi-layered, physically grounded wind animation to any MeshStandardMaterial
 * via onBeforeCompile:
 *  - Broad travelling directional gusts rolling across world XZ (so neighboring trees breathe out of phase)
 *  - Slow incommensurate multi-harmonic tree bend with subtle downstream lean & perpendicular arc
 *  - Optional high-frequency delicate foliage flutter near outer crown & leaf tips
 *  - Safe inverse projection into local coordinates (works with arbitrary Y rotations & InstancedMesh)
 */
export function applyNaturalWindShader(
  material: THREE.Material,
  options: NaturalWindOptions
): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;
  if (material.userData.__sonkoWindApplied) return;
  material.userData.__sonkoWindApplied = true;

  const swayScaleM = options.swayScaleM;
  const flutterScaleM = options.flutterScaleM ?? 0;
  const heightMode = options.heightMode ?? 'worldMeters';
  const heightBaseM = options.heightBaseM ?? 0.14;
  const refHeightM = Math.max(0.25, options.refHeightM ?? 6.0);
  const useModelRoot = Boolean(options.useModelRoot);
  const bendExponent = options.bendExponent ?? 1.6;

  const cacheKey = [
    'sonko-tree-wind-v1',
    swayScaleM.toFixed(4),
    flutterScaleM.toFixed(4),
    heightMode,
    heightBaseM.toFixed(3),
    refHeightM.toFixed(3),
    useModelRoot ? 'mr' : 'ir',
    bendExponent.toFixed(2),
  ].join(':');

  const prevBeforeCompile = material.onBeforeCompile;
  const prevCacheKey = material.customProgramCacheKey;

  material.onBeforeCompile = (shader, renderer) => {
    prevBeforeCompile?.call(material, shader, renderer);

    shader.uniforms.uWindTime = SHARED_TREE_WIND_UNIFORMS.uWindTime;
    shader.uniforms.uWindStrength = SHARED_TREE_WIND_UNIFORMS.uWindStrength;
    shader.uniforms.uWindDir = SHARED_TREE_WIND_UNIFORMS.uWindDir;

    const uniformDecls = `
uniform float uWindTime;
uniform float uWindStrength;
uniform vec2 uWindDir;
`;

    const heightCalc =
      heightMode === 'uv'
        ? `
  float swHNorm = clamp(uv.y, 0.0, 1.0);
`
        : `
  float swAboveRoot = max(0.0, (swVertWorld.y - swTreeRootWorld.y) - ${heightBaseM.toFixed(4)});
  float swHNorm = clamp(swAboveRoot / ${refHeightM.toFixed(4)}, 0.0, 1.35);
`;

    const flutterSnippet =
      flutterScaleM > 0.0001
        ? `
  float swLeafHash = dot(swVertWorld, vec3(5.31, 4.17, 6.23)) + swTreeSeed;
  float swFlutT = uWindTime * 2.85 + swLeafHash;
  float swFlutWave = 0.65 * sin(swFlutT) + 0.35 * cos(swFlutT * 1.67 + 0.8);
  float swFlutCross = 0.55 * cos(swFlutT * 1.29 + swLeafHash * 0.5);
  float swFlutMask = smoothstep(0.08, 0.78, swHNorm) * (0.35 + 0.65 * swGustEnv) * uWindStrength;
  float swFlutAmt = ${flutterScaleM.toFixed(4)} * swFlutMask;
  swWorldDisp += vec3(
    (swWindDir.x * swFlutWave + swPerpDir.x * swFlutCross) * swFlutAmt,
    (sin(swFlutT * 1.43) * 0.45) * swFlutAmt,
    (swWindDir.y * swFlutWave + swPerpDir.y * swFlutCross) * swFlutAmt
  );
`
        : '';

    const windBlock = `
#include <begin_vertex>
{
  mat4 swInstM = modelMatrix;
  #ifdef USE_INSTANCING
    swInstM = modelMatrix * instanceMatrix;
  #endif
  vec3 swVertWorld = (swInstM * vec4(transformed, 1.0)).xyz;
  vec3 swTreeRootWorld = ${useModelRoot ? 'modelMatrix[3].xyz' : 'swInstM[3].xyz'};
  ${heightCalc}
  float swBendWeight = swHNorm * pow(max(0.0001, swHNorm), ${(bendExponent - 1).toFixed(3)});

  vec2 swTreeXZ = swTreeRootWorld.xz;
  float swTreeSeed = fract(sin(dot(swTreeXZ, vec2(12.9898, 78.233))) * 43758.5453) * 6.283185;
  float swCrossSeed = dot(swTreeXZ, vec2(0.23, -0.31));

  vec2 swWindDir = normalize(uWindDir);
  vec2 swPerpDir = vec2(-swWindDir.y, swWindDir.x);

  float swGustA = sin(dot(swTreeXZ, swWindDir) * 0.11 - uWindTime * 0.44 + 0.35 * sin(swCrossSeed * 0.7));
  float swGustB = sin(dot(swTreeXZ, swPerpDir) * 0.075 - uWindTime * 0.29 + 1.7);
  float swGustEnv = 0.32 + 0.68 * clamp(0.5 + 0.34 * swGustA + 0.22 * swGustB, 0.0, 1.0);

  float swPhaseA = uWindTime * 0.78 + swTreeSeed;
  float swPhaseB = uWindTime * 0.41 + swTreeSeed * 1.63 + 2.1;
  float swSwayAxis = 0.24 + 0.76 * (0.62 * sin(swPhaseA) + 0.38 * sin(swPhaseB));
  float swSwayPerp = 0.45 * sin(uWindTime * 0.63 + swTreeSeed * 2.17 + 0.9) + 0.25 * cos(uWindTime * 1.05 + swTreeSeed);

  float swBreezeAmt = uWindStrength * swGustEnv;
  vec2 swHorizDisp = (swWindDir * swSwayAxis + swPerpDir * (swSwayPerp * 0.42)) * (swBendWeight * ${swayScaleM.toFixed(4)} * swBreezeAmt);
  float swDipY = -dot(swHorizDisp, swHorizDisp) * 0.28;
  vec3 swWorldDisp = vec3(swHorizDisp.x, swDipY, swHorizDisp.y);
  ${flutterSnippet}

  vec3 swAx = swInstM[0].xyz;
  vec3 swAy = swInstM[1].xyz;
  vec3 swAz = swInstM[2].xyz;
  vec3 swLocalDisp = vec3(
    dot(swWorldDisp, swAx) / max(0.00001, dot(swAx, swAx)),
    dot(swWorldDisp, swAy) / max(0.00001, dot(swAy, swAy)),
    dot(swWorldDisp, swAz) / max(0.00001, dot(swAz, swAz))
  );
  transformed += swLocalDisp;
}
`;

    shader.vertexShader = uniformDecls + shader.vertexShader.replace('#include <begin_vertex>', windBlock);
  };

  material.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(material) : '';
    return base ? `${base}|${cacheKey}` : cacheKey;
  };
  material.needsUpdate = true;
}
