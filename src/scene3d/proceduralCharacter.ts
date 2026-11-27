import * as THREE from 'three';
import { CHARACTER_SLOTS, ChildStyle } from './characters';

interface CharacterVisualSpec {
  skinHex: string;
  shirtHex: string;
  bottomHex: string;
  trimHex: string;
  shoeHex: string;
  hairStyle: 'fade' | 'braids' | 'puffs' | 'afro';
  hairHex: string;
  skirt: boolean;
  barefoot: boolean;
  pattern: 'stripes' | 'kitenge' | 'polka' | 'jersey';
}

const CHARACTER_SPECS: Record<ChildStyle, CharacterVisualSpec> = {
  kato: {
    skinHex: '#683926',
    shirtHex: '#15803D', // Compound emerald green tee
    bottomHex: '#442B1E', // Khaki/brown play shorts
    trimHex: '#FBBF24', // Gold collar & sleeve trim
    shoeHex: '#2B1B12', // Brown Bata sneakers
    hairStyle: 'fade',
    hairHex: '#171210',
    skirt: false,
    barefoot: false,
    pattern: 'stripes',
  },
  namukasa: {
    skinHex: '#592E1E',
    shirtHex: '#B91C1C', // Rich crimson blouse
    bottomHex: '#9A3412', // Warm kitenge patterned skirt
    trimHex: '#FDE047', // Gold bead & collar accents
    shoeHex: '#1B1918', // Black Bata strap shoes
    hairStyle: 'braids',
    hairHex: '#14100E',
    skirt: true,
    barefoot: false,
    pattern: 'kitenge',
  },
  auma: {
    skinHex: '#7A462D',
    shirtHex: '#1D4ED8', // Kampala cobalt tunic
    bottomHex: '#1E3A8A', // Pleated navy school skirt
    trimHex: '#F59E0B', // Saffron hair bands & trim
    shoeHex: '#7A462D', // Barefoot in the courtyard dust
    hairStyle: 'puffs',
    hairHex: '#181210',
    skirt: true,
    barefoot: true,
    pattern: 'polka',
  },
  ssemakula: {
    skinHex: '#4A2619',
    shirtHex: '#D97706', // Sunlit amber cranes jersey
    bottomHex: '#1F2937', // Charcoal sports shorts
    trimHex: '#FAF3E8', // Cream jersey stripe
    shoeHex: '#221C1A', // Canvas trainers
    hairStyle: 'afro',
    hairHex: '#140F0D',
    skirt: false,
    barefoot: false,
    pattern: 'jersey',
  },
};

function createSkinDetailTexture(baseHex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const base = new THREE.Color(baseHex);
  const r = Math.round(base.r * 255);
  const g = Math.round(base.g * 255);
  const b = Math.round(base.b * 255);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Subtle multi-scale melanin micro-variation & organic skin warmth
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      const n =
        Math.sin(x * 0.12 + y * 0.09) * 5 +
        Math.cos(x * 0.31 - y * 0.27) * 3 +
        Math.sin(x * 0.73 + y * 0.61) * 1.8;
      const rr = THREE.MathUtils.clamp(Math.round(r + n * 1.15), 14, 245);
      const gg = THREE.MathUtils.clamp(Math.round(g + n * 0.85), 10, 240);
      const bb = THREE.MathUtils.clamp(Math.round(b + n * 0.65), 8, 235);
      ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
      ctx.fillRect(x, y, 4, 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createOutfitFabricTexture(spec: CharacterVisualSpec): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = spec.shirtHex;
  ctx.fillRect(0, 0, size, size);

  if (spec.pattern === 'kitenge') {
    ctx.strokeStyle = spec.trimHex;
    ctx.lineWidth = 4.5;
    for (let y = 24; y < size; y += 48) {
      for (let x = 24; x < size; x += 48) {
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 18, y);
        ctx.lineTo(x, y - 18);
        ctx.lineTo(x + 18, y);
        ctx.lineTo(x, y + 18);
        ctx.closePath();
        ctx.stroke();
        ctx.strokeStyle = spec.trimHex;
        ctx.lineWidth = 4.5;
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (spec.pattern === 'stripes') {
    ctx.fillStyle = spec.trimHex;
    ctx.fillRect(0, 44, size, 12);
    ctx.fillRect(0, 198, size, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    for (let x = 0; x < size; x += 12) {
      ctx.fillRect(x, 0, 3, size);
    }
  } else if (spec.pattern === 'polka') {
    ctx.fillStyle = spec.trimHex;
    for (let y = 20; y < size; y += 40) {
      for (let x = 20; x < size; x += 40) {
        ctx.beginPath();
        ctx.arc(x + ((y / 40) % 2) * 20, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.fillStyle = spec.trimHex;
    ctx.fillRect(0, 38, size, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(0, 52, size, 6);
  }

  // Natural cotton twill weave & subtle vertical seam folds
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let y = 0; y < size; y += 4) {
    ctx.fillRect(0, y, size, 1);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < size; x += 4) {
    ctx.fillRect(x, 0, 1, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function makeCapsuleSegment(
  radiusTop: number,
  radiusBottom: number,
  length: number,
  mat: THREE.Material,
  radialSegments = 16
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments, 2);
  return new THREE.Mesh(geo, mat);
}

/**
 * Builds an articulated 19-bone Ugandan child character whose bone hierarchy matches
 * `extractSkeletonBones()` in `glbCharacterController.ts` and material names (`Skin`, `Outfit`, `Shoes`)
 * match `applyGLBCharacterAppearance()` in `glbAppearance.ts`.
 */
export function createProceduralChildCharacter(
  slot: ChildStyle,
  isSoftwareGl: boolean
): THREE.Group {
  const slotSpec = CHARACTER_SLOTS.find((s) => s.id === slot) ?? CHARACTER_SLOTS[0];
  const vis = CHARACTER_SPECS[slot];
  const H = slotSpec.height;

  const root = new THREE.Group();
  root.name = `ProceduralChild_${slot}`;

  // Materials named explicitly for glbAppearance.ts compatibility
  // MeshPhysicalMaterial inherits MeshStandardMaterial while giving subtle natural skin & woven fabric light response
  const skinMat = new THREE.MeshPhysicalMaterial({
    name: 'Skin',
    color: '#ffffff',
    map: createSkinDetailTexture(vis.skinHex),
    roughness: 0.64,
    metalness: 0.01,
    clearcoat: 0.08,
    clearcoatRoughness: 0.58,
  });

  const outfitMat = new THREE.MeshPhysicalMaterial({
    name: 'Outfit',
    color: '#ffffff',
    map: createOutfitFabricTexture(vis),
    roughness: 0.88,
    metalness: 0.01,
    sheen: 0.42,
    sheenRoughness: 0.72,
    sheenColor: new THREE.Color('#fff2de'),
  });

  const bottomsMat = new THREE.MeshPhysicalMaterial({
    name: 'Bottoms',
    color: vis.bottomHex,
    roughness: 0.88,
    metalness: 0.01,
    sheen: 0.3,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color('#e6d7c6'),
  });

  const trimMat = new THREE.MeshStandardMaterial({
    name: 'Trim',
    color: vis.trimHex,
    roughness: 0.62,
    metalness: 0.04,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    name: vis.barefoot ? 'Skin' : 'Shoes',
    color: vis.barefoot ? '#ffffff' : vis.shoeHex,
    map: vis.barefoot ? skinMat.map : undefined,
    roughness: vis.barefoot ? 0.68 : 0.54,
    metalness: 0.04,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    name: 'ShoeSole',
    color: '#EFE7DA',
    roughness: 0.82,
  });

  const hairMat = new THREE.MeshPhysicalMaterial({
    name: 'Hair',
    color: vis.hairHex,
    roughness: 0.88,
    metalness: 0.02,
    sheen: 0.18,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color('#3b2c25'),
  });

  const scleraMat = new THREE.MeshStandardMaterial({
    name: 'Sclera',
    color: '#F8F4EE',
    roughness: 0.28,
  });

  const irisMat = new THREE.MeshStandardMaterial({
    name: 'Iris',
    color: '#190E08',
    roughness: 0.12,
    metalness: 0.05,
  });

  const lipMat = new THREE.MeshStandardMaterial({
    name: 'Lips',
    color: '#462118',
    roughness: 0.52,
  });

  // 19-bone skeleton tree matching humanoidAutoRig & extractSkeletonBones
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.set(0, 0.485 * H, 0.01 * H);
  root.add(hips);

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.07 * H, 0);
  hips.add(spine);

  const chest = new THREE.Bone();
  chest.name = 'Chest';
  chest.position.set(0, 0.115 * H, 0.004 * H);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 0.115 * H, 0.004 * H);
  chest.add(neck);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.065 * H, 0.01 * H);
  neck.add(head);

  // Pelvis / Shorts or Skirt top
  const pelvisMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.086 * H, vis.skirt ? 0.126 * H : 0.092 * H, 0.112 * H, 20),
    bottomsMat
  );
  pelvisMesh.position.set(0, -0.015 * H, 0);
  pelvisMesh.scale.set(1.1, 1, 0.84);
  hips.add(pelvisMesh);

  if (vis.skirt) {
    const skirtFlare = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11 * H, 0.166 * H, 0.16 * H, 24),
      outfitMat
    );
    skirtFlare.position.set(0, -0.066 * H, 0);
    skirtFlare.scale.set(1.06, 1, 0.9);
    hips.add(skirtFlare);
  }

  // Lower Torso (Spine)
  const waistMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.081 * H, 0.086 * H, 0.115 * H, 20),
    outfitMat
  );
  waistMesh.position.set(0, 0.045 * H, 0);
  waistMesh.scale.set(1.1, 1, 0.8);
  spine.add(waistMesh);

  // Upper Torso (Chest) with natural ribcage/shoulder taper
  const chestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.097 * H, 0.081 * H, 0.138 * H, 20),
    outfitMat
  );
  chestMesh.position.set(0, 0.055 * H, 0);
  chestMesh.scale.set(1.18, 1, 0.8);
  chest.add(chestMesh);

  // Subtle shirt shoulder bridge so upper chest transitions smoothly into sleeves
  const shoulderBridge = new THREE.Mesh(
    new THREE.SphereGeometry(0.085 * H, 18, 12),
    outfitMat
  );
  shoulderBridge.scale.set(1.36, 0.42, 0.86);
  shoulderBridge.position.set(0, 0.098 * H, 0);
  chest.add(shoulderBridge);

  // Collar trim ring
  const collarMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.045 * H, 0.0085 * H, 10, 20),
    trimMat
  );
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 0.116 * H, 0.004 * H);
  chest.add(collarMesh);

  // Neck cylinder
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03 * H, 0.036 * H, 0.076 * H, 16),
    skinMat
  );
  neckMesh.position.set(0, 0.032 * H, 0.004 * H);
  neck.add(neckMesh);

  // Sculpted Cranium & Jawline
  const headRadius = 0.078 * H;
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius, 24, 20),
    skinMat
  );
  cranium.scale.set(0.92, 1.07, 0.98);
  cranium.position.set(0, 0.058 * H, -0.002 * H);
  head.add(cranium);

  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius * 0.72, 18, 14),
    skinMat
  );
  jaw.scale.set(0.86, 0.82, 0.92);
  jaw.position.set(0, 0.025 * H, 0.015 * H);
  head.add(jaw);

  // Ears
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.015 * H, 12, 10), skinMat);
    ear.scale.set(0.48, 1.18, 0.8);
    ear.position.set(side * 0.073 * H, 0.052 * H, -0.005 * H);
    head.add(ear);
  }

  // Expressive Eyes, Eyelid crease, Brows, Sculpted Nose & Natural Lips
  for (const side of [-1, 1] as const) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.0125 * H, 14, 12), scleraMat);
    eyeWhite.scale.set(1.08, 0.78, 0.55);
    eyeWhite.position.set(side * 0.026 * H, 0.062 * H, 0.069 * H);
    head.add(eyeWhite);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0074 * H, 14, 12), irisMat);
    pupil.scale.set(1, 1, 0.52);
    pupil.position.set(side * 0.026 * H, 0.062 * H, 0.0745 * H);
    head.add(pupil);

    const upperLid = new THREE.Mesh(
      new THREE.BoxGeometry(0.024 * H, 0.0038 * H, 0.006 * H),
      skinMat
    );
    upperLid.position.set(side * 0.026 * H, 0.069 * H, 0.072 * H);
    upperLid.rotation.z = side * -0.04;
    head.add(upperLid);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.023 * H, 0.0044 * H, 0.007 * H), hairMat);
    brow.position.set(side * 0.026 * H, 0.079 * H, 0.071 * H);
    brow.rotation.z = side * -0.07;
    head.add(brow);
  }

  // Sculpted nasal bridge & tip
  const noseBridge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0065 * H, 0.0095 * H, 0.024 * H, 10),
    skinMat
  );
  noseBridge.position.set(0, 0.053 * H, 0.074 * H);
  noseBridge.rotation.x = -0.22;
  head.add(noseBridge);

  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.0115 * H, 12, 10), skinMat);
  noseTip.scale.set(1.18, 0.76, 0.95);
  noseTip.position.set(0, 0.042 * H, 0.0775 * H);
  head.add(noseTip);

  // Natural upper + lower lip form
  const upperLip = new THREE.Mesh(new THREE.SphereGeometry(0.014 * H, 12, 8), lipMat);
  upperLip.scale.set(1.35, 0.34, 0.6);
  upperLip.position.set(0, 0.026 * H, 0.0725 * H);
  head.add(upperLip);

  const lowerLip = new THREE.Mesh(new THREE.SphereGeometry(0.013 * H, 12, 8), lipMat);
  lowerLip.scale.set(1.22, 0.36, 0.62);
  lowerLip.position.set(0, 0.0205 * H, 0.0715 * H);
  head.add(lowerLip);

  // Distinct Ugandan hairstyles per child
  if (vis.hairStyle === 'fade') {
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.03, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hairCap.scale.set(0.94, 1.06, 0.99);
    hairCap.position.set(0, 0.062 * H, -0.004 * H);
    hairCap.rotation.x = -0.14;
    head.add(hairCap);
  } else if (vis.hairStyle === 'afro') {
    const afro = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.22, 22, 16), hairMat);
    afro.scale.set(1.02, 0.98, 1.0);
    afro.position.set(0, 0.076 * H, -0.012 * H);
    head.add(afro);
  } else if (vis.hairStyle === 'puffs') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.04, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    cap.scale.set(0.94, 1.04, 0.98);
    cap.position.set(0, 0.061 * H, -0.005 * H);
    cap.rotation.x = -0.15;
    head.add(cap);

    for (const side of [-1, 1] as const) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.04 * H, 16, 12), hairMat);
      puff.position.set(side * 0.066 * H, 0.128 * H, -0.012 * H);
      head.add(puff);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.023 * H, 0.006 * H, 10, 16), trimMat);
      band.position.set(side * 0.054 * H, 0.112 * H, -0.01 * H);
      band.rotation.y = Math.PI / 2;
      band.rotation.x = side * 0.5;
      head.add(band);
    }
  } else if (vis.hairStyle === 'braids') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.04, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    cap.scale.set(0.94, 1.04, 0.98);
    cap.position.set(0, 0.061 * H, -0.006 * H);
    cap.rotation.x = -0.14;
    head.add(cap);

    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.34;
      const bx = Math.sin(ang) * 0.072 * H;
      const bz = -Math.cos(ang) * 0.066 * H - 0.008 * H;
      const braid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01 * H, 0.0085 * H, 0.135 * H, 10),
        hairMat
      );
      braid.position.set(bx, 0.015 * H, bz);
      braid.rotation.z = -bx * 1.2;
      braid.rotation.x = 0.15;
      head.add(braid);

      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.0105 * H, 10, 8), trimMat);
      bead.position.set(bx * 1.1, -0.052 * H, bz - 0.01 * H);
      head.add(bead);
    }
  }

  // Arms Builder (A-pose bind rotation so all bone deltas in glbCharacterController match)
  const buildArm = (isLeft: boolean) => {
    const sign = isLeft ? 1 : -1;
    const prefix = isLeft ? 'Left' : 'Right';

    const shoulder = new THREE.Bone();
    shoulder.name = `${prefix}Shoulder`;
    shoulder.position.set(sign * 0.086 * H, 0.095 * H, 0);
    chest.add(shoulder);

    const upperArm = new THREE.Bone();
    upperArm.name = `${prefix}UpperArm`;
    upperArm.position.set(sign * 0.044 * H, -0.008 * H, 0);
    upperArm.rotation.z = sign * 0.26;
    shoulder.add(upperArm);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036 * H, 0.033 * H, 0.088 * H, 16),
      outfitMat
    );
    sleeve.position.set(0, -0.04 * H, 0);
    upperArm.add(sleeve);

    const upperSkin = makeCapsuleSegment(0.026 * H, 0.0235 * H, 0.096 * H, skinMat, 14);
    upperSkin.position.set(0, -0.114 * H, 0);
    upperArm.add(upperSkin);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.036 * H, 16, 12), outfitMat);
    shoulderCap.position.set(0, -0.002 * H, 0);
    upperArm.add(shoulderCap);

    const foreArm = new THREE.Bone();
    foreArm.name = `${prefix}ForeArm`;
    foreArm.position.set(0, -0.16 * H, 0);
    foreArm.rotation.x = -0.1;
    upperArm.add(foreArm);

    // Flush elbow blend (same radius as lower bicep/upper forearm)
    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.0235 * H, 12, 10), skinMat);
    foreArm.add(elbowJoint);

    const foreSkin = makeCapsuleSegment(0.0235 * H, 0.0185 * H, 0.145 * H, skinMat, 14);
    foreSkin.position.set(0, -0.072 * H, 0);
    foreArm.add(foreSkin);

    const hand = new THREE.Bone();
    hand.name = `${prefix}Hand`;
    hand.position.set(0, -0.145 * H, 0);
    foreArm.add(hand);

    // Sculpted palm + thumb silhouette
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.022 * H, 12, 10), skinMat);
    palm.scale.set(0.78, 1.25, 0.6);
    palm.position.set(0, -0.022 * H, 0.003 * H);
    hand.add(palm);

    const fingers = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015 * H, 0.012 * H, 0.032 * H, 10),
      skinMat
    );
    fingers.scale.set(1.05, 1, 0.55);
    fingers.position.set(0, -0.044 * H, 0.005 * H);
    hand.add(fingers);

    const thumb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0065 * H, 0.0055 * H, 0.024 * H, 8),
      skinMat
    );
    thumb.position.set(-sign * 0.015 * H, -0.022 * H, 0.012 * H);
    thumb.rotation.z = -sign * 0.45;
    thumb.rotation.x = 0.25;
    hand.add(thumb);
  };

  buildArm(true);
  buildArm(false);

  // Legs Builder
  const buildLeg = (isLeft: boolean) => {
    const sign = isLeft ? 1 : -1;
    const prefix = isLeft ? 'Left' : 'Right';

    const thigh = new THREE.Bone();
    thigh.name = `${prefix}UpLeg`;
    thigh.position.set(sign * 0.074 * H, -0.032 * H, 0);
    hips.add(thigh);

    if (!vis.skirt) {
      const shortLeg = makeCapsuleSegment(0.05 * H, 0.044 * H, 0.118 * H, bottomsMat, 16);
      shortLeg.position.set(0, -0.055 * H, 0);
      thigh.add(shortLeg);
    }

    const thighSkin = makeCapsuleSegment(0.041 * H, 0.033 * H, 0.2 * H, skinMat, 16);
    thighSkin.position.set(0, -0.105 * H, 0);
    thigh.add(thighSkin);

    const shin = new THREE.Bone();
    shin.name = `${prefix}Leg`;
    shin.position.set(0, -0.2 * H, 0);
    thigh.add(shin);

    // Flush knee joint matching thigh bottom / calf top radius
    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.0325 * H, 14, 10), skinMat);
    shin.add(kneeCap);

    const calfSkin = makeCapsuleSegment(0.0325 * H, 0.0245 * H, 0.198 * H, skinMat, 16);
    calfSkin.position.set(0, -0.098 * H, 0);
    shin.add(calfSkin);

    const foot = new THREE.Bone();
    foot.name = `${prefix}Foot`;
    foot.position.set(0, -0.198 * H, 0);
    shin.add(foot);

    if (vis.barefoot) {
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.0245 * H, 12, 10), skinMat);
      foot.add(ankle);

      const footArch = new THREE.Mesh(new THREE.SphereGeometry(0.028 * H, 14, 10), skinMat);
      footArch.scale.set(0.95, 0.56, 2.05);
      footArch.position.set(0, -0.035 * H, 0.034 * H);
      foot.add(footArch);
    } else {
      const collar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.029 * H, 0.031 * H, 0.024 * H, 14),
        shoeMat
      );
      collar.position.set(0, -0.012 * H, 0.004 * H);
      foot.add(collar);

      const shoeUpper = new THREE.Mesh(
        new THREE.SphereGeometry(0.034 * H, 16, 12),
        shoeMat
      );
      shoeUpper.scale.set(0.94, 0.62, 1.98);
      shoeUpper.position.set(0, -0.028 * H, 0.036 * H);
      foot.add(shoeUpper);

      const shoeSole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.034 * H, 0.036 * H, 0.013 * H, 16),
        soleMat
      );
      shoeSole.scale.set(0.98, 1, 2.04);
      shoeSole.position.set(0, -0.047 * H, 0.038 * H);
      foot.add(shoeSole);
    }
  };

  buildLeg(true);
  buildLeg(false);

  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = !isSoftwareGl;
      obj.receiveShadow = true;
    }
  });

  return root;
}
