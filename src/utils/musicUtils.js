import { NOTES, MAJ_IV, MIN_IV, MAJ_Q, MIN_Q, DEG, VAR_IV, CHORD_POSITIONS } from '../data/musicData';

// ── 플랫 표기 (A# → Bb 등) ─────────────────────────────────────
export const TO_FLAT = { 'A#':'Bb', 'D#':'Eb', 'G#':'Ab', 'C#':'Db', 'F#':'Gb' };
const FLAT_MAJOR = new Set(['F','Bb','Eb','Ab','Db','Gb']);
const FLAT_MINOR = new Set(['D','G','C','F','Bb','Eb','Ab']);

export function usesFlatDisplay(key, mode) {
  return (mode === 'major' && FLAT_MAJOR.has(key)) ||
         (mode === 'minor' && FLAT_MINOR.has(key));
}

// 코드명 표시용: 'A#m7' → 'Bbm7' (flat 키에서만)
export function flatChordName(name, key, mode) {
  if (!name || !usesFlatDisplay(key, mode)) return name;
  for (const [sharp, flat] of Object.entries(TO_FLAT)) {
    if (name.startsWith(sharp)) return flat + name.slice(sharp.length);
  }
  return name;
}

// 슬래시 코드 포함 전체 코드명 표시: 'Am/D#' → flat 키에서 'Am/Eb'
export function displayChordName(name, key, mode) {
  if (!name) return name;
  const si = name.indexOf('/');
  if (si < 0) return flatChordName(name, key, mode);
  const bass = name.slice(si + 1);
  const fb = usesFlatDisplay(key, mode) ? (TO_FLAT[bass] || bass) : bass;
  return flatChordName(name.slice(0, si), key, mode) + '/' + fb;
}

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
  const m = name.match(/^[A-G][b#]?/);
  return m ? m[0] : name;
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

// 포지션의 최저 실제 프렛 반환 (뮤트=-1 제외, 오픈=0)
function minActiveFret(pos) {
  const active = pos.frets.filter(f => f >= 0);
  return active.length ? Math.min(...active) : 99;
}

// 두 포지션의 프렛 배열이 동일한지 비교
function sameShape(a, b) {
  return a.frets.length === b.frets.length && a.frets.every((f, i) => f === b.frets[i]);
}

// 슬래시 코드 기타 운지: 베이스음을 루트로 E/A/D현에 배치, 유효한 모든 포지션 반환
// 예: Am/D# → D#를 루트로 D현(fret1), A현(fret6), E현(fret11) 순으로 탐색
const FLAT_TO_SHARP_MAP = { Bb:'A#', Eb:'D#', Ab:'G#', Db:'C#', Gb:'F#', Cb:'B', Fb:'E' };

function getSlashGuitarShapes(chordNote, quality, variant, bassNote) {
  const chordIdx  = NOTES.indexOf(chordNote);
  const bassSharp = FLAT_TO_SHARP_MAP[bassNote] || bassNote;
  const bassIdx   = NOTES.indexOf(bassSharp);
  if (chordIdx < 0 || bassIdx < 0) return [];

  const vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '°' : '');
  const ivs = VAR_IV[vk] || [0, 4, 7];
  const pcs = [...new Set(ivs.map(iv => (chordIdx + iv) % 12))];

  const openPCs  = [4, 9, 2, 7, 11, 4];
  const strNames = ['E현', 'A현', 'D현'];
  const results  = [];

  // D현(2) → A현(1) → E현(0) 순 (낮은 프렛 우선)
  for (const bassStr of [2, 1, 0]) {
    const bassFret = ((bassIdx - openPCs[bassStr]) % 12 + 12) % 12;
    const frets = new Array(6).fill(-1);
    // 베이스현보다 낮은 현은 뮤트
    frets[bassStr] = bassFret;

    // 오픈 포지션(bassFret < 5): 개방현/저프렛 허용 (바레코드 아님)
    // 고위치(bassFret >= 5): 바레 불가능 방지 — 베이스 프렛 이상만 허용
    const minAllowed = bassFret >= 5 ? bassFret : 0;
    for (let s = bassStr + 1; s <= 5; s++) {
      const open = openPCs[s];
      let best = -1, bestDist = Infinity;
      for (const pc of pcs) {
        let f = ((pc - open) % 12 + 12) % 12;
        while (f < minAllowed) f += 12;
        const dist = Math.abs(f - bassFret);
        if (dist < bestDist && f <= bassFret + 4) { bestDist = dist; best = f; }
      }
      frets[s] = best;
    }

    const active = frets.filter(f => f >= 0);
    if (active.length < 3) continue;
    if (Math.max(...active) - Math.min(...active) > 4) continue;

    const minF    = Math.min(...active);
    const fingers = frets.map(f => f < 0 ? 0 : Math.min(4, Math.max(1, f - minF + 1)));
    results.push({ frets, fingers, pos: `${bassNote}베이스 (${strNames[bassStr]})` });
  }

  return results;
}

// 기타 운지 전체 조회: curated 우선, 2개 미만이면 CAGED로 보완, 마지막에 낮은 프렛 순 정렬
export function getGuitarShapes(name, note, quality, variant) {
  // 0) 슬래시 코드 처리 — 베이스음을 루트로 한 운지만 사용
  if (name && name.includes('/')) {
    const [chordPart, bassNote] = name.split('/');
    const chordNote = (chordPart.match(/^[A-G][b#]?/) || [])[0] || note;
    const suffix    = chordPart.slice(chordNote.length);
    const chordVar  = VAR_IV[suffix] !== undefined ? suffix : (variant || '');
    const slashShapes = getSlashGuitarShapes(chordNote, quality, chordVar, bassNote);
    if (slashShapes.length > 0) {
      return slashShapes.sort((a, b) => minActiveFret(a) - minActiveFret(b));
    }
    // 슬래시 운지 없으면 상위 코드 운지로 폴백
    return getGuitarShapes(chordPart || chordNote, chordNote, quality, chordVar);
  }
  // 1) curated 데이터 조회
  let curated = null;
  if (name && CHORD_POSITIONS[name]) {
    curated = [...CHORD_POSITIONS[name]];
  } else {
    const variantKey = variant ? note + variant : (quality === 'min' ? note + 'm' : note);
    if (CHORD_POSITIONS[variantKey]) curated = [...CHORD_POSITIONS[variantKey]];
  }

  // 2) CAGED 기반 포지션 계산
  const shapeVar = normalizeVariantForShape(variant, quality);
  const noteIdx  = ki(note);
  const cagedPositions = [];

  if (noteIdx >= 0) {
    const eFret = (noteIdx - 4 + 12) % 12;
    const aFret = (noteIdx - 9 + 12) % 12;

    const ef = E_FORM[shapeVar];
    if (ef) {
      const frets   = ef.offsets.map(o => o === -1 ? -1 : eFret + o);
      const fingers = eFret === 0 ? ef.fingersOpen : ef.fingersBar;
      const pos     = eFret === 0 ? '오픈 (E형)' : `E형 ${eFret}프렛`;
      cagedPositions.push({ frets, fingers, pos });
    }

    const af = A_FORM[shapeVar];
    if (af) {
      const frets   = af.offsets.map(o => o === -1 ? -1 : aFret + o);
      const fingers = aFret === 0 ? af.fingersOpen : af.fingersBar;
      const pos     = aFret === 0 ? '오픈 (A형)' : `A형 ${aFret}프렛`;
      cagedPositions.push({ frets, fingers, pos });
    }
  }

  // 3) curated가 없으면 CAGED 사용, curated가 2개 미만이면 CAGED로 보완
  let result = curated || [];

  if (result.length < 2) {
    for (const cp of cagedPositions) {
      if (result.length >= 3) break;
      if (!result.some(r => sameShape(r, cp))) {
        result = [...result, cp];
      }
    }
  }

  // 4) fallback: 기본 코드 운지
  if (!result.length) {
    const baseKey = quality === 'min' ? note + 'm' : note;
    result = CHORD_POSITIONS[baseKey] || CHORD_POSITIONS[note] || [];
  }

  // 5) 낮은 프렛 순 정렬 (오픈 포지션 최우선)
  return [...result].sort((a, b) => minActiveFret(a) - minActiveFret(b));
}
