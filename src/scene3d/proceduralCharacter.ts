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
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const base = new THREE.Color(baseHex);
  const r = Math.round(base.r * 255);
  const g = Math.round(base.g * 255);
  const b = Math.round(base.b * 255);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 64, 64);

  // Subtle organic skin warmth & micro-tone variation
  for (let y = 0; y < 64; y += 4) {
    for (let x = 0; x < 64; x += 4) {
      const n = Math.sin(x * 0.45 + y * 0.35) * 6;
      const rr = THREE.MathUtils.clamp(Math.round(r + n), 12, 245);
      const gg = THREE.MathUtils.clamp(Math.round(g + n * 0.75), 8, 240);
      const bb = THREE.MathUtils.clamp(Math.round(b + n * 0.6), 6, 235);
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
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = spec.shirtHex;
  ctx.fillRect(0, 0, 128, 128);

  if (spec.pattern === 'kitenge') {
    ctx.strokeStyle = spec.trimHex;
    ctx.lineWidth = 4;
    for (let y = 16; y < 128; y += 32) {
      for (let x = 16; x < 128; x += 32) {
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (spec.pattern === 'stripes') {
    ctx.fillStyle = spec.trimHex;
    ctx.fillRect(0, 22, 128, 8);
    ctx.fillRect(0, 96, 128, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = 0; x < 128; x += 8) {
      ctx.fillRect(x, 0, 2, 128);
    }
  } else if (spec.pattern === 'polka') {
    ctx.fillStyle = spec.trimHex;
    for (let y = 12; y < 128; y += 24) {
      for (let x = 12; x < 128; x += 24) {
        ctx.beginPath();
        ctx.arc(x + ((y / 24) % 2) * 12, y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    // Jersey athletic chevrons & weave
    ctx.fillStyle = spec.trimHex;
    ctx.fillRect(0, 18, 128, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.fillRect(0, 28, 128, 4);
  }

  // Subtle woven cotton grain for fold depth
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < 128; y += 4) {
    ctx.fillRect(0, y, 128, 1);
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
  radialSegments = 12
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radialSegments, 1);
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
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
  const skinMat = new THREE.MeshStandardMaterial({
    name: 'Skin',
    color: '#ffffff',
    map: createSkinDetailTexture(vis.skinHex),
    roughness: 0.72,
    metalness: 0.02,
  });

  const outfitMat = new THREE.MeshStandardMaterial({
    name: 'Outfit',
    color: '#ffffff',
    map: createOutfitFabricTexture(vis),
    roughness: 0.85,
    metalness: 0.02,
  });

  const bottomsMat = new THREE.MeshStandardMaterial({
    name: 'Bottoms',
    color: vis.bottomHex,
    roughness: 0.86,
    metalness: 0.02,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    name: 'Trim',
    color: vis.trimHex,
    roughness: 0.65,
    metalness: 0.04,
  });

  const shoeMat = new THREE.MeshStandardMaterial({
    name: vis.barefoot ? 'Skin' : 'Shoes',
    color: vis.barefoot ? '#ffffff' : vis.shoeHex,
    map: vis.barefoot ? skinMat.map : undefined,
    roughness: vis.barefoot ? 0.74 : 0.56,
    metalness: 0.04,
  });

  const soleMat = new THREE.MeshStandardMaterial({
    name: 'ShoeSole',
    color: '#F3EDE2',
    roughness: 0.78,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    name: 'Hair',
    color: vis.hairHex,
    roughness: 0.9,
    metalness: 0.02,
  });

  const scleraMat = new THREE.MeshStandardMaterial({
    name: 'Sclera',
    color: '#FAF8F5',
    roughness: 0.35,
  });

  const irisMat = new THREE.MeshStandardMaterial({
    name: 'Iris',
    color: '#1E110A',
    roughness: 0.2,
  });

  const lipMat = new THREE.MeshStandardMaterial({
    name: 'Lips',
    color: '#3F1D14',
    roughness: 0.6,
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
    new THREE.CylinderGeometry(0.088 * H, vis.skirt ? 0.128 * H : 0.094 * H, 0.11 * H, 14),
    vis.skirt ? bottomsMat : bottomsMat
  );
  pelvisMesh.position.set(0, -0.015 * H, 0);
  pelvisMesh.scale.set(1.12, 1, 0.86);
  hips.add(pelvisMesh);

  if (vis.skirt) {
    const skirtFlare = new THREE.Mesh(
      new THREE.CylinderGeometry(0.112 * H, 0.168 * H, 0.155 * H, 18),
      outfitMat
    );
    skirtFlare.position.set(0, -0.065 * H, 0);
    skirtFlare.scale.set(1.06, 1, 0.9);
    hips.add(skirtFlare);
  }

  // Lower Torso (Spine)
  const waistMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.084 * H, 0.088 * H, 0.11 * H, 14),
    outfitMat
  );
  waistMesh.position.set(0, 0.045 * H, 0);
  waistMesh.scale.set(1.12, 1, 0.82);
  spine.add(waistMesh);

  // Upper Torso (Chest)
  const chestMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.098 * H, 0.084 * H, 0.135 * H, 14),
    outfitMat
  );
  chestMesh.position.set(0, 0.055 * H, 0);
  chestMesh.scale.set(1.18, 1, 0.82);
  chest.add(chestMesh);

  // Collar trim ring
  const collarMesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.048 * H, 0.011 * H, 8, 16),
    trimMat
  );
  collarMesh.rotation.x = Math.PI / 2;
  collarMesh.position.set(0, 0.115 * H, 0.004 * H);
  chest.add(collarMesh);

  // Neck cylinder
  const neckMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.031 * H, 0.036 * H, 0.075 * H, 12),
    skinMat
  );
  neckMesh.position.set(0, 0.032 * H, 0.004 * H);
  neck.add(neckMesh);

  // Head & expressive face
  const headRadius = 0.082 * H;
  const cranium = new THREE.Mesh(
    new THREE.SphereGeometry(headRadius, 18, 16),
    skinMat
  );
  cranium.scale.set(0.95, 1.08, 0.98);
  cranium.position.set(0, 0.055 * H, 0);
  head.add(cranium);

  // Ears
  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.017 * H, 10, 8), skinMat);
    ear.scale.set(0.55, 1.15, 0.85);
    ear.position.set(side * 0.077 * H, 0.052 * H, -0.004 * H);
    head.add(ear);
  }

  // Expressive Eyes, Brows, Nose & Smile (positioned on +Z front of Head)
  for (const side of [-1, 1] as const) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.014 * H, 10, 8), scleraMat);
    eyeWhite.scale.set(1.05, 0.92, 0.65);
    eyeWhite.position.set(side * 0.028 * H, 0.062 * H, 0.071 * H);
    head.add(eyeWhite);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0085 * H, 10, 8), irisMat);
    pupil.scale.set(1, 1, 0.6);
    pupil.position.set(side * 0.028 * H, 0.062 * H, 0.0775 * H);
    head.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.024 * H, 0.0055 * H, 0.008 * H), hairMat);
    brow.position.set(side * 0.028 * H, 0.081 * H, 0.073 * H);
    brow.rotation.z = side * -0.08;
    head.add(brow);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.012 * H, 10, 8), skinMat);
  nose.scale.set(1.12, 0.85, 1.05);
  nose.position.set(0, 0.044 * H, 0.078 * H);
  head.add(nose);

  const smile = new THREE.Mesh(
    new THREE.TorusGeometry(0.016 * H, 0.0038 * H, 6, 12, Math.PI),
    lipMat
  );
  smile.rotation.x = Math.PI;
  smile.position.set(0, 0.029 * H, 0.073 * H);
  head.add(smile);

  // Distinct Ugandan hairstyles per child
  if (vis.hairStyle === 'fade') {
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.03, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
      hairMat
    );
    hairCap.scale.set(0.96, 1.06, 0.99);
    hairCap.position.set(0, 0.061 * H, -0.004 * H);
    hairCap.rotation.x = -0.14;
    head.add(hairCap);
  } else if (vis.hairStyle === 'afro') {
    const afro = new THREE.Mesh(new THREE.SphereGeometry(headRadius * 1.24, 18, 14), hairMat);
    afro.scale.set(1.04, 1.0, 1.02);
    afro.position.set(0, 0.075 * H, -0.012 * H);
    head.add(afro);
  } else if (vis.hairStyle === 'puffs') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairMat
    );
    cap.position.set(0, 0.06 * H, -0.005 * H);
    cap.rotation.x = -0.15;
    head.add(cap);

    for (const side of [-1, 1] as const) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.042 * H, 12, 10), hairMat);
      puff.position.set(side * 0.068 * H, 0.128 * H, -0.012 * H);
      head.add(puff);

      const band = new THREE.Mesh(new THREE.TorusGeometry(0.024 * H, 0.0065 * H, 8, 14), trimMat);
      band.position.set(side * 0.056 * H, 0.112 * H, -0.01 * H);
      band.rotation.y = Math.PI / 2;
      band.rotation.x = side * 0.5;
      head.add(band);
    }
  } else if (vis.hairStyle === 'braids') {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(headRadius * 1.04, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    cap.position.set(0, 0.06 * H, -0.006 * H);
    cap.rotation.x = -0.14;
    head.add(cap);

    // Sculpted back/side braids with golden bead tips
    for (let i = -3; i <= 3; i++) {
      const ang = i * 0.34;
      const bx = Math.sin(ang) * 0.074 * H;
      const bz = -Math.cos(ang) * 0.068 * H - 0.008 * H;
      const braid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.011 * H, 0.009 * H, 0.135 * H, 8),
        hairMat
      );
      braid.position.set(bx, 0.015 * H, bz);
      braid.rotation.z = -bx * 1.2;
      braid.rotation.x = 0.15;
      head.add(braid);

      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.011 * H, 8, 6), trimMat);
      bead.position.set(bx * 1.1, -0.052 * H, bz - 0.01 * H);
      head.add(bead);
    }
  }

  // Arms Builder (A-pose bind rotation so all bone deltas in glbCharacterController match!)
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
    // Natural A-pose outward slant (+0.26 on Left, -0.26 on Right)
    upperArm.rotation.z = sign * 0.26;
    shoulder.add(upperArm);

    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036 * H, 0.033 * H, 0.088 * H, 12),
      outfitMat
    );
    sleeve.position.set(0, -0.04 * H, 0);
    upperArm.add(sleeve);

    const upperSkin = makeCapsuleSegment(0.027 * H, 0.025 * H, 0.092 * H, skinMat, 10);
    upperSkin.position.set(0, -0.115 * H, 0);
    upperArm.add(upperSkin);

    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.037 * H, 12, 10), outfitMat);
    shoulderCap.position.set(0, -0.002 * H, 0);
    upperArm.add(shoulderCap);

    const foreArm = new THREE.Bone();
    foreArm.name = `${prefix}ForeArm`;
    foreArm.position.set(0, -0.16 * H, 0);
    foreArm.rotation.x = -0.1;
    upperArm.add(foreArm);

    const elbowJoint = new THREE.Mesh(new THREE.SphereGeometry(0.025 * H, 10, 8), skinMat);
    foreArm.add(elbowJoint);

    const foreSkin = makeCapsuleSegment(0.024 * H, 0.02 * H, 0.142 * H, skinMat, 10);
    foreSkin.position.set(0, -0.072 * H, 0);
    foreArm.add(foreSkin);

    const hand = new THREE.Bone();
    hand.name = `${prefix}Hand`;
    hand.position.set(0, -0.145 * H, 0);
    foreArm.add(hand);

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.024 * H, 10, 8), skinMat);
    palm.scale.set(0.85, 1.25, 0.72);
    palm.position.set(0, -0.022 * H, 0.004 * H);
    hand.add(palm);
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
      const shortLeg = makeCapsuleSegment(0.05 * H, 0.044 * H, 0.115 * H, bottomsMat, 12);
      shortLeg.position.set(0, -0.055 * H, 0);
      thigh.add(shortLeg);
    }

    const thighSkin = makeCapsuleSegment(0.041 * H, 0.034 * H, 0.195 * H, skinMat, 12);
    thighSkin.position.set(0, -0.105 * H, 0);
    thigh.add(thighSkin);

    const shin = new THREE.Bone();
    shin.name = `${prefix}Leg`;
    shin.position.set(0, -0.2 * H, 0);
    thigh.add(shin);

    const kneeCap = new THREE.Mesh(new THREE.SphereGeometry(0.034 * H, 10, 8), skinMat);
    shin.add(kneeCap);

    const calfSkin = makeCapsuleSegment(0.033 * H, 0.026 * H, 0.196 * H, skinMat, 12);
    calfSkin.position.set(0, -0.098 * H, 0);
    shin.add(calfSkin);

    const foot = new THREE.Bone();
    foot.name = `${prefix}Foot`;
    foot.position.set(0, -0.198 * H, 0);
    shin.add(foot);

    if (vis.barefoot) {
      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.026 * H, 10, 8), skinMat);
      foot.add(ankle);

      const footMesh = new THREE.Mesh(new THREE.BoxGeometry(0.054 * H, 0.032 * H, 0.115 * H), skinMat);
      footMesh.position.set(0, -0.036 * H, 0.032 * H);
      foot.add(footMesh);
    } else {
      const shoeUpper = new THREE.Mesh(new THREE.BoxGeometry(0.062 * H, 0.038 * H, 0.128 * H), shoeMat);
      shoeUpper.position.set(0, -0.028 * H, 0.034 * H);
      foot.add(shoeUpper);

      const shoeToe = new THREE.Mesh(new THREE.SphereGeometry(0.031 * H, 10, 8), shoeMat);
      shoeToe.scale.set(1.0, 0.62, 1.15);
      shoeToe.position.set(0, -0.032 * H, 0.088 * H);
      foot.add(shoeToe);

      const shoeSole = new THREE.Mesh(new THREE.BoxGeometry(0.065 * H, 0.014 * H, 0.136 * H), soleMat);
      shoeSole.position.set(0, -0.048 * H, 0.038 * H);
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
