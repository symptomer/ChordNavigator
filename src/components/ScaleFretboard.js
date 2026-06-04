import React from 'react';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { NOTES, COLORS } from '../data/musicData';
import { ki } from '../utils/musicUtils';

// GuitarDiagram과 동일 방향: 줄=가로선, 프렛=세로선
// 저음 E(index 0) = 하단, 고음 e(index 5) = 상단
const W = 340, H = 134;
const LEFT = 30;      // string 레이블 + 개방음 공간
const TOP  = 18;      // 프렛 번호 공간
const GW   = 288;     // 프렛 영역 너비 (12프렛)
const GH   = 80;      // 6줄 영역 높이
const FRET_COUNT = 12;
const DX = GW / FRET_COUNT;  // 프렛 간격 ~24
const DY = GH / 5;           // 줄 간격 16

// EADGBE 표준 튜닝 (GuitarDiagram OPEN_PITCH와 동일)
const OPEN_PITCH  = [4, 9, 2, 7, 11, 4];
const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];
const MARKER_FRETS  = [3, 5, 7, 9, 12];

// string index 0(E) = 하단, 5(e) = 상단
const stringY = i => TOP + GH - i * DY;
// 프렛 중앙 x
const fretCX  = f => LEFT + (f - 0.5) * DX;

export default function ScaleFretboard({ scaleKey, intervals }) {
  if (!scaleKey || !intervals) return null;

  const root  = ki(scaleKey);
  const scSet = new Set(intervals.map(iv => (root + iv) % 12));

  const dots = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= FRET_COUNT; f++) {
      const ni = (OPEN_PITCH[s] + f) % 12;
      if (!scSet.has(ni)) continue;
      const x    = f === 0 ? LEFT - 14 : fretCX(f);
      const y    = stringY(s);
      const isR  = ni === root % 12;
      dots.push({ x, y, isR, note: NOTES[ni] });
    }
  }

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 프렛 마커 (배경 점) */}
      {MARKER_FRETS.map(f => {
        const cx = fretCX(f);
        const cy = TOP + GH / 2;
        return f === 12 ? (
          <React.Fragment key={`mk${f}`}>
            <Circle cx={cx} cy={cy - GH / 4} r={3} fill={COLORS.border} opacity={0.5} />
            <Circle cx={cx} cy={cy + GH / 4} r={3} fill={COLORS.border} opacity={0.5} />
          </React.Fragment>
        ) : (
          <Circle key={`mk${f}`} cx={cx} cy={cy} r={3} fill={COLORS.border} opacity={0.5} />
        );
      })}

      {/* 6줄 (가로선) — index 0(E저음)=하단, 5(e고음)=상단 */}
      {[0,1,2,3,4,5].map(i => (
        <Line key={`str${i}`}
          x1={LEFT} y1={stringY(i)} x2={LEFT + GW} y2={stringY(i)}
          stroke={COLORS.border} strokeWidth={i === 0 ? 2 : 1} />
      ))}

      {/* 너트 + 프렛선 (세로선) */}
      {Array.from({ length: FRET_COUNT + 1 }, (_, f) => (
        <Line key={`fret${f}`}
          x1={LEFT + f * DX} y1={TOP}
          x2={LEFT + f * DX} y2={TOP + GH}
          stroke={f === 0 ? COLORS.text : COLORS.border}
          strokeWidth={f === 0 ? 3 : 1} />
      ))}

      {/* 프렛 번호 */}
      {MARKER_FRETS.map(f => (
        <SvgText key={`fn${f}`}
          x={fretCX(f)} y={TOP + GH + 12}
          textAnchor="middle" fill={COLORS.text2} fontSize={8}>
          {f}
        </SvgText>
      ))}

      {/* 줄 레이블 (왼쪽) */}
      {STRING_LABELS.map((s, i) => (
        <SvgText key={`sl${i}`}
          x={LEFT - 24} y={stringY(i)}
          textAnchor="middle" dominantBaseline="middle"
          fill={COLORS.text2} fontSize={8}>
          {s}
        </SvgText>
      ))}

      {/* 스케일 음표 */}
      {dots.map((d, idx) => (
        <React.Fragment key={idx}>
          <Circle cx={d.x} cy={d.y} r={7}
            fill={d.isR ? COLORS.purple : COLORS.accent} />
          <SvgText x={d.x} y={d.y}
            textAnchor="middle" dominantBaseline="middle"
            fill="#111" fontSize={6} fontWeight="bold">
            {d.note}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}
