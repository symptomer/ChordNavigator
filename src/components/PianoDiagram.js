import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../data/musicData';
import { ki } from '../utils/musicUtils';

const W = 300, H = 150;

// 14 white keys: C D E F G A B C D E F G A B (2 octaves, 0-23 semitones)
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

const N   = WHITE_NOTES.length;
const WW  = Math.floor((W - 10) / N);
const WH  = 88, BH = 55;
const SX  = (W - N * WW) / 2;
const SY  = 30;

// 음 묶음 회전 중 스팬 최소인 배치 찾기 (오름차순 위치 반환)
function compactArrangement(pcs) {
  if (!pcs.length) return [];
  const sorted = [...new Set(pcs)].sort((a, b) => a - b);
  let best = null, bestSpan = Infinity;
  for (let start = 0; start < sorted.length; start++) {
    const arr = [];
    let prev = -Infinity;
    for (let i = 0; i < sorted.length; i++) {
      let pos = sorted[(start + i) % sorted.length];
      while (pos <= prev) pos += 12;
      arr.push(pos);
      prev = pos;
    }
    const span = arr[arr.length - 1] - arr[0];
    if (span < bestSpan) { bestSpan = span; best = arr; }
  }
  return best;
}

// 양손 운지 계산: LH(왼손) = 베이스 1음, RH(오른손) = 나머지 (1옥타브 내 클로즈)
// - 3~4음: RH는 베이스 외 모든 음
// - 5음 이상 (9, 11, 13, m9, m11): RH는 5도 생략한 rootless 보이싱
function getInversionKeys(rootSt, intervals, inversion) {
  if (!intervals || !intervals.length) return [];
  const pcs = [...new Set(intervals.map(iv => (rootSt + iv) % 12))];
  const n   = pcs.length;
  const inv = Math.min(inversion, n - 1);
  const bassPc = pcs[inv];

  // LH = 베이스 (낮은 옥타브)
  const result = [{ semitone: bassPc, isRoot: bassPc === rootSt, hand: 'L' }];

  // RH 음 선택
  let rhPcs;
  if (n >= 5) {
    const fifthPc = (rootSt + 7) % 12;
    rhPcs = pcs.filter(pc => pc !== fifthPc && pc !== bassPc);
  } else {
    rhPcs = pcs.filter(pc => pc !== bassPc);
  }
  if (!rhPcs.length) return result;

  // RH 컴팩트 배치
  const rhCompact = compactArrangement(rhPcs);

  // RH 옥타브 조정: 베이스 위 + 가능하면 2옥타브(>=12)에 배치 + 23 초과 방지
  let shift = 0;
  while (rhCompact[0] + shift <= bassPc) shift += 12;
  // 2옥타브로 올릴 수 있으면 올림
  while (rhCompact[0] + shift < 12 && rhCompact[rhCompact.length - 1] + shift + 12 <= 23) {
    shift += 12;
  }
  // 23 초과시 한 옥타브 내림 (베이스 위 유지)
  while (rhCompact[rhCompact.length - 1] + shift > 23 && rhCompact[0] + shift - 12 > bassPc) {
    shift -= 12;
  }

  for (const p of rhCompact) {
    const pos = p + shift;
    if (pos > 23 || pos <= bassPc) continue;
    result.push({ semitone: pos, isRoot: pos % 12 === rootSt, hand: 'R' });
  }
  return result;
}

// 손별 색상
const LH_COLOR    = COLORS.blue;     // 왼손 = 베이스
const LH_BLACK    = '#2563c8';
const RH_COLOR    = '#c8a840';       // 오른손 = 어퍼 (기존 골드)
const RH_BLACK    = '#a8881e';

// rootNote + chordIntervals 전달 시 전위 모드, activeNotes Set 전달 시 스케일 모드
export default function PianoDiagram({ activeNotes, name, rootNote, chordIntervals, inversion = 0 }) {
  const isChordMode = !!(rootNote && chordIntervals && chordIntervals.length);

  let lhStSet = new Set();
  let rhStSet = new Set();
  let rootStSet = new Set();
  if (isChordMode) {
    const rootSt = ki(rootNote);
    const keys   = getInversionKeys(rootSt, chordIntervals, inversion);
    keys.forEach(k => {
      (k.hand === 'L' ? lhStSet : rhStSet).add(k.semitone);
      if (k.isRoot) rootStSet.add(k.semitone);
    });
  }

  function whiteFill(st, note) {
    if (isChordMode) {
      if (lhStSet.has(st)) return LH_COLOR;
      if (rhStSet.has(st)) return RH_COLOR;
      return '#e8e4d0';
    }
    return activeNotes?.has(note) ? RH_COLOR : '#e8e4d0';
  }
  function blackFill(st, note) {
    if (isChordMode) {
      if (lhStSet.has(st)) return LH_BLACK;
      if (rhStSet.has(st)) return RH_BLACK;
      return '#222';
    }
    return activeNotes?.has(note) ? RH_BLACK : '#222';
  }
  function isActive(st, note) {
    return isChordMode ? (lhStSet.has(st) || rhStSet.has(st)) : activeNotes?.has(note);
  }

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <SvgText x={W / 2} y={14} textAnchor="middle" fill={COLORS.accent}
        fontSize={12} fontWeight="bold">{name}</SvgText>

      {/* 양손 범례 (코드 모드일 때) */}
      {isChordMode && (
        <>
          <Rect x={W/2 - 70} y={20} width={8} height={8} fill={LH_COLOR} rx={1} />
          <SvgText x={W/2 - 58} y={27} fill={COLORS.text2} fontSize={8}>왼손(베이스)</SvgText>
          <Rect x={W/2 + 8} y={20} width={8} height={8} fill={RH_COLOR} rx={1} />
          <SvgText x={W/2 + 20} y={27} fill={COLORS.text2} fontSize={8}>오른손</SvgText>
        </>
      )}

      {/* 흰 건반 */}
      {WHITE_NOTES.map((note, i) => {
        const st     = WHITE_ST[i];
        const active = isActive(st, note);
        return (
          <React.Fragment key={i}>
            <Rect x={SX + i * WW} y={SY} width={WW - 1} height={WH}
              fill={whiteFill(st, note)} stroke="#888" strokeWidth={0.8} rx={2} />
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
        const active = isActive(st, note);
        return (
          <React.Fragment key={i}>
            <Rect x={SX + after * WW + WW - 7} y={SY} width={14} height={BH}
              fill={blackFill(st, note)} stroke="#555" strokeWidth={0.5} rx={2} />
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
