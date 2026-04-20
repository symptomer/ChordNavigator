import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, NOTES } from '../data/musicData';

// 가로 방향 기타 다이어그램
// 저음 E줄 = 하단, 고음 e줄 = 상단
// 프렛 = 세로선 (왼쪽→오른쪽)

const W = 300, H = 170;
const LEFT  = 36;  // 뮤트/오픈 심볼 공간
const TOP   = 30;  // 제목 공간
const GW    = 220; // 프렛 영역 너비 (4프렛)
const GH    = 90;  // 6줄 영역 높이
const DX    = GW / 4; // 프렛 간격
const DY    = GH / 5; // 줄 간격

// 각 개방현의 피치 (반음, 0=C): E A D G B e
const OPEN_PITCH = [4, 9, 2, 7, 11, 4];

// frets 배열: [E, A, D, G, B, e] — 인덱스 0=저음E(하단), 5=고음e(상단)
const STRING_LABELS = ['E','A','D','G','B','e'];

// 코드명에서 루트 노트 추출 (예: "Bbmaj7" → "A#", "Gm7" → "G")
function extractRoot(name) {
  if (!name) return null;
  // 플랫 표기를 샵으로 변환 (내부 NOTES 배열은 샵 기반)
  const FLAT_TO_SHARP = { Bb:'A#', Eb:'D#', Ab:'G#', Db:'C#', Gb:'F#' };
  const first2 = name.slice(0, 2);
  if (FLAT_TO_SHARP[first2]) return FLAT_TO_SHARP[first2];
  if (name.length > 1 && name[1] === '#') return name.slice(0, 2);
  return name[0];
}

// 특정 줄+프렛의 음이름 반환
function getNoteAt(stringIdx, fret) {
  if (fret < 0) return null;
  return NOTES[(OPEN_PITCH[stringIdx] + fret) % 12];
}

export default function GuitarDiagram({ shape, name, displayName, posLabel }) {
  if (!shape) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>운지 데이터 없음</Text>
      </View>
    );
  }

  const rootNote = extractRoot(name);

  const validFrets = shape.frets.filter(f => f > 0);
  const minFret    = validFrets.length ? Math.min(...validFrets) : 0;
  const startFret  = minFret > 2 ? minFret : 1; // 1 = open position

  // 줄 y좌표: 인덱스 0(E저음) = 하단, 5(e고음) = 상단
  const stringY = i => TOP + GH - i * DY;

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 제목 */}
      <SvgText x={W / 2} y={16} textAnchor="middle" fill={COLORS.accent}
        fontSize={12} fontWeight="bold">{displayName || name}</SvgText>
      {posLabel && (
        <SvgText x={W / 2} y={28} textAnchor="middle" fill={COLORS.text2} fontSize={9}>
          {posLabel}
        </SvgText>
      )}

      {/* 프렛 위치 표시 */}
      {startFret > 1 && (
        <SvgText x={LEFT + 2} y={TOP - 6} fill={COLORS.text2} fontSize={9} textAnchor="start">
          {startFret}fr
        </SvgText>
      )}

      {/* 6개 줄 (가로선) */}
      {[0,1,2,3,4,5].map(i => (
        <Line key={`str${i}`}
          x1={LEFT} y1={stringY(i)}
          x2={LEFT + GW} y2={stringY(i)}
          stroke={COLORS.border} strokeWidth={i === 0 ? 2 : 1} />
      ))}

      {/* 프렛선 (세로) — 5개 (nut + 4 frets) */}
      {[0,1,2,3,4].map(i => (
        <Line key={`fret${i}`}
          x1={LEFT + i * DX} y1={TOP}
          x2={LEFT + i * DX} y2={TOP + GH}
          stroke={i === 0 ? COLORS.text : COLORS.border}
          strokeWidth={i === 0 ? 3 : 1} />
      ))}

      {/* 오픈/뮤트/도트 */}
      {shape.frets.map((f, i) => {
        const y = stringY(i);
        const noteName = getNoteAt(i, f);
        const isRoot = noteName === rootNote;

        if (f === -1) {
          // 뮤트 X
          return (
            <SvgText key={i} x={LEFT - 14} y={y + 4}
              textAnchor="middle" fill={COLORS.red} fontSize={11} fontWeight="bold">
              ✕
            </SvgText>
          );
        }
        if (f === 0) {
          // 오픈현 — 음이름 표시
          const openColor = isRoot ? '#c8a840' : COLORS.text2;
          return (
            <React.Fragment key={i}>
              <Circle cx={LEFT - 14} cy={y} r={8}
                fill="none" stroke={openColor} strokeWidth={isRoot ? 2 : 1.5} />
              <SvgText x={LEFT - 14} y={y} textAnchor="middle"
                dominantBaseline="middle" fill={openColor}
                fontSize={noteName && noteName.length > 1 ? 6 : 8} fontWeight={isRoot ? 'bold' : 'normal'}>
                {noteName || ''}
              </SvgText>
            </React.Fragment>
          );
        }
        // 프렛 도트 — 음이름 표시
        const x = LEFT + (f - startFret + 0.5) * DX;
        const dotFill   = isRoot ? '#c8a840' : '#555';
        const textFill  = isRoot ? '#111'    : '#eee';
        const fontSize  = noteName && noteName.length > 1 ? 7 : 9;
        return (
          <React.Fragment key={i}>
            <Circle cx={x} cy={y} r={9} fill={dotFill} />
            <SvgText x={x} y={y} textAnchor="middle"
              dominantBaseline="middle" fill={textFill}
              fontSize={fontSize} fontWeight="bold">
              {noteName || ''}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* 줄 이름 (오른쪽) */}
      {STRING_LABELS.map((s, i) => (
        <SvgText key={`lbl${i}`}
          x={LEFT + GW + 10} y={stringY(i) + 4}
          fill={COLORS.text2} fontSize={9} textAnchor="start">
          {s}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty:     { alignItems: 'center', padding: 20 },
  emptyText: { color: COLORS.text2, fontSize: 12 },
});
