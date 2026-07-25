import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, NOTES } from '../data/musicData';
import { getChordTones, flatNote } from '../utils/musicUtils';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';

// 가로 방향 기타 다이어그램
// 저음 E줄 = 하단, 고음 e줄 = 상단
// 프렛 = 세로선 (왼쪽→오른쪽)

const W = 300, H = 195;
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

const FLAT_TO_SHARP = { Bb:'A#', Eb:'D#', Ab:'G#', Db:'C#', Gb:'F#', Cb:'B', Fb:'E' };

// 코드명에서 variant 추출 (예: "C#m7" → "m7", "Bbmaj7" → "maj7", "C" → "")
function extractVariantFromName(name) {
  if (!name) return '';
  const chordPart = name.includes('/') ? name.split('/')[0] : name;
  const first2 = chordPart.slice(0, 2);
  if (FLAT_TO_SHARP[first2]) return chordPart.slice(2);
  if (chordPart.length > 1 && chordPart[1] === '#') return chordPart.slice(2);
  return chordPart.slice(1);
}

// 코드명에서 루트 노트 추출 (예: "Bbmaj7" → "A#", "Gm7" → "G")
function extractRoot(name) {
  if (!name) return null;
  const first2 = name.slice(0, 2);
  if (FLAT_TO_SHARP[first2]) return FLAT_TO_SHARP[first2];
  if (name.length > 1 && name[1] === '#') return name.slice(0, 2);
  return name[0];
}

// 베이스음 표기 → 내부 샵 표기 변환
function toSharpNote(note) {
  if (!note) return null;
  return FLAT_TO_SHARP[note] || note;
}

// 특정 줄+프렛의 음이름 반환
function getNoteAt(stringIdx, fret) {
  if (fret < 0) return null;
  return NOTES[(OPEN_PITCH[stringIdx] + fret) % 12];
}

export default function GuitarDiagram({ shape, name, displayName, posLabel, slashBass }) {
  const { activeKey, selMode } = useApp();
  const fn = (n) => (n ? flatNote(n, activeKey, selMode) : n); // 표시용 플랫 변환
  if (!shape) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('noFingeringData')}</Text>
      </View>
    );
  }

  const rootNote = extractRoot(name);
  const bassNote = toSharpNote(slashBass); // 베이스음 (슬래시 코드용, 파란색 표시)

  // 구성음 계산 (슬래시 코드면 코드 파트만)
  const variant = extractVariantFromName(name);
  const allChordTones = rootNote ? getChordTones(rootNote, variant) : [];
  const playedNotes = new Set(
    shape.frets.map((f, i) => f >= 0 ? getNoteAt(i, f) : null).filter(Boolean)
  );

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
        const isBass = bassNote && noteName === bassNote; // 슬래시 코드 베이스음

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
          // 오픈현 — 분수코드: 베이스음=골드(루트), 나머지=회색 / 일반: 루트=골드, 나머지=회색
          const isHighlight = slashBass ? isBass : isRoot;
          const openColor  = isHighlight ? '#c8a840' : COLORS.text2;
          const openWeight = isHighlight ? 'bold' : 'normal';
          return (
            <React.Fragment key={i}>
              <Circle cx={LEFT - 14} cy={y} r={8}
                fill={isHighlight ? '#c8a840' : 'none'}
                stroke={openColor} strokeWidth={isHighlight ? 2 : 1.5} />
              <SvgText x={LEFT - 14} y={y} textAnchor="middle"
                dominantBaseline="middle"
                fill={isHighlight ? '#111' : openColor}
                fontSize={noteName && noteName.length > 1 ? 6 : 8} fontWeight={openWeight}>
                {fn(noteName) || ''}
              </SvgText>
            </React.Fragment>
          );
        }
        // 프렛 도트 — 분수코드: 베이스음=골드(루트), 나머지=어두운 / 일반: 루트=골드, 나머지=어두운
        const isHighlight = slashBass ? isBass : isRoot;
        const x = LEFT + (f - startFret + 0.5) * DX;
        const dotFill  = isHighlight ? '#c8a840' : '#555';
        const textFill = isHighlight ? '#111'    : '#eee';
        const fontSize = noteName && noteName.length > 1 ? 7 : 9;
        return (
          <React.Fragment key={i}>
            <Circle cx={x} cy={y} r={9} fill={dotFill} />
            <SvgText x={x} y={y} textAnchor="middle"
              dominantBaseline="middle" fill={textFill}
              fontSize={fontSize} fontWeight="bold">
              {fn(noteName) || ''}
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

      {/* 구성음 표시줄: 골드=운지에 있음, 회색점선=생략된 구성음 */}
      {allChordTones.length > 0 && (() => {
        const ROW_Y = TOP + GH + 32;
        const spacing = Math.min(26, (W - LEFT - 20) / allChordTones.length);
        return (
          <>
            <SvgText x={LEFT} y={ROW_Y - 14} fill={COLORS.text2} fontSize={7}
              textAnchor="start">{t('chordTones')}</SvgText>
            {allChordTones.map((tone, idx) => {
              const present = playedNotes.has(tone);
              const cx = LEFT + 16 + idx * spacing;
              const fSize = tone.length > 1 ? 6 : 8;
              return (
                <React.Fragment key={tone + idx}>
                  <Circle cx={cx} cy={ROW_Y} r={9}
                    fill={present ? '#c8a840' : 'none'}
                    stroke={present ? '#c8a840' : '#666'}
                    strokeWidth={present ? 0 : 1.5}
                    strokeDasharray={present ? undefined : '3,2'} />
                  <SvgText x={cx} y={ROW_Y} textAnchor="middle"
                    dominantBaseline="middle"
                    fill={present ? '#111' : '#888'}
                    fontSize={fSize}
                    fontWeight={present ? 'bold' : 'normal'}>
                    {fn(tone)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </>
        );
      })()}
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty:     { alignItems: 'center', padding: 20 },
  emptyText: { color: COLORS.text2, fontSize: 12 },
});
