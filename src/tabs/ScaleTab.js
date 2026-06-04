import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, SCALE_MODES, NOTES, MAJ_IV, MIN_IV, MAJ_Q, MIN_Q } from '../data/musicData';
import { ki } from '../utils/musicUtils';
import ScaleFretboard from '../components/ScaleFretboard';
import PianoDiagram   from '../components/PianoDiagram';

// 진행의 음표들을 분석해 가장 잘 맞는 스케일 추천
function recommendScales(progression, notes) {
  if (!progression.length) return [];
  const usedNotes = new Set(progression.flatMap(p => {
    const r = ki(p.note);
    // 코드 품질에 따라 정확한 3음 사용
    const third = p.quality === 'min' || p.quality === 'dim' ? 3 : 4;
    const fifth  = p.quality === 'dim' ? 6 : 7;
    return [r, (r + third) % 12, (r + fifth) % 12];
  }));
  const results = [];
  NOTES.forEach(key => {
    const r = ki(key);
    SCALE_MODES.forEach((sc, si) => {
      const scaleSet = new Set(sc.intervals.map(iv => (r + iv) % 12));
      let match = 0;
      usedNotes.forEach(n => { if (scaleSet.has(n)) match++; });
      const score = match / usedNotes.size;
      if (score >= 0.75) results.push({ key, scaleIdx: si, score, label: `${key} ${sc.label}` });
    });
  });
  return results.sort((a, b) => b.score - a.score).slice(0, 4);
}

// 스케일의 다이아토닉 코드 생성 (인터벌에서 품질 직접 계산)
function getScaleDiatonic(key, intervals) {
  const r = ki(key);
  if (intervals.length < 7) return [];
  const scNotes = intervals.map(iv => NOTES[(r + iv) % 12]);
  return scNotes.map((n, i) => {
    const third = (intervals[(i + 2) % 7] - intervals[i] + 12) % 12;
    const fifth  = (intervals[(i + 4) % 7] - intervals[i] + 12) % 12;
    let quality;
    if      (third === 4 && fifth === 7) quality = 'maj';
    else if (third === 3 && fifth === 7) quality = 'min';
    else if (third === 3 && fifth === 6) quality = 'dim';
    else if (third === 4 && fifth === 8) quality = 'aug';
    else quality = third >= 4 ? 'maj' : 'min';
    const name = quality === 'min' ? n + 'm'
               : quality === 'dim' ? n + '°'
               : quality === 'aug' ? n + '+'
               : n;
    return { note: n, quality, degree: ['I','II','III','IV','V','VI','VII'][i], name };
  });
}

export default function ScaleTab() {
  const { activeKey, selScale, setSelScale, selKey, setSelKey, setTransKey, progression, playChord, setCurChord, setCurVar, setProgression, maxProg } = useApp();
  const [scaleInstr, setScaleInstr] = useState('guitar');

  const scaleNotes = selScale !== null
    ? SCALE_MODES[selScale].intervals.map(iv => NOTES[(ki(activeKey) + iv) % 12])
    : [];

  const recommendations = recommendScales(progression, NOTES);
  const diatonicChords  = selScale !== null ? getScaleDiatonic(activeKey, SCALE_MODES[selScale].intervals) : [];

  function applyRecommended(key, scaleIdx) {
    setSelKey(key);
    setTransKey(null); // 전조 해제 후 기준 키로 적용
    setSelScale(scaleIdx);
  }

  function selectScaleChord(c) {
    setCurChord(c);
    setCurVar('');
    playChord(c.note, '', c.quality);
  }

  function addAllDiatonicChords() {
    setProgression(prev => {
      let result = [...prev];
      for (const c of diatonicChords) {
        if (result.length >= maxProg) break;
        result.push({ name: c.name, note: c.note, quality: c.quality, variant: '' });
      }
      return result;
    });
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 20 }}>

      {/* ── 내 진행 분석 → 스케일 추천 ── */}
      {progression.length >= 2 && (
        <View style={styles.recSection}>
          <Text style={styles.recTitle}>내 진행에 맞는 스케일</Text>
          {recommendations.length === 0 ? (
            <Text style={styles.recEmpty}>매칭 스케일 없음</Text>
          ) : (
            <View style={styles.recList}>
              {recommendations.map((r, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.recBtn, i === 0 && styles.recBtnTop]}
                  onPress={() => applyRecommended(r.key, r.scaleIdx)}>
                  <Text style={[styles.recLabel, i === 0 && styles.recLabelTop]}>{r.label}</Text>
                  <Text style={styles.recScore}>{Math.round(r.score * 100)}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── 스케일 선택 ── */}
      <Text style={styles.label}>스케일 모드</Text>
      <View style={styles.grid}>
        {SCALE_MODES.map((sc, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.scBtn, selScale === i && styles.scBtnSel]}
            onPress={() => setSelScale(selScale === i ? null : i)}>
            <Text style={[styles.scBtnLabel, selScale === i && styles.scBtnLabelSel]}>{sc.label}</Text>
            <Text style={styles.scBtnName}>{sc.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selScale !== null && (
        <>
          {/* 구성음 */}
          <Text style={styles.label}>구성음 — {activeKey} {SCALE_MODES[selScale].label}</Text>
          <View style={styles.notesRow}>
            {scaleNotes.map((n, i) => (
              <View key={i} style={[styles.noteChip, i === 0 && styles.noteChipRoot]}>
                <Text style={[styles.noteChipText, i === 0 && styles.noteChipTextRoot]}>{n}</Text>
              </View>
            ))}
          </View>

          {/* 악기 토글 */}
          <View style={styles.instrRow}>
            {['guitar','piano'].map(instr => (
              <TouchableOpacity
                key={instr}
                style={[styles.instrBtn, scaleInstr === instr && styles.instrBtnSel]}
                onPress={() => setScaleInstr(instr)}>
                <Text style={[styles.instrBtnText, scaleInstr === instr && styles.instrBtnTextSel]}>
                  {instr === 'guitar' ? '기타 지판' : '피아노 건반'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.diagWrap}>
            {scaleInstr === 'guitar' ? (
              <ScaleFretboard scaleKey={activeKey} intervals={SCALE_MODES[selScale].intervals} />
            ) : (
              <PianoDiagram activeNotes={new Set(scaleNotes)} name={`${activeKey} ${SCALE_MODES[selScale].label}`} />
            )}
          </View>

          {/* 이 스케일의 다이아토닉 코드 → 탭하면 진행에 추가 */}
          {diatonicChords.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 14 }]}>
                이 스케일의 코드 — 탭하면 소리 재생
              </Text>
              <View style={styles.diaRow}>
                {diatonicChords.map((c, i) => (
                  <TouchableOpacity key={i} style={styles.diaCard} onPress={() => selectScaleChord(c)}>
                    <Text style={styles.diaDeg}>{c.degree}</Text>
                    <Text style={styles.diaName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={styles.allAddBtn} onPress={addAllDiatonicChords}>
                <Text style={styles.allAddBtnText}>전체 진행 추가</Text>
              </TouchableOpacity>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap:              { flex: 1, backgroundColor: COLORS.bg },
  label:             { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, marginBottom: 8 },
  // 추천
  recSection:        { backgroundColor: 'rgba(74,126,200,0.1)', borderWidth: 1, borderColor: 'rgba(74,126,200,0.3)', borderRadius: 10, padding: 12, marginBottom: 16 },
  recTitle:          { fontSize: 11, color: COLORS.blue, letterSpacing: 1, marginBottom: 8, fontWeight: '700' },
  recEmpty:          { fontSize: 12, color: COLORS.text2 },
  recList:           { gap: 5 },
  recBtn:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  recBtnTop:         { borderColor: COLORS.blue, backgroundColor: 'rgba(74,126,200,0.12)' },
  recLabel:          { fontSize: 13, color: COLORS.text },
  recLabelTop:       { color: COLORS.blue, fontWeight: '700' },
  recScore:          { fontSize: 11, color: COLORS.text2, fontFamily: 'monospace' },
  // 스케일 선택
  grid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  scBtn:             { width: '47%', paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card },
  scBtnSel:          { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.1)' },
  scBtnLabel:        { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  scBtnLabelSel:     { color: COLORS.purple },
  scBtnName:         { fontSize: 9, color: COLORS.text2, marginTop: 2 },
  notesRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  noteChip:          { paddingHorizontal: 9, paddingVertical: 4, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6 },
  noteChipRoot:      { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  noteChipText:      { fontSize: 12, color: COLORS.text },
  noteChipTextRoot:  { color: '#fff', fontWeight: '700' },
  instrRow:          { flexDirection: 'row', gap: 6, marginBottom: 10 },
  instrBtn:          { flex: 1, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card, alignItems: 'center' },
  instrBtnSel:       { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.1)' },
  instrBtnText:      { fontSize: 12, color: COLORS.text2 },
  instrBtnTextSel:   { color: COLORS.purple },
  diagWrap:          { alignItems: 'center', marginTop: 4 },
  // 다이아토닉 코드
  diaRow:            { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginBottom: 10 },
  diaCard:           { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.purple, borderRadius: 8, backgroundColor: 'rgba(167,139,250,0.08)' },
  diaDeg:            { fontSize: 9, color: COLORS.purple },
  diaName:           { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  allAddBtn:         { alignItems: 'center', paddingVertical: 10, borderWidth: 1.5, borderColor: COLORS.purple, borderRadius: 9, backgroundColor: 'rgba(167,139,250,0.12)', marginBottom: 6 },
  allAddBtnText:     { fontSize: 13, color: COLORS.purple, fontWeight: '700', letterSpacing: 0.5 },
});
