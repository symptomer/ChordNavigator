import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, NOTES } from '../data/musicData';
import { ki } from '../utils/musicUtils';

const W = 300, H = 150;

// 14 white keys: C D E F G A B C D E F G A B (2 octaves, semitones 0-23)
const WHITE_NOTES = ['C','D','E','F','G','A','B','C','D','E','F','G','A','B'];
const WHITE_ST    = [ 0,  2,  4,  5,  7,  9, 11, 12, 14, 16, 17, 19, 21, 23];
const BLACK_DEFS  = [
  { note:'C#', st:1,  after:0  },
  { note:'D#', st:3,  after:1  },
  { note:'F#', st:6,  after:3  },
  { note:'G#', st:8,  after:4  },
  { note:'A#', st:10, after:5  },
  { note:'C#', st:13, after:7  },
  { note:'D#', st:15, after:8  },
  { note:'F#', st:18, after:10 },
  { note:'G#', st:20, after:11 },
  { note:'A#', st:22, after:12 },
];

const N  = WHITE_NOTES.length;
const WW = Math.floor((W - 10) / N);
const WH = 88, BH = 55;
const SX = (W - N * WW) / 2;
const SY = 30;

// flat → sharp 변환 (ki가 sharp만 지원하므로)
const FLAT_TO_SHARP = { Bb:'A#', Eb:'D#', Ab:'G#', Db:'C#', Gb:'F#', Cb:'B', Fb:'E' };
function toSharp(note) { return FLAT_TO_SHARP[note] || note; }

// ── 핵심 배치 함수 ────────────────────────────────────────────────────────
// pcs: 배치할 pitch class 배열, minSt: 이 값보다 큰 위치에 배치
// 상위 옥타브(12-23) 우선, 스팬 최소화
function placeAbove(pcs, minSt) {
  const sorted = [...new Set(pcs)].sort((a, b) => a - b);
  if (!sorted.length) return [];

  let best = null, bestScore = Infinity;

  for (let start = 0; start < sorted.length; start++) {
    const arr = [];
    let cur = minSt;
    let ok  = true;
    for (let i = 0; i < sorted.length; i++) {
      let pos = sorted[(start + i) % sorted.length];
      while (pos <= cur) pos += 12;
      if (pos > 23) { ok = false; break; }
      arr.push(pos);
      cur = pos;
    }
    if (!ok || !arr.length) continue;

    // 상위 옥타브로 올릴 수 있으면 올리기
    const canShift = arr[arr.length - 1] + 12 <= 23;
    const candidate = (arr[0] < 12 && canShift) ? arr.map(p => p + 12) : arr;
    if (candidate[candidate.length - 1] > 23) continue;

    // 점수: 하위 옥타브 시작 시 페널티, 스팬 최소화
    const span  = candidate[candidate.length - 1] - candidate[0];
    const score = (candidate[0] < 12 ? 50 : 0) + span;
    if (score < bestScore) { bestScore = score; best = candidate; }
  }

  return best || [];
}

// ── 일반 코드 / 전위 ──────────────────────────────────────────────────────
// inversion 0 = 루트, 1 = 1전위(3음 베이스), 2 = 2전위(5음 베이스)
// 규칙: LH = 베이스 1개 | RH = 나머지 음들 (4화음: 정확히 3개)
function getInversionKeys(rootSt, intervals, inversion) {
  if (!intervals || !intervals.length) return [];
  const pcs = [...new Set(intervals.map(iv => (rootSt + iv) % 12))];
  const n   = pcs.length;
  const inv = Math.min(inversion, n - 1);
  const bassPc = pcs[inv];

  // LH: 베이스음 (낮은 옥타브, 0-11)
  const result = [{ semitone: bassPc, isRoot: bassPc === rootSt, hand: 'L' }];

  // RH 음 선택 — 5음 이상은 5도 생략 rootless 보이싱
  const rhPcs = n >= 5
    ? pcs.filter(pc => pc !== (rootSt + 7) % 12 && pc !== bassPc)
    : pcs.filter(pc => pc !== bassPc);

  // RH 배치: bassPc 위, 상위 옥타브 우선
  if (rhPcs.length) {
    for (const pos of placeAbove(rhPcs, bassPc)) {
      result.push({ semitone: pos, isRoot: pos % 12 === rootSt, hand: 'R' });
    }
  }

  // 트라이어드(3음): RH 3음 보장 — 베이스음(전위음) 옥타브 더블링
  // 루트포지션: C 더블링 / 1전위: 3음(E) 더블링 / 2전위: 5음(G) 더블링
  if (n <= 3 && result.filter(k => k.hand === 'R').length < 3) {
    const rhKeys  = result.filter(k => k.hand === 'R');
    const maxRhSt = rhKeys.length ? Math.max(...rhKeys.map(k => k.semitone)) : bassPc;
    let rd = bassPc;  // 베이스음 옥타브 위로
    while (rd <= maxRhSt) rd += 12;
    if (rd > 23) rd -= 12;
    if (rd > bassPc && rd <= 23 && !result.find(k => k.semitone === rd))
      result.push({ semitone: rd, isRoot: rd % 12 === rootSt, hand: 'R' });
  }

  return result;
}

// ── 슬래시 코드 ───────────────────────────────────────────────────────────
// LH = 지정 베이스음 (고정) | RH = 상위코드 보이싱 (inversion에 따라 전위)
// inversion 0 = 루트 포지션, 1 = 1전위(3음 최저), 2 = 2전위(5음 최저)
function getSlashBassKeys(rootSt, intervals, bassNoteName, inversion = 0) {
  if (!intervals || !intervals.length) return [];
  const bassSt = ki(toSharp(bassNoteName));
  if (bassSt < 0) return getInversionKeys(rootSt, intervals, 0);

  // 상위코드 pcs (intervals 정의 순서 유지 = [root, 3rd, 5th, ...])
  const pcsInOrder = [...new Set(intervals.map(iv => (rootSt + iv) % 12))];
  const n = pcsInOrder.length;

  // LH: 지정 베이스음 (전위와 무관하게 고정)
  const result = [{ semitone: bassSt, isRoot: bassSt % 12 === rootSt, hand: 'L' }];

  // RH: 베이스 pc가 코드톤에 있으면 제외, 없으면 전체 사용 (외부 베이스)
  const rhPcs = pcsInOrder.filter(pc => pc !== bassSt % 12);
  const toPlace = rhPcs.length ? rhPcs : [...pcsInOrder];
  const m = toPlace.length;
  const inv = Math.min(inversion, m - 1);

  // inv-th pc부터 RH 배치 (순환): inv=0→루트, inv=1→3음, inv=2→5음 최저
  const rhKeys = [];
  let cur = bassSt;
  let allPlaced = true;
  for (let i = 0; i < m; i++) {
    let pos = toPlace[(inv + i) % m];
    while (pos <= cur) pos += 12;
    if (pos > 23) { allPlaced = false; break; }
    rhKeys.push({ semitone: pos, isRoot: pos % 12 === rootSt, hand: 'R' });
    cur = pos;
  }

  // 순환 배치 실패 시 placeAbove로 폴백 (스팬 최소화, 상위 옥타브 선호)
  if (!allPlaced) {
    const placed = placeAbove(toPlace, bassSt);
    rhKeys.length = 0;
    placed.forEach(pos =>
      rhKeys.push({ semitone: pos, isRoot: pos % 12 === rootSt, hand: 'R' }));
  }

  // 전체 하위 옥타브에 있으면 한 옥타브 위로 이동 (상위 옥타브 선호)
  if (rhKeys.length > 0 && rhKeys[0].semitone < 12 &&
      rhKeys[rhKeys.length - 1].semitone + 12 <= 23) {
    rhKeys.forEach(k => { k.semitone += 12; });
  }

  result.push(...rhKeys);

  // 트라이어드(3음): RH 3음 보장 — 시작(전위)음 옥타브 더블링
  if (n <= 3 && result.filter(k => k.hand === 'R').length < 3) {
    const rhPart = result.filter(k => k.hand === 'R');
    const maxRhSt = rhPart.length ? Math.max(...rhPart.map(k => k.semitone)) : bassSt;
    const startPc = toPlace[inv % m];
    let rd = startPc;
    while (rd <= maxRhSt) rd += 12;
    if (rd > 23) rd -= 12;
    if (rd > bassSt && rd <= 23 && !result.find(k => k.semitone === rd))
      result.push({ semitone: rd, isRoot: rd % 12 === rootSt, hand: 'R' });
  }

  return result;
}

// ── 색상 ─────────────────────────────────────────────────────────────────
const LH_COLOR  = COLORS.blue;   // 왼손 베이스
const LH_BLACK  = '#2563c8';
const RH_ROOT   = COLORS.accent; // 오른손 루트음 (골드)
const RH_BLACK_ROOT = '#b8941e';
const RH_COLOR  = '#c8a840';     // 오른손 일반 코드톤
const RH_BLACK  = '#a8881e';

// ── 컴포넌트 ─────────────────────────────────────────────────────────────
// rootNote + chordIntervals: 전위/슬래시 코드 모드
// activeNotes Set: 스케일 모드
export default function PianoDiagram({ activeNotes, name, rootNote, chordIntervals, inversion = 0, slashBass }) {
  const isChordMode = !!(rootNote && chordIntervals && chordIntervals.length);

  let lhStSet   = new Set();
  let rhStSet   = new Set();
  let rootStSet = new Set(); // RH 중 루트음 (골드)

  if (isChordMode) {
    const rootSt = ki(rootNote);
    const keys = slashBass
      ? getSlashBassKeys(rootSt, chordIntervals, slashBass, inversion)
      : getInversionKeys(rootSt, chordIntervals, inversion);
    keys.forEach(k => {
      if (k.hand === 'L') lhStSet.add(k.semitone);
      else {
        rhStSet.add(k.semitone);
        if (k.isRoot) rootStSet.add(k.semitone);
      }
    });
  }

  function whiteFill(st) {
    if (!isChordMode) return activeNotes?.has(WHITE_NOTES[WHITE_ST.indexOf(st)]) ? RH_COLOR : '#e8e4d0';
    // 분수코드: 베이스음(LH)=골드(루트), 상위 루트=코드톤 / 일반: LH=파랑, 루트=골드
    if (lhStSet.has(st))   return slashBass ? RH_ROOT  : LH_COLOR;
    if (rootStSet.has(st)) return slashBass ? RH_COLOR : RH_ROOT;
    if (rhStSet.has(st))   return RH_COLOR;
    return '#e8e4d0';
  }
  function blackFill(st) {
    if (!isChordMode) return activeNotes?.has(BLACK_DEFS.find(b => b.st === st)?.note) ? RH_BLACK : '#222';
    if (lhStSet.has(st))   return slashBass ? RH_BLACK_ROOT : LH_BLACK;
    if (rootStSet.has(st)) return slashBass ? RH_BLACK      : RH_BLACK_ROOT;
    if (rhStSet.has(st))   return RH_BLACK;
    return '#222';
  }
  function isActive(st) {
    return isChordMode ? (lhStSet.has(st) || rhStSet.has(st)) : false;
  }

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <SvgText x={W / 2} y={14} textAnchor="middle" fill={COLORS.accent}
        fontSize={12} fontWeight="bold">{name}</SvgText>

      {/* 범례 */}
      {isChordMode && (slashBass ? (
        // 분수코드: 베이스(루트)=골드, 코드톤=갈색
        <>
          <Rect x={W/2 - 60} y={20} width={8} height={8} fill={RH_ROOT}  rx={1} />
          <SvgText x={W/2 - 48} y={27} fill={COLORS.text2} fontSize={8}>베이스(루트)</SvgText>
          <Rect x={W/2 + 40} y={20} width={8} height={8} fill={RH_COLOR} rx={1} />
          <SvgText x={W/2 + 52} y={27} fill={COLORS.text2} fontSize={8}>코드톤</SvgText>
        </>
      ) : (
        // 일반 코드: 왼손=파랑, 루트=골드, 코드톤=갈색
        <>
          <Rect x={W/2 - 80} y={20} width={8} height={8} fill={LH_COLOR} rx={1} />
          <SvgText x={W/2 - 68} y={27} fill={COLORS.text2} fontSize={8}>왼손(베이스)</SvgText>
          <Rect x={W/2 + 8}  y={20} width={8} height={8} fill={RH_ROOT}  rx={1} />
          <SvgText x={W/2 + 20} y={27} fill={COLORS.text2} fontSize={8}>루트</SvgText>
          <Rect x={W/2 + 48} y={20} width={8} height={8} fill={RH_COLOR} rx={1} />
          <SvgText x={W/2 + 60} y={27} fill={COLORS.text2} fontSize={8}>코드톤</SvgText>
        </>
      ))}

      {/* 흰 건반 */}
      {WHITE_ST.map((st, i) => {
        const note   = WHITE_NOTES[i];
        const active = isActive(st);
        const fill   = whiteFill(st);
        return (
          <React.Fragment key={i}>
            <Rect x={SX + i * WW} y={SY} width={WW - 1} height={WH}
              fill={fill} stroke="#888" strokeWidth={0.8} rx={2} />
            <SvgText
              x={SX + i * WW + WW / 2} y={SY + WH - 5}
              textAnchor="middle"
              fill={active ? '#111' : '#888'}
              fontSize={active ? 8 : 7}
              fontWeight={active ? 'bold' : 'normal'}>
              {note}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* 검은 건반 */}
      {BLACK_DEFS.map(({ note, st, after }, i) => {
        const active = isActive(st);
        const fill   = blackFill(st);
        return (
          <React.Fragment key={i}>
            <Rect x={SX + after * WW + WW - 7} y={SY} width={14} height={BH}
              fill={fill} stroke="#555" strokeWidth={0.5} rx={2} />
            {active && (
              <SvgText
                x={SX + after * WW + WW - 7 + 7} y={SY + BH - 5}
                textAnchor="middle"
                fill="#fff" fontSize={6} fontWeight="bold">
                {note}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
