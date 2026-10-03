/**
 * Awesome Box pad catalog and score/combo state.
 * Pure data: no AudioContext here. The page synthesizes sound.
 */

export const JACKPOT = 500;

export const PADS = [
  {
    id: "koponen",
    label: "Koponen",
    kind: "saw-chord",
    family: true,
    points: 100,
    ms: 420,
    line: "the Koponen (K-O-P-O-N-E-N) are awesome",
  },
  {
    id: "underwoods",
    label: "Underwoods",
    kind: "square-arp",
    family: true,
    points: 100,
    ms: 420,
    line: "the Underwoods are awesome",
  },
  {
    id: "canonicus",
    label: "Canonicus",
    kind: "wave",
    family: true,
    points: 100,
    ms: 520,
    line: "they had an awesome time at the Canonicus",
  },
  {
    id: "tubular",
    label: "Tubular",
    kind: "glide",
    family: false,
    points: 25,
    ms: 380,
    line: "totally tubular",
  },
  {
    id: "radical",
    label: "Radical",
    kind: "coin",
    family: false,
    points: 250,
    ms: 320,
    line: "radical to the max",
  },
  {
    id: "mixtape",
    label: "Mix Tape",
    kind: "beat",
    family: false,
    points: 40,
    ms: 700,
    line: "leave the mix tape in",
  },
];

export function initialState() {
  return { score: 0, pressed: [], unlocked: false };
}

export function applyHit(state, id) {
  const pad = PADS.find((p) => p.id === id);
  if (!pad) {
    throw new Error(`unknown pad: ${id}`);
  }
  const pressed = state.pressed.includes(id) ? state.pressed.slice() : state.pressed.concat(id);
  const family = PADS.filter((p) => p.family).map((p) => p.id);
  const unlocked = family.every((fid) => pressed.includes(fid));
  const justUnlocked = unlocked && !state.unlocked;
  return {
    score: state.score + pad.points + (justUnlocked ? JACKPOT : 0),
    pressed,
    unlocked,
    justUnlocked,
    pad,
  };
}
