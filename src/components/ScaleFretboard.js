import React from 'react';
import Svg, { Line, Circle, Text as SvgText } from 'react-native-svg';
import { NOTES, COLORS } from '../data/musicData';
import { ki } from '../utils/musicUtils';

const W = 280, H = 110;
const SX = 24, SY = 16, SW = 232, SH = 72;
const DX = SW / 5, DY = SH / 4;
const OPEN = [4, 11, 7, 2, 9, 4]; // E A D G B e (semitone from C)
const STRINGS = ['E','A','D','G','B','e'];

export default function ScaleFretboard({ scaleKey, intervals }) {
  if (!scaleKey || !intervals) return null;

  const r2    = ki(scaleKey);
  const scSet = new Set(intervals.map(iv => (r2 + iv) % 12));

  const dots = [];
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= 4; f++) {
      const ni = (OPEN[s] + f) % 12;
      if (!scSet.has(ni)) continue;
      const x    = SX + s * DX;
      const y    = f === 0 ? SY - 8 : SY + (f - 0.5) * DY;
      const isR  = ni === r2 % 12;
      dots.push({ x, y, isR, note: NOTES[ni] });
    }
  }

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Strings */}
      {[0,1,2,3,4,5].map(i => (
        <Line key={`s${i}`}
          x1={SX + i * DX} y1={SY} x2={SX + i * DX} y2={SY + SH}
          stroke={COLORS.border} strokeWidth={1} />
      ))}
      {/* Frets */}
      {[0,1,2,3,4].map(i => (
        <Line key={`f${i}`}
          x1={SX} y1={SY + i * DY} x2={SX + SW} y2={SY + i * DY}
          stroke={i === 0 ? COLORS.text : COLORS.border}
          strokeWidth={i === 0 ? 3 : 1} />
      ))}
      {/* Dots */}
      {dots.map((d, idx) => (
        <React.Fragment key={idx}>
          <Circle cx={d.x} cy={d.y} r={6}
            fill={d.isR ? COLORS.purple : COLORS.accent} />
          <SvgText x={d.x} y={d.y} textAnchor="middle"
            dominantBaseline="middle" fill="#111" fontSize={7} fontWeight="bold">
            {d.note}
          </SvgText>
        </React.Fragment>
      ))}
      {/* String labels */}
      {STRINGS.map((s, i) => (
        <SvgText key={`sl${i}`}
          x={SX + i * DX} y={SY + SH + 10}
          textAnchor="middle" fill={COLORS.text2} fontSize={8}>{s}</SvgText>
      ))}
    </Svg>
  );
}
