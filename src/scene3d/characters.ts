export type ChildStyle = 'kato' | 'namukasa' | 'auma' | 'ssemakula';

export interface ChildSpec {
  id: ChildStyle;
  name: string;
  height: number;
  x: number;
  z: number;
  lookTarget: [number, number];
  phase: number;
}

export const CHARACTER_SLOTS: ChildSpec[] = [
  {
    id: 'kato',
    name: 'Kato',
    height: 1.34,
    x: 0.25,
    z: 3.38,
    lookTarget: [0.25, 0.35],
    phase: 0.2,
  },
  {
    id: 'namukasa',
    name: 'Namukasa',
    height: 1.31,
    x: -1.42,
    z: 1.82,
    lookTarget: [0.25, 1.3],
    phase: 1.4,
  },
  {
    id: 'auma',
    name: 'Auma',
    height: 1.24,
    x: -1.68,
    z: -0.55,
    lookTarget: [0.25, 0.8],
    phase: 2.7,
  },
  {
    id: 'ssemakula',
    name: 'Ssemakula',
    height: 1.38,
    x: 2.08,
    z: 2.35,
    lookTarget: [0.25, 1.4],
    phase: 3.9,
  },
];
