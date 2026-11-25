import * as THREE from 'three';
import { WorldPlaceId } from '../game/progression';

/**
 * Deterministic heightfield for the Ugandan compound and surrounding Kampala hills.
 * Courtyard center (where Sonko chalk court sits) is compact, gently swept red murram soil
 * with subtle realistic foot-wear undulations (±1.5cm), grading smoothly into natural terrain outside.
 */
export function groundHeightAt(x: number, z: number): number {
  // Distance from active courtyard oval
  const nx = x / 8.5;
  const nz = z / 9.5;
  const radial = Math.sqrt(nx * nx + nz * nz);

  // Subtle courtyard micro-undulation, rain runoff rill & mango root heave
  const micro =
    Math.sin(x * 0.72 + 0.4) * Math.cos(z * 0.65 - 0.2) * 0.016 +
    Math.sin(x * 1.9 - z * 1.4) * 0.008 +
    Math.cos(x * 3.4 + z * 2.9) * 0.004;

  // Compacted foot-worn hopscotch path depression along the Sonko pitch
  const pitchMask =
    Math.exp(-((x - 0.25) * (x - 0.25)) / 2.6) * Math.exp(-((z - 0.35) * (z - 0.35)) / 13.0);
  const sweptDip = -0.022 * pitchMask;

  // Subtle organic soil heave around mango tree roots (-5.4, 4.4)
  const dRoot = Math.hypot(x - -5.4, z - 4.4);
  const rootHeave = dRoot < 2.2 ? Math.pow(1 - dRoot / 2.2, 2) * 0.11 : 0;

  if (radial <= 1.1) {
    return micro + sweptDip + rootHeave;
  }

  // Smooth transition past perimeter compound walls into rolling red-earth & lush hills
  const beyond = Math.max(0, radial - 1.1);
  const hillMask = Math.min(1, beyond * 0.22);
  const rollingHills =
    (Math.sin(x * 0.065 + 0.9) * Math.cos(z * 0.055 - 0.5) * 3.8 +
      Math.sin(x * 0.028 - z * 0.032) * 5.2 +
      Math.max(0, beyond - 1.2) * 0.55) *
    hillMask;

  return micro + rootHeave + rollingHills;
}

/**
 * Computes surface normal at (x, z) for aligning scattered stones, pebbles, and grass tufts.
 */
export function groundNormalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
  const eps = 0.08;
  const hL = groundHeightAt(x - eps, z);
  const hR = groundHeightAt(x + eps, z);
  const hD = groundHeightAt(x, z - eps);
  const hU = groundHeightAt(x, z + eps);
  return out.set(hL - hR, 2 * eps, hD - hU).normalize();
}

export interface TerrainTextures {
  courtyardAlbedo: THREE.Texture;
  courtyardNormal: THREE.Texture;
  courtyardRoughness: THREE.Texture;
  courtyardAO: THREE.Texture;
  chalkOverlay?: THREE.Texture;
}

/**
 * Builds the continuous terrain geometry:
 * 1) High-detail compound terrain (38m x 38m, 180x180 grid) with world-space macro compacted clay variation
 *    on top of 1024x1024 pebble/soil PBR maps + AO cavities.
 * 2) Distant hillside horizon ring fading naturally into atmospheric haze.
 * 3) Embedded 3D murram gravel pebbles.
 */
export function buildCompoundTerrain(textures: TerrainTextures): THREE.Group {
  const group = new THREE.Group();
  group.name = 'UgandanCompoundTerrain';

  // 1. Inner High-Resolution Compound Murram Mesh (38m x 38m, 72x72 grid — crisp & 6x lighter)
  const innerSize = 38;
  const innerSegs = 72;
  const innerGeo = new THREE.PlaneGeometry(innerSize, innerSize, innerSegs, innerSegs);
  innerGeo.rotateX(-Math.PI / 2);

  const pos = innerGeo.attributes.position as THREE.BufferAttribute;
  const uv = innerGeo.attributes.uv as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const cCenter = new THREE.Color('#ffffff');
  const cWear = new THREE.Color('#f0ded4'); // Sunlit compacted dust along court
  const cLeafAO = new THREE.Color('#ab8370'); // Organic leaf-litter shade under mango tree
  const cWallAO = new THREE.Color('#b69a8b'); // Contact shadow darkening along veranda & brick walls
  const tmpColor = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    // Tight 2.35m repeat so 1024x1024 pebbles & soil grains stay razor sharp up close
    uv.setXY(i, (x + innerSize * 0.5) / 2.35, (z + innerSize * 0.5) / 2.35);

    tmpColor.copy(cCenter);

    // Worn Sonko footpath strip
    const pitchInfluence =
      Math.exp(-((x - 0.25) * (x - 0.25)) / 3.4) * Math.exp(-((z - 0.35) * (z - 0.35)) / 16.0);
    tmpColor.lerp(cWear, pitchInfluence * 0.42);

    // Mango tree root & organic litter zone around (-5.4, 4.4)
    const dTree = Math.hypot(x - -5.4, z - 4.4);
    if (dTree < 4.6) {
      const treeFactor = Math.pow(1 - dTree / 4.6, 1.45);
      tmpColor.lerp(cLeafAO, treeFactor * 0.58);
    }

    // Veranda foundation contact zone
    if (x < -4.2 && x > -8.6 && z > -6.5 && z < 2.4) {
      const edgeDist = Math.abs(x - -4.5);
      if (edgeDist < 1.35) {
        tmpColor.lerp(cWallAO, (1 - edgeDist / 1.35) * 0.42);
      }
    }

    // Brick wall perimeter shadow/damp base
    const dRightWall = Math.abs(x - 7.6);
    const dBackWall = Math.abs(z - -8.6);
    if (dRightWall < 1.15) {
      tmpColor.lerp(cWallAO, (1 - dRightWall / 1.15) * 0.36);
    }
    if (dBackWall < 1.15) {
      tmpColor.lerp(cWallAO, (1 - dBackWall / 1.15) * 0.36);
    }

    // Grass / lush edge tint outside compound fence
    if (x > 7.9 || z < -9.0 || z > 10.2) {
      const outFactor = Math.min(1, Math.max(x - 7.9, -9.0 - z, z - 10.2) / 5.5);
      tmpColor.lerp(new THREE.Color('#9fa673'), outFactor * 0.52);
    }

    colors[i * 3] = tmpColor.r;
    colors[i * 3 + 1] = tmpColor.g;
    colors[i * 3 + 2] = tmpColor.b;
  }

  innerGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  innerGeo.setAttribute('uv2', uv);
  innerGeo.computeVertexNormals();

  const innerMat = new THREE.MeshStandardMaterial({
    map: textures.courtyardAlbedo,
    normalMap: textures.courtyardNormal,
    normalScale: new THREE.Vector2(1.65, 1.65),
    roughnessMap: textures.courtyardRoughness,
    roughness: 0.96,
    metalness: 0.02,
    aoMap: textures.courtyardAO,
    aoMapIntensity: 0.72,
    vertexColors: true,
  });

  const weatherWetnessUniform = { value: 0 };

  // World-space macro breakup shader: eliminates any visible texture tiling while adding
  // realistic compacted clay paths vs dry dusty soil variation across the yard + rain/dew wetness
  innerMat.onBeforeCompile = (shader) => {
    shader.uniforms.uWeatherWetness = weatherWetnessUniform;
    shader.vertexShader =
      `varying vec3 vMurramWorldPos;\n` +
      shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vMurramWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `
      );
    shader.fragmentShader =
      `varying vec3 vMurramWorldPos;\nuniform float uWeatherWetness;\n` +
      shader.fragmentShader
        .replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float mW1 = sin(vMurramWorldPos.x * 0.55 + cos(vMurramWorldPos.z * 0.42)) * 0.5 + 0.5;
          float mW2 = cos(vMurramWorldPos.z * 0.85 - sin(vMurramWorldPos.x * 0.72)) * 0.5 + 0.5;
          float compactedZone = smoothstep(0.32, 0.75, mW1 * 0.6 + mW2 * 0.4);
          vec3 dryOchre = vec3(1.07, 1.04, 0.99);
          vec3 richIronClay = vec3(0.86, 0.81, 0.78);
          diffuseColor.rgb *= mix(dryOchre, richIronClay, compactedZone * 0.62);
          float dampPatch = smoothstep(0.28, 0.84, mW2 * 0.55 + mW1 * 0.45);
          float dampMix = uWeatherWetness * mix(0.55, 1.0, dampPatch);
          diffuseColor.rgb *= mix(1.0, 0.66, dampMix);
          `
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `
          #include <roughnessmap_fragment>
          float mRw = sin(vMurramWorldPos.x * 0.55 + cos(vMurramWorldPos.z * 0.42)) * 0.5 + 0.5;
          float mRw2 = cos(vMurramWorldPos.z * 0.85 - sin(vMurramWorldPos.x * 0.72)) * 0.5 + 0.5;
          roughnessFactor = clamp(roughnessFactor - smoothstep(0.45, 0.85, mRw) * 0.12, 0.52, 0.99);
          float wetSlickSpot = smoothstep(0.36, 0.86, mRw * 0.45 + mRw2 * 0.55);
          float wetTargetRough = mix(0.48, 0.18, wetSlickSpot);
          roughnessFactor = mix(roughnessFactor, min(roughnessFactor, wetTargetRough), uWeatherWetness);
          `
        );
  };
  innerMat.customProgramCacheKey = () => 'sonko-murram-macro-v3';

  const innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.name = 'MurramCourtyardGround';
  innerMesh.receiveShadow = true;
  group.add(innerMesh);

  // 2. Surrounding Rolling Hills Skirt (inner 18m -> outer 155m)
  const outerGeo = new THREE.RingGeometry(18.5, 155, 44, 10);
  outerGeo.rotateX(-Math.PI / 2);
  const oPos = outerGeo.attributes.position as THREE.BufferAttribute;
  const oColors = new Float32Array(oPos.count * 3);
  const redClayColor = new THREE.Color('#7a3e28');
  const hillsideGrass = new THREE.Color('#5a6a38');
  const distantTreeTone = new THREE.Color('#3f512a');

  for (let i = 0; i < oPos.count; i++) {
    const x = oPos.getX(i);
    const z = oPos.getZ(i);
    const y = groundHeightAt(x, z);
    oPos.setY(i, y);

    const dist = Math.hypot(x, z);
    const vegBlend = Math.min(1, Math.max(0, (dist - 19) / 28));
    tmpColor.copy(redClayColor).lerp(hillsideGrass, vegBlend * 0.85);
    const patch = 0.5 + 0.5 * Math.sin(x * 0.09 + z * 0.07);
    tmpColor.lerp(distantTreeTone, patch * vegBlend * 0.55);

    oColors[i * 3] = tmpColor.r;
    oColors[i * 3 + 1] = tmpColor.g;
    oColors[i * 3 + 2] = tmpColor.b;
  }
  outerGeo.setAttribute('color', new THREE.BufferAttribute(oColors, 3));
  outerGeo.computeVertexNormals();

  const outerMat = new THREE.MeshStandardMaterial({
    roughness: 0.96,
    metalness: 0.0,
    vertexColors: true,
  });
  const outerMesh = new THREE.Mesh(outerGeo, outerMat);
  outerMesh.name = 'SurroundingKampalaHills';
  outerMesh.receiveShadow = true;
  group.add(outerMesh);

  const courtOffsetX = 0.25;
  const courtOffsetZ = 0.35;

  // 3. Embedded 3D Laterite Gravel Pebbles & Hardened Murram Clods (280 instances grounded flush)
  const pebbleGeo = new THREE.DodecahedronGeometry(0.036, 1);
  pebbleGeo.scale(1.25, 0.5, 1.0);
  const pebbleMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    normalMap: textures.courtyardNormal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.78,
    metalness: 0.04,
  });

  const pebbleCount = 280;
  const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  pebbles.name = 'EmbeddedMurramPebbles';
  pebbles.castShadow = false;
  pebbles.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const nrm = new THREE.Vector3();
  const cTint = new THREE.Color();

  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  let placed = 0;
  for (let i = 0; i < 420 && placed < pebbleCount; i++) {
    const px = (hash(i * 3 + 1) - 0.5) * 14.8;
    const pz = (hash(i * 3 + 2) - 0.5) * 16.4;
    const inChalkBox = Math.abs(px - courtOffsetX) < 1.15 && Math.abs(pz - courtOffsetZ) < 3.4;
    if (inChalkBox && hash(i * 29) > 0.14) continue;
    if (px < -4.6 && pz > -6.1 && pz < 2.2) continue;

    const py = groundHeightAt(px, pz);
    groundNormalAt(px, pz, nrm);
    const sc = inChalkBox ? 0.32 + hash(i * 7 + 3) * 0.38 : 0.48 + hash(i * 7 + 3) * 1.35;

    dummy.position.set(px, py + 0.004 * sc, pz);
    dummy.quaternion.setFromUnitVectors(up, nrm);
    dummy.rotateY(hash(i * 5 + 4) * Math.PI * 2);
    dummy.scale.set(
      sc * (0.85 + hash(i * 11) * 0.4),
      sc * (0.55 + hash(i * 13) * 0.45),
      sc * (0.85 + hash(i * 17) * 0.4)
    );
    dummy.updateMatrix();
    pebbles.setMatrixAt(placed, dummy.matrix);

    const v = hash(i * 19 + 9);
    if (v < 0.48) {
      cTint.set('#562a1c').lerp(new THREE.Color('#7a412c'), hash(i * 23));
    } else if (v < 0.82) {
      cTint.set('#696057').lerp(new THREE.Color('#8c8175'), hash(i * 31));
    } else {
      cTint.set('#b2a392');
    }
    pebbles.setColorAt(placed, cTint);
    placed++;
  }
  pebbles.count = placed;
  pebbles.instanceMatrix.needsUpdate = true;
  if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
  pebbles.computeBoundingSphere();
  group.add(pebbles);

  group.userData.__surfaceMaterial = innerMat;
  group.userData.__innerMesh = innerMesh;
  group.userData.__outerMesh = outerMesh;
  group.userData.__pebbles = pebbles;
  group.userData.__defaultTextures = { ...textures };
  group.userData.__hasCustomSurface = false;
  group.userData.__activePlace = 'kampala_compound';
  group.userData.__weatherWetnessUniform = weatherWetnessUniform;
  group.userData.__basePlaceColorHex = '#ffffff';
  group.userData.__basePlaceRoughness = 0.96;

  return group;
}

export interface CustomTerrainMaps {
  albedo?: THREE.Texture | null;
  normal?: THREE.Texture | null;
  roughness?: THREE.Texture | null;
  ao?: THREE.Texture | null;
}

function getOrLoadStonePlazaTexture(terrainGroup: THREE.Group, maxAniso: number): THREE.Texture {
  const existing = terrainGroup.userData.__stonePlazaTex as THREE.Texture | undefined;
  if (existing) return existing;

  const tex = new THREE.TextureLoader().load('/assets/textures/veranda_surface.jpg', (loaded) => {
    loaded.wrapS = THREE.RepeatWrapping;
    loaded.wrapT = THREE.RepeatWrapping;
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.anisotropy = Math.min(16, Math.max(1, maxAniso));
    loaded.needsUpdate = true;
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(16, Math.max(1, maxAniso));
  terrainGroup.userData.__stonePlazaTex = tex;
  return tex;
}

export function applyWorldTerrainTheme(
  terrainGroup: THREE.Group,
  place: WorldPlaceId,
  maxAnisotropy = 8
): void {
  terrainGroup.userData.__activePlace = place;
  const mat = terrainGroup.userData.__surfaceMaterial as THREE.MeshStandardMaterial | undefined;
  const defaults = terrainGroup.userData.__defaultTextures as TerrainTextures | undefined;
  const innerMesh = terrainGroup.userData.__innerMesh as THREE.Mesh | undefined;
  const pebbles = terrainGroup.userData.__pebbles as THREE.InstancedMesh | undefined;
  if (!mat || !defaults) return;

  if (pebbles) {
    pebbles.visible = place === 'kampala_compound';
  }

  // Keep inner terrain clean on Entebbe beach (worldEnvs renders beach + water) or visible with appropriate surface
  if (innerMesh) {
    innerMesh.visible = place !== 'entebbe_lakeside';
  }

  if (terrainGroup.userData.__hasCustomSurface) {
    return;
  }

  if (place === 'kampala_compound') {
    mat.map = defaults.courtyardAlbedo;
    mat.color.set('#ffffff');
    mat.vertexColors = true;
    mat.roughness = 0.96;
    terrainGroup.userData.__basePlaceColorHex = '#ffffff';
    terrainGroup.userData.__basePlaceRoughness = 0.96;
  } else if (place === 'trading_centre') {
    // Sunlit stone-and-laterite bustling market plaza using uploaded veranda stone texture
    const stoneTex = getOrLoadStonePlazaTexture(terrainGroup, maxAnisotropy);
    mat.map = stoneTex;
    mat.color.set('#b9977a');
    mat.vertexColors = false;
    mat.roughness = 0.88;
    terrainGroup.userData.__basePlaceColorHex = '#b9977a';
    terrainGroup.userData.__basePlaceRoughness = 0.88;
  } else if (place === 'primary_schoolyard') {
    // Lush park lawn continuous with Park.usdz & Playground
    mat.map = null;
    mat.color.set('#5c7c41');
    mat.vertexColors = false;
    mat.roughness = 0.95;
    terrainGroup.userData.__basePlaceColorHex = '#5c7c41';
    terrainGroup.userData.__basePlaceRoughness = 0.95;
  } else if (place === 'ndere_festival') {
    // Swept dark festival earth & warm terracotta plaza
    mat.map = defaults.courtyardAlbedo;
    mat.color.set('#6d4d3e');
    mat.vertexColors = false;
    mat.roughness = 0.94;
    terrainGroup.userData.__basePlaceColorHex = '#6d4d3e';
    terrainGroup.userData.__basePlaceRoughness = 0.94;
  } else if (place === 'entebbe_lakeside') {
    mat.map = null;
    mat.color.set('#c9a66b');
    mat.vertexColors = false;
    mat.roughness = 0.92;
    terrainGroup.userData.__basePlaceColorHex = '#c9a66b';
    terrainGroup.userData.__basePlaceRoughness = 0.92;
  }
  mat.needsUpdate = true;
}

const _wetBaseColor = new THREE.Color();
const _wetDarkColor = new THREE.Color('#47352c');

export function applyTerrainWeatherWetness(terrainGroup: THREE.Group, wetness: number): void {
  const clamped = Math.max(0, Math.min(1, wetness));
  const u = terrainGroup.userData.__weatherWetnessUniform as { value: number } | undefined;
  if (u) {
    u.value = clamped;
  }
  const mat = terrainGroup.userData.__surfaceMaterial as THREE.MeshStandardMaterial | undefined;
  if (!mat) return;
  const baseRoughness = (terrainGroup.userData.__basePlaceRoughness as number | undefined) ?? 0.95;
  mat.roughness = THREE.MathUtils.lerp(baseRoughness, Math.min(baseRoughness, 0.42), clamped);

  const activePlace = (terrainGroup.userData.__activePlace as WorldPlaceId) ?? 'kampala_compound';
  if (activePlace !== 'kampala_compound' && !terrainGroup.userData.__hasCustomSurface) {
    const baseHex = (terrainGroup.userData.__basePlaceColorHex as string | undefined) ?? '#ffffff';
    _wetBaseColor.set(baseHex).lerp(_wetDarkColor, clamped * 0.22);
    mat.color.copy(_wetBaseColor);
  }
}

export function applyCompoundTerrainSurface(terrainGroup: THREE.Group, maps: CustomTerrainMaps | null) {
  const mat = terrainGroup.userData.__surfaceMaterial as THREE.MeshStandardMaterial | undefined;
  const defaults = terrainGroup.userData.__defaultTextures as TerrainTextures | undefined;
  if (!mat || !defaults) return;

  if (!maps) {
    terrainGroup.userData.__hasCustomSurface = false;
    mat.map = defaults.courtyardAlbedo;
    mat.normalMap = defaults.courtyardNormal;
    mat.roughnessMap = defaults.courtyardRoughness;
    mat.aoMap = defaults.courtyardAO;
    mat.needsUpdate = true;
    const place = (terrainGroup.userData.__activePlace as WorldPlaceId) ?? 'kampala_compound';
    applyWorldTerrainTheme(terrainGroup, place);
    return;
  }

  terrainGroup.userData.__hasCustomSurface = true;
  mat.map = maps.albedo ?? defaults.courtyardAlbedo;
  mat.normalMap = maps.normal ?? defaults.courtyardNormal;
  mat.roughnessMap = maps.roughness ?? defaults.courtyardRoughness;
  mat.aoMap = maps.ao ?? defaults.courtyardAO;
  mat.color.set('#ffffff');
  terrainGroup.userData.__basePlaceColorHex = '#ffffff';
  terrainGroup.userData.__basePlaceRoughness = 0.94;
  mat.needsUpdate = true;
}
