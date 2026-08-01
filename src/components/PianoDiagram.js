import React from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { COLORS, NOTES } from '../data/musicData';
import { ki, flatNote, getInversionKeys, getSlashBassKeys } from '../utils/musicUtils';
import { useApp } from '../context/AppContext';
import { t } from '../i18n';
import { DIAGRAM_SCALE } from '../utils/layout';

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
export default function PianoDiagram({ activeNotes, name, rootNote, chordIntervals, inversion = 0, slashBass, voicedKeys }) {
  const { activeKey, selMode } = useApp();
  const fn = (n) => (n ? flatNote(n, activeKey, selMode) : n); // 표시용 플랫 변환 (검은건반 A#→Bb 등)
  const hasVoiced = !!(voicedKeys && voicedKeys.length);
  const isChordMode = hasVoiced || !!(rootNote && chordIntervals && chordIntervals.length);

  let lhStSet   = new Set();
  let rhStSet   = new Set();
  let rootStSet = new Set(); // RH 중 루트음 (현재 색 구분 없음)

  if (isChordMode) {
    // 기법 보이스리딩 운지(voicedKeys)가 있으면 그대로, 아니면 코드에서 계산
    const keys = hasVoiced
      ? voicedKeys
      : (slashBass
          ? getSlashBassKeys(ki(rootNote), chordIntervals, slashBass, inversion)
          : getInversionKeys(ki(rootNote), chordIntervals, inversion));
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
    // 왼손 베이스=파랑, 오른손 코드톤(루트 포함)=노랑 (루트/코드톤 색 구분 제거)
    if (lhStSet.has(st)) return LH_COLOR;
    if (rhStSet.has(st)) return RH_COLOR;
    return '#e8e4d0';
  }
  function blackFill(st) {
    if (!isChordMode) return activeNotes?.has(BLACK_DEFS.find(b => b.st === st)?.note) ? RH_BLACK : '#222';
    if (lhStSet.has(st)) return LH_BLACK;
    if (rhStSet.has(st)) return RH_BLACK;
    return '#222';
  }
  function isActive(st) {
    return isChordMode ? (lhStSet.has(st) || rhStSet.has(st)) : false;
  }

  return (
    <Svg width={W * DIAGRAM_SCALE} height={H * DIAGRAM_SCALE} viewBox={`0 0 ${W} ${H}`}>
      <SvgText x={W / 2} y={14} textAnchor="middle" fill={COLORS.accent}
        fontSize={12} fontWeight="bold">{name}</SvgText>

      {/* 범례 — 왼손(베이스)=파랑, 코드톤=노랑 */}
      {isChordMode && (
        <>
          <Rect x={W/2 - 56} y={20} width={8} height={8} fill={LH_COLOR} rx={1} />
          <SvgText x={W/2 - 44} y={27} fill={COLORS.text2} fontSize={8}>{t('leftHandBass')}</SvgText>
          <Rect x={W/2 + 28} y={20} width={8} height={8} fill={RH_COLOR} rx={1} />
          <SvgText x={W/2 + 40} y={27} fill={COLORS.text2} fontSize={8}>{t('chordTones')}</SvgText>
        </>
      )}

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
                {fn(note)}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
