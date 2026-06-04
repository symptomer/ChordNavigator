// ── 코드 네비게이터 하네스 검증 스크립트 ──────────────────────────────
// Node.js로 실행: node harness.js
// musicData.js와 같은 폴더에 두고 실행

// ── 데이터 인라인 (import 대신) ───────────────────────────────────────
const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const VAR_IV = {
  '':     [0,4,7],
  'maj7': [0,4,7,11],
  'maj9': [0,4,7,11,14],
  '7':    [0,4,7,10],
  '9':    [0,4,7,10,14],
  '13':   [0,4,7,10,14,21],
  'add9': [0,4,7,14],
  'sus4': [0,5,7],
  'sus2': [0,2,7],
  '6':    [0,4,7,9],
  'm':    [0,3,7],
  'm7':   [0,3,7,10],
  'm9':   [0,3,7,10,14],
  'm11':  [0,3,7,10,14,17],
  'm6':   [0,3,7,9],
  'mMaj7':[0,3,7,11],
  '°':    [0,3,6],
  '°7':   [0,3,6,9],
  'ø7':   [0,3,6,10],
};

// musicData.js에서 CHORD_POSITIONS를 동적으로 읽기
const fs = require('fs');
const raw = fs.readFileSync('./musicData.js', 'utf8');

// export const 제거하고 eval 가능하게 변환
const jsCode = raw
  .replace(/export const /g, 'const ')
  .replace(/export default /g, 'const _default = ');

// CHORD_POSITIONS만 추출하는 간단한 방법: 전체 실행 후 참조
const { CHORD_POSITIONS } = (() => {
  const module = {};
  try {
    eval(jsCode + '\nmodule.CHORD_POSITIONS = CHORD_POSITIONS;');
  } catch(e) {
    // 컬러 상수 등 undefined 참조 무시하고 재시도
    const safe = jsCode.replace(/COLORS\.[a-z]+/g, '"#000"');
    eval(safe + '\nmodule.CHORD_POSITIONS = CHORD_POSITIONS;');
  }
  return module;
})();

// ── 헬퍼 ────────────────────────────────────────────────────────────────
const OPEN_PCS = [4, 9, 2, 7, 11, 4]; // E A D G B e 개방현 피치클래스

function ki(note) { return NOTES.indexOf(note); }

// 코드명 → { note, variant } 파싱
function parseChordName(name) {
  const m = name.match(/^([A-G][b#]?)(.*?)$/);
  if (!m) return null;
  let note = m[1];
  // flat → sharp
  const F2S = { Bb:'A#', Eb:'D#', Ab:'G#', Db:'C#', Gb:'F#' };
  if (F2S[note]) note = F2S[note];
  const variant = m[2].replace('m7b5','ø7'); // 별칭 처리
  return { note, variant };
}

// 구성 피치클래스 계산
function getExpectedPCs(note, variant) {
  const ivs = VAR_IV[variant] ?? VAR_IV[''];
  const r = ki(note);
  if (r < 0) return null;
  return [...new Set(ivs.map(iv => (r + iv) % 12))];
}

// 기타 운지 → 실제 피치클래스 배열
function fretsToPCs(frets) {
  return frets
    .map((f, s) => f < 0 ? null : (OPEN_PCS[s] + f) % 12)
    .filter(pc => pc !== null);
}

// ── 검증 1: 기타 운지 구성음 확인 ────────────────────────────────────
const errors = [];
const warnings = [];

for (const [chordKey, positions] of Object.entries(CHORD_POSITIONS)) {
  const parsed = parseChordName(chordKey);
  if (!parsed) { warnings.push(`파싱 실패: ${chordKey}`); continue; }
  
  const { note, variant } = parsed;
  const expected = getExpectedPCs(note, variant);
  if (!expected) { warnings.push(`구성음 계산 실패: ${chordKey}`); continue; }

  positions.forEach((pos, idx) => {
    const actual = fretsToPCs(pos.frets);
    const actualSet = new Set(actual);

    // 검증 A: 기대 구성음이 모두 포함되는가?
    const missing = expected.filter(pc => !actualSet.has(pc));
    if (missing.length > 0) {
      const missingNotes = missing.map(pc => NOTES[pc]);
      errors.push({
        type: '구성음 누락',
        chord: chordKey,
        pos: pos.pos || `폼${idx+1}`,
        frets: pos.frets.join(','),
        expected: expected.map(pc => NOTES[pc]).join(' '),
        actual: [...new Set(actual)].map(pc => NOTES[pc]).join(' '),
        issue: `누락: ${missingNotes.join(', ')}`,
      });
    }

    // 검증 B: 운지 불가능한 스팬 (5프렛 초과, 뮤트 제외)
    const activeFrets = pos.frets.filter(f => f > 0);
    if (activeFrets.length > 1) {
      const span = Math.max(...activeFrets) - Math.min(...activeFrets);
      if (span > 4) {
        errors.push({
          type: '스팬 초과',
          chord: chordKey,
          pos: pos.pos || `폼${idx+1}`,
          frets: pos.frets.join(','),
          expected: '스팬 ≤ 4',
          actual: `스팬 = ${span}`,
          issue: `프렛 스팬 ${span} (연주 불가 가능성)`,
        });
      }
    }

    // 검증 C: 이물질 음 (구성음이 아닌 음이 포함되는가)
    const foreign = actual.filter(pc => !expected.includes(pc));
    if (foreign.length > 0) {
      const foreignNotes = foreign.map(pc => NOTES[pc]);
      warnings.push({
        type: '이물질 음',
        chord: chordKey,
        pos: pos.pos || `폼${idx+1}`,
        frets: pos.frets.join(','),
        expected: expected.map(pc => NOTES[pc]).join(' '),
        actual: [...new Set(actual)].map(pc => NOTES[pc]).join(' '),
        issue: `비구성음: ${foreignNotes.join(', ')}`,
      });
    }
  });
}

// ── 검증 2: 피아노 전위 구성음 확인 ────────────────────────────────────
// WHITE_ST: 반음 위치
const WHITE_ST = [0,2,4,5,7,9,11,12,14,16,17,19,21,23];
const BLACK_ST = [1,3,6,8,10,13,15,18,20,22];
const ALL_ST   = [...WHITE_ST,...BLACK_ST].sort((a,b)=>a-b);

function placeAbove(pcs, minSt) {
  const sorted = [...new Set(pcs)].sort((a,b)=>a-b);
  if (!sorted.length) return [];
  let best = null, bestScore = Infinity;
  for (let start = 0; start < sorted.length; start++) {
    const arr = []; let cur = minSt, ok = true;
    for (let i = 0; i < sorted.length; i++) {
      let pos = sorted[(start+i) % sorted.length];
      while (pos <= cur) pos += 12;
      if (pos > 23) { ok = false; break; }
      arr.push(pos); cur = pos;
    }
    if (!ok || !arr.length) continue;
    const canShift = arr[arr.length-1]+12 <= 23;
    const candidate = (arr[0] < 12 && canShift) ? arr.map(p=>p+12) : arr;
    if (candidate[candidate.length-1] > 23) continue;
    const span  = candidate[candidate.length-1] - candidate[0];
    const score = (candidate[0] < 12 ? 50 : 0) + span;
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  return best || [];
}

function getInversionKeys(rootSt, intervals, inversion) {
  if (!intervals?.length) return [];
  const pcs = [...new Set(intervals.map(iv => (rootSt+iv) % 12))];
  const n = pcs.length;
  const inv = Math.min(inversion, n-1);
  const bassPc = pcs[inv];
  const result = [{ semitone: bassPc, hand: 'L' }];
  const rhPcs = n >= 5
    ? pcs.filter(pc => pc !== (rootSt+7)%12 && pc !== bassPc)
    : pcs.filter(pc => pc !== bassPc);
  if (rhPcs.length) {
    for (const pos of placeAbove(rhPcs, bassPc))
      result.push({ semitone: pos, hand: 'R' });
  }
  if (n <= 3 && result.filter(k=>k.hand==='R').length < 3) {
    const rhKeys = result.filter(k=>k.hand==='R');
    const maxRhSt = rhKeys.length ? Math.max(...rhKeys.map(k=>k.semitone)) : bassPc;
    let rd = bassPc;
    while (rd <= maxRhSt) rd += 12;
    if (rd > 23) rd -= 12;
    if (rd > bassPc && rd <= 23 && !result.find(k=>k.semitone===rd))
      result.push({ semitone: rd, hand: 'R' });
  }
  return result;
}

// 피아노 검증: 전위 0/1/2 각각에서 구성음이 표시되는가
for (const [chordKey, _] of Object.entries(CHORD_POSITIONS)) {
  const parsed = parseChordName(chordKey);
  if (!parsed) continue;
  const { note, variant } = parsed;
  const ivs = VAR_IV[variant] ?? VAR_IV[''];
  const rootSt = ki(note);
  if (rootSt < 0) continue;
  const expectedPCs = [...new Set(ivs.map(iv => (rootSt+iv) % 12))];

  for (const inv of [0,1,2]) {
    const keys = getInversionKeys(rootSt, ivs, inv);
    if (!keys.length) continue;
    const displayedPCs = [...new Set(keys.map(k => k.semitone % 12))];
    const missing = expectedPCs.filter(pc => !displayedPCs.includes(pc));

    // 4화음 이상에서 5도 생략은 의도적이므로 제외
    const is5th = (pc) => pc === (rootSt+7) % 12;
    const realMissing = missing.filter(pc => !(ivs.length >= 4 && is5th(pc)));

    if (realMissing.length > 0) {
      errors.push({
        type: '피아노 구성음 누락',
        chord: chordKey,
        pos: `피아노 ${inv}전위`,
        frets: '-',
        expected: expectedPCs.map(pc=>NOTES[pc]).join(' '),
        actual: displayedPCs.map(pc=>NOTES[pc]).join(' '),
        issue: `누락: ${realMissing.map(pc=>NOTES[pc]).join(', ')}`,
      });
    }
  }
}

// ── 결과 출력 ────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log('  코드 네비게이터 하네스 검증 결과');
console.log('══════════════════════════════════════════\n');

console.log(`✅ 검증 완료: ${Object.keys(CHORD_POSITIONS).length}개 코드`);
console.log(`❌ 오류: ${errors.length}개`);
console.log(`⚠️  경고 (이물질음): ${typeof warnings[0]==='object' ? warnings.filter(w=>typeof w==='object').length : 0}개\n`);

if (errors.length > 0) {
  console.log('── ❌ 오류 목록 ──────────────────────────────────');
  // 타입별 그룹화
  const byType = {};
  errors.forEach(e => {
    if (!byType[e.type]) byType[e.type] = [];
    byType[e.type].push(e);
  });

  for (const [type, list] of Object.entries(byType)) {
    console.log(`\n[${type}] ${list.length}건`);
    list.forEach(e => {
      console.log(`  • ${e.chord} (${e.pos})`);
      console.log(`    프렛: [${e.frets}]`);
      console.log(`    기댓값: ${e.expected}`);
      console.log(`    실제값: ${e.actual}`);
      console.log(`    → ${e.issue}`);
    });
  }
}

const objWarnings = warnings.filter(w=>typeof w==='object');
if (objWarnings.length > 0) {
  console.log('\n── ⚠️  경고 (비구성음 포함) ─────────────────────');
  objWarnings.slice(0, 20).forEach(w => {
    console.log(`  • ${w.chord} (${w.pos}): ${w.issue}`);
  });
  if (objWarnings.length > 20) console.log(`  ... 외 ${objWarnings.length-20}건`);
}

console.log('\n══════════════════════════════════════════\n');
