import { NOTES, MAJ_IV, MIN_IV, MAJ_Q, MIN_Q, DEG, VAR_IV, CHORD_POSITIONS } from '../data/musicData';

export function ki(k) {
  return NOTES.indexOf(k);
}

export function getChords(key, mode) {
  const r   = ki(key);
  const ivs = mode === 'major' ? MAJ_IV : MIN_IV;
  const qs  = mode === 'major' ? MAJ_Q  : MIN_Q;
  return ivs.map((iv, i) => {
    const n = NOTES[(r + iv) % 12];
    return {
      note:    n,
      quality: qs[i],
      degree:  DEG[i],
      name:    qs[i] === 'min' ? n + 'm' : qs[i] === 'dim' ? n + '°' : n,
    };
  });
}

export function getChordTones(note, variant, quality) {
  const vk  = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '°' : '');
  const ivs = VAR_IV[vk] || [0, 4, 7];
  const r   = ki(note);
  return ivs.map(i => NOTES[(r + i) % 12]);
}

export function getSubstitutes(chordName, chords) {
  const idx = chords.findIndex(c => c.name === chordName);
  let subs = [];
  if (idx === 0) subs = [chords[5]?.name];
  else if (idx === 4) subs = [chords[6]?.name, chords[1]?.name];
  else if (idx === 1) subs = [chords[3]?.name];
  else if (idx === 5) subs = [chords[0]?.name, chords[2]?.name];
  return subs.filter(Boolean);
}

export function getVariantKey(variant, quality) {
  return variant || (quality === 'min' ? 'm' : quality === 'dim' ? '°' : '');
}

export function chordNameToNote(name) {
  return name.replace(/m7?|maj7|°|add9|sus[24]|[679]|ø7/g, '');
}

export function chordNameToQuality(name) {
  if (name.includes('m') && !name.includes('maj')) return 'min';
  if (name.includes('°')) return 'dim';
  return 'maj';
}

// 코드 이름과 루트 노트로부터 variant 키 추출
// 예: 'C13', 'C' → '13' / 'Cm7', 'C' → 'm7' / 'C', 'C' → ''
export function chordNameToVariant(name, note) {
  const suffix = name.replace(note, '');
  return VAR_IV[suffix] !== undefined ? suffix : '';
}

// ── CAGED 기반 배리어 운지 (offsets = barre 프렛 기준 상대값) ───────
// [E, A, D, G, B, e] 순서
const E_FORM = {
  '':    { offsets:[0,2,2,1,0,0], fingersBar:[1,3,4,2,1,1], fingersOpen:[0,2,3,1,0,0] },
  'm':   { offsets:[0,2,2,0,0,0], fingersBar:[1,3,4,1,1,1], fingersOpen:[0,2,3,0,0,0] },
  '7':   { offsets:[0,2,0,1,0,0], fingersBar:[1,3,1,2,1,1], fingersOpen:[0,2,0,1,0,0] },
  'm7':  { offsets:[0,2,0,0,0,0], fingersBar:[1,3,1,1,1,1], fingersOpen:[0,2,0,0,0,0] },
  'maj7':{ offsets:[0,2,1,1,0,0], fingersBar:[1,4,2,3,1,1], fingersOpen:[0,3,2,1,0,0] },
  'sus4':{ offsets:[0,2,2,2,0,0], fingersBar:[1,2,3,4,1,1], fingersOpen:[0,2,3,4,0,0] },
  // sus2는 E-form 실용성 낮아서 A-form만 제공
  '°':   { offsets:[0,1,2,0,-1,-1], fingersBar:[1,2,4,3,0,0], fingersOpen:[0,1,2,0,0,0] },
};

const A_FORM = {
  '':    { offsets:[-1,0,2,2,2,0], fingersBar:[0,1,3,4,3,1], fingersOpen:[0,0,1,2,3,0] },
  'm':   { offsets:[-1,0,2,2,1,0], fingersBar:[0,1,3,4,2,1], fingersOpen:[0,0,2,3,1,0] },
  '7':   { offsets:[-1,0,2,0,2,0], fingersBar:[0,1,3,1,4,1], fingersOpen:[0,0,2,0,3,0] },
  'm7':  { offsets:[-1,0,2,0,1,0], fingersBar:[0,1,3,1,2,1], fingersOpen:[0,0,2,0,1,0] },
  'maj7':{ offsets:[-1,0,2,1,2,0], fingersBar:[0,1,3,2,4,1], fingersOpen:[0,0,2,1,3,0] },
  'sus4':{ offsets:[-1,0,2,2,3,0], fingersBar:[0,1,2,3,4,1], fingersOpen:[0,0,1,2,3,0] },
  'sus2':{ offsets:[-1,0,2,2,0,0], fingersBar:[0,1,3,4,0,0], fingersOpen:[0,0,1,2,0,0] },
  '°':   { offsets:[-1,0,1,2,1,-1], fingersBar:[0,1,2,4,3,0], fingersOpen:[0,0,1,3,2,0] },
};

// variant 문자열 → CAGED 모양 키 (변환 매핑)
function normalizeVariantForShape(variant, quality) {
  if (!variant) return quality === 'min' ? 'm' : quality === 'dim' ? '°' : '';
  // 'm9', 'm11' → 'm7' 모양으로 근사
  if (variant === 'm9' || variant === 'm11') return 'm7';
  if (variant === 'm6') return 'm';
  // '9', '13', 'add9' → '7' 또는 '' 모양
  if (variant === '9' || variant === '13') return '7';
  if (variant === 'add9' || variant === '6') return '';
  // 'maj9' → 'maj7'
  if (variant === 'maj9') return 'maj7';
  // 'ø7' (half-dim) → 'm7b5'는 없으니 m7 모양 근사, '°7' → '°'
  if (variant === 'ø7') return 'm7';
  if (variant === '°7') return '°';
  // 'm', 'm7', '7', 'maj7', 'sus4', 'sus2', '°' 는 그대로
  return variant;
}

// 기타 운지 전체 조회: curated 데이터 우선, 부족하면 CAGED로 최대 3개까지 보완
export function getGuitarShapes(name, note, quality, variant) {
  // 1) curated 데이터 조회 (name 또는 variantKey)
  let curated = null;
  if (name && CHORD_POSITIONS[name]) {
    curated = CHORD_POSITIONS[name];
  } else {
    const variantKey = variant ? note + variant : (quality === 'min' ? note + 'm' : note);
    if (CHORD_POSITIONS[variantKey]) curated = CHORD_POSITIONS[variantKey];
  }

  // curated 데이터가 있으면 그대로 반환 (CAGED 근사로 잘못된 운지를 덧붙이지 않음)
  if (curated) return curated;

  // 2) CAGED 기반 보완 포지션 계산
  const shapeVar = normalizeVariantForShape(variant, quality);
  const noteIdx  = ki(note);
  if (noteIdx < 0) return curated || [];

  const eFret = (noteIdx - 4 + 12) % 12; // E string root = semitone index 4
  const aFret = (noteIdx - 9 + 12) % 12; // A string root = semitone index 9

  const cagedPositions = [];

  // E-form
  const ef = E_FORM[shapeVar];
  if (ef) {
    const frets = ef.offsets.map(o => o === -1 ? -1 : eFret + o);
    const fingers = eFret === 0 ? ef.fingersOpen : ef.fingersBar;
    const pos = eFret === 0 ? '오픈 (E형)' : `E형 ${eFret}프렛`;
    cagedPositions.push({ frets, fingers, pos });
  }

  // A-form (E-form과 프렛 차이가 2이상일 때만)
  const af = A_FORM[shapeVar];
  if (af && Math.abs(aFret - eFret) >= 2) {
    const frets = af.offsets.map(o => o === -1 ? -1 : aFret + o);
    const fingers = aFret === 0 ? af.fingersOpen : af.fingersBar;
    const pos = aFret === 0 ? '오픈 (A형)' : `A형 ${aFret}프렛`;
    cagedPositions.push({ frets, fingers, pos });
  }

  // 프렛 배열 동일 여부 비교 (pos 문자열이 달라도 같은 운지면 중복 처리)
  const sameShape = (a, b) =>
    a.frets.length === b.frets.length && a.frets.every((f, i) => f === b.frets[i]);

  if (cagedPositions.length) return cagedPositions;

  // 3) 최종 fallback: 기본 코드 운지
  const baseKey = quality === 'min' ? note + 'm' : note;
  return CHORD_POSITIONS[baseKey] || CHORD_POSITIONS[note] || [];
}
