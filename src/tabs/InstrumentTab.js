import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, VAR_IV } from '../data/musicData';
import { getChordTones, ki, getVariantKey, getGuitarShapes, chordNameToNote, displayChordName, TO_FLAT, usesFlatDisplay, flatNote } from '../utils/musicUtils';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram  from '../components/PianoDiagram';

const GUITAR_POS_LABELS = ['오픈 / 1포지션', '2포지션', '3포지션'];
const PIANO_POS_LABELS  = ['루트 포지션', '1전위', '2전위'];

export default function InstrumentTab() {
  const { curChord, curVar, curInstr, setCurInstr, activeKey, selMode } = useApp();
  const [posIdx, setPosIdx] = useState(0);

  function getGuitarPositions() {
    if (!curChord) return [];
    return getGuitarShapes(curChord.name, curChord.note, curChord.quality, curVar);
  }

  function getChordIntervals() {
    if (!curChord) return [0, 4, 7];
    const vk = getVariantKey(curVar, curChord.quality);
    return VAR_IV[vk] || (curChord.quality === 'min' ? [0,3,7] : [0,4,7]);
  }

  const guitarPositions = getGuitarPositions();
  const maxPos          = curInstr === 'guitar'
    ? Math.max(guitarPositions.length - 1, 0)
    : 2;
  const clampedPos      = Math.min(posIdx, maxPos);

  const currentGuitarShape = guitarPositions[clampedPos] || null;
  const chordIntervals      = getChordIntervals();

  // 전위 가능한 수: intervals.length 에 따라 2전위까지 또는 1전위까지
  const maxInv = Math.min(2, chordIntervals.length - 1);

  // 슬래시 코드 처리
  const slashIdx   = curChord ? curChord.name.indexOf('/') : -1;
  const hasSlash   = slashIdx >= 0;
  const slashBass  = hasSlash ? curChord.name.slice(slashIdx + 1) : undefined;
  const chordPart  = hasSlash ? curChord.name.slice(0, slashIdx) : null;
  const pianoRoot  = curChord ? (hasSlash ? chordNameToNote(chordPart) : curChord.note) : null;
  const flatBass   = slashBass && usesFlatDisplay(activeKey, selMode)
    ? (TO_FLAT[slashBass] || slashBass) : slashBass;
  const displayName = curChord ? displayChordName(curChord.name, activeKey, selMode) : '';

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 20 }}>

      {/* 악기 선택 */}
      <View style={styles.instrRow}>
        {['guitar', 'piano'].map(instr => (
          <TouchableOpacity
            key={instr}
            style={[styles.itab, curInstr === instr && styles.itabSel]}
            onPress={() => { setCurInstr(instr); setPosIdx(0); }}>
            <Text style={[styles.itabText, curInstr === instr && styles.itabTextSel]}>
              {instr === 'guitar' ? '기타' : '피아노'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!curChord ? (
        <Text style={styles.hint}>코드 탭에서 코드를 먼저 선택하세요</Text>
      ) : (
        <>
          {/* 포지션 선택 버튼 */}
          <View style={styles.posRow}>
            {(curInstr === 'guitar' ? GUITAR_POS_LABELS : PIANO_POS_LABELS).map((label, i) => {
              const disabled = curInstr === 'piano' && i > maxInv;
              const isActive = clampedPos === i;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.posBtn,
                    isActive && styles.posBtnSel,
                    disabled && styles.posBtnDis,
                  ]}
                  onPress={() => !disabled && setPosIdx(i)}
                  disabled={disabled}>
                  <Text style={[styles.posBtnText, isActive && styles.posBtnTextSel,
                    disabled && styles.posBtnTextDis]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {curInstr === 'guitar' ? (
            <View style={styles.diagWrap}>
              {currentGuitarShape ? (
                <GuitarDiagram
                  shape={currentGuitarShape}
                  name={curChord.name}
                  displayName={displayName}
                  posLabel={currentGuitarShape.pos}
                  slashBass={slashBass}
                />
              ) : (
                <Text style={styles.hint}>운지 데이터 없음</Text>
              )}
            </View>
          ) : (
            <View style={styles.diagWrap}>
              <PianoDiagram
                name={displayName}
                rootNote={pianoRoot}
                chordIntervals={chordIntervals}
                inversion={clampedPos}
                slashBass={slashBass}
              />
              <Text style={styles.tonesText}>
                구성음: {getChordTones(pianoRoot, curVar, curChord.quality).map(n => flatNote(n, activeKey, selMode)).join(' · ')}
              </Text>
              <Text style={styles.invHint}>
                {hasSlash
                  ? `분수코드 — ${flatBass || slashBass}이(가) 최저음 (고정)`
                  : (clampedPos === 0 ? '루트 포지션 — 근음이 최저음'
                      : clampedPos === 1 ? '1전위 — 3음이 최저음'
                      : '2전위 — 5음이 최저음')}
              </Text>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap:            { flex: 1, backgroundColor: COLORS.bg },
  instrRow:        { flexDirection: 'row', gap: 6, marginBottom: 14 },
  itab:            { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card },
  itabSel:         { borderColor: COLORS.accent, backgroundColor: COLORS.bg3 },
  itabText:        { fontSize: 13, color: COLORS.text2 },
  itabTextSel:     { color: COLORS.accent },
  hint:            { color: COLORS.text2, fontSize: 12, textAlign: 'center', marginTop: 30 },
  posRow:          { flexDirection: 'row', gap: 5, marginBottom: 14 },
  posBtn:          { flex: 1, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card, alignItems: 'center' },
  posBtnSel:       { borderColor: COLORS.accent, backgroundColor: 'rgba(232,196,106,0.12)' },
  posBtnDis:       { opacity: 0.35 },
  posBtnText:      { fontSize: 11, color: COLORS.text2, textAlign: 'center' },
  posBtnTextSel:   { color: COLORS.accent, fontWeight: '700' },
  posBtnTextDis:   { color: COLORS.border },
  diagWrap:        { alignItems: 'center' },
  tonesText:       { fontSize: 11, color: COLORS.text2, marginTop: 8, textAlign: 'center' },
  invHint:         { fontSize: 10, color: COLORS.text2, marginTop: 4, textAlign: 'center', letterSpacing: 0.5 },
});
