import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import { COLORS, VAR_IV } from '../data/musicData';
import { getChords, chordNameToNote, chordNameToQuality, chordNameToVariant, getGuitarShapes, flatChordName } from '../utils/musicUtils';
import { exportMIDI } from '../utils/midiUtils';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram  from '../components/PianoDiagram';

const MEASURE_SIZE = 4; // 4/4박자: 한 마디 = 4슬롯(비트)

// 각 코드의 재생 길이(비트 수) 계산
// 1코드 = 온음표(4비트), 2코드 = 2분음표(2비트), 3코드 = 2+1+1, 4+ = 균등 분배
function getChordBeats(prog, breaks) {
  const beats = new Array(prog.length).fill(1);
  breaks.forEach((startIdx, mIdx) => {
    const endIdx = mIdx + 1 < breaks.length ? breaks[mIdx + 1] : prog.length;
    const count = endIdx - startIdx;
    if (count <= 0) return;
    for (let i = startIdx; i < endIdx; i++) {
      if (count === 1)      beats[i] = 4;
      else if (count === 2) beats[i] = 2;
      else if (count === 3) beats[i] = (i === startIdx) ? 2 : 1;
      else                  beats[i] = 4 / count;
    }
  });
  return beats;
}

export default function ProgressionTab({ onSwitchToAnalyze }) {
  const {
    activeKey, selMode, curChord, curVar,
    progression, setProgression,
    selKey, setSelKey, selMode: _sm, setSelMode,
    setTransKey, setCurChord, setCurVar,
    bpm, setBpm, vol,
    saved, loadSaved, saveProg, deleteSaved,
    playChord,
    curInstr, setCurInstr,
    measureBreaks, setMeasureBreaks,
    maxProg, setMaxProg,
  } = useApp();

  const ivRef      = useRef(null);   // setTimeout ID
  const playingRef = useRef(false);
  const [playing,   setPlaying]   = useState(false);
  const [playIdx,   setPlayIdx]   = useState(-1);
  const [showSaved, setShowSaved] = useState(false);
  const [shapeIdx,  setShapeIdx]  = useState(0);

  useEffect(() => {
    loadSaved();
    return () => {
      if (ivRef.current) clearTimeout(ivRef.current);
    };
  }, []);

  // progression이 현재 마디 용량을 초과하면 자동으로 새 마디 추가
  useEffect(() => {
    if (!progression.length) return;
    const lastBreak = measureBreaks[measureBreaks.length - 1];
    const lastEnd   = lastBreak + MEASURE_SIZE;
    if (progression.length > lastEnd) {
      setMeasureBreaks(prev => [...prev, lastEnd]);
      setMaxProg(prev => Math.max(prev, lastEnd + MEASURE_SIZE));
    }
  }, [progression.length]);

  function removeSlot(i) {
    setProgression(prev => prev.filter((_, idx) => idx !== i));
    setMeasureBreaks(prev => {
      const adjusted = prev.map(b => b > i ? b - 1 : b);
      return adjusted.filter((b, idx) => idx === 0 || b > adjusted[idx - 1]);
    });
  }

  function addMeasure() {
    setMeasureBreaks(prev => [...prev, maxProg]);
    setMaxProg(prev => prev + MEASURE_SIZE);
  }

  function stopPlay() {
    if (ivRef.current) clearTimeout(ivRef.current);
    ivRef.current = null;
    playingRef.current = false;
    setPlaying(false);
    setPlayIdx(-1);
  }

  function startPlay() {
    if (!progression.length) return;
    stopPlay();

    const snap   = [...progression];
    const breaks = [...measureBreaks];
    const beats  = getChordBeats(snap, breaks);
    const beatMs = 60000 / bpm;

    playingRef.current = true;
    let idx = 0;

    function tick() {
      if (!playingRef.current) return;
      const pos = idx % snap.length;
      const p   = snap[pos];
      playChord(p.note, p.variant, p.quality);
      setPlayIdx(pos);
      const durMs = (beats[pos] || 1) * beatMs;
      idx++;
      ivRef.current = setTimeout(tick, durMs);
    }

    tick();
    setPlaying(true);
  }

  async function handleSave() {
    const ok = await saveProg();
    if (ok) { setShowSaved(true); loadSaved(); }
    else Alert.alert('진행이 없습니다');
  }

  function handleLoad(p) {
    setSelKey(p.key);
    setSelMode(p.mode);
    setTransKey(null);
    setProgression(p.chords.map(n => {
      const note    = chordNameToNote(n);
      const quality = chordNameToQuality(n);
      const variant = chordNameToVariant(n, note);
      return { name: n, note, quality, variant };
    }));
    setCurChord(null);
    setCurVar('');
    setShowSaved(false);
  }

  function confirmDelete(i) {
    Alert.alert('삭제', '이 진행을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSaved(i) },
    ]);
  }

  async function handleMidi() {
    if (!progression.length) return;
    try { await exportMIDI(progression, bpm); }
    catch (e) { Alert.alert('MIDI 내보내기 실패', e.message); }
  }

  const chords = getChords(activeKey, selMode);
  const c = i => chords[i]?.name || '';

  // 재생 중 코드의 운지 정보
  const playingChord    = playing && playIdx >= 0 ? progression[playIdx] : null;
  const guitarShapes    = playingChord
    ? getGuitarShapes(playingChord.name, playingChord.note, playingChord.quality, playingChord.variant)
    : [];
  const curShape        = guitarShapes[shapeIdx] || guitarShapes[0] || null;
  const pianoIntervals  = playingChord
    ? (VAR_IV[playingChord.variant] || VAR_IV[playingChord.quality === 'min' ? 'm' : playingChord.quality === 'dim' ? '°' : ''] || [0,4,7])
    : null;

  // 마디 렌더 (MEASURE_SIZE=4 슬롯)
  function renderMeasure(measureIdx, startIdx) {
    const isLast = measureIdx === measureBreaks.length - 1;
    return (
      <View key={measureIdx} style={[styles.measure, measureIdx > 0 && styles.measureSep]}>
        <View style={styles.measureHeaderRow}>
          <Text style={styles.measureLabel}>마디 {measureIdx + 1}</Text>
          {isLast && (
            <TouchableOpacity onPress={addMeasure} style={styles.addMeasureBtn}>
              <Text style={styles.addMeasureBtnText}>+ 마디</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.measureSlots}>
          {Array.from({ length: MEASURE_SIZE }).map((_, si) => {
            const i = startIdx + si;
            const p = progression[i];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.slot, p && styles.slotFilled, playIdx === i && styles.slotPlaying]}
                onPress={() => p && removeSlot(i)}>
                <Text
                  style={[styles.slotText, p && styles.slotTextFilled, playIdx === i && styles.slotTextPlaying]}
                  numberOfLines={1}>
                  {p ? flatChordName(p.name, activeKey, selMode) : '·'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* 추천 진행 */}
      <View style={styles.sugSection}>
        <Text style={styles.sugTitle}>추천 진행</Text>
        <View style={styles.sugRow}>
          {[
            { label: 'I-IV-V',    prog: [c(0), c(3), c(4)] },
            { label: 'I-V-VI-IV', prog: [c(0), c(4), c(5), c(3)] },
            { label: 'II-V-I',    prog: [c(1), c(4), c(0)] },
          ].map((s, i) => (
            <View key={i} style={styles.sugChip}>
              <Text style={styles.sugLabel}>{s.label}</Text>
              <Text style={styles.sugChords}>{s.prog.map(n => flatChordName(n, activeKey, selMode)).join('→')}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 동적 마디 슬롯 */}
      <Text style={[styles.label, { marginBottom: 8 }]}>
        코드 진행 ({progression.length}/{maxProg})
      </Text>
      {measureBreaks.map((startIdx, mIdx) => renderMeasure(mIdx, startIdx))}

      {/* 액션 버튼 */}
      <View style={styles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnPri]} onPress={playing ? stopPlay : startPlay}>
          <Text style={[styles.btnText, styles.btnPriText]}>{playing ? '■ 정지' : '▶ 재생'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={onSwitchToAnalyze}>
          <Text style={styles.btnText}>✦ 분석</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleSave}>
          <Text style={styles.btnText}>☆ 저장</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, showSaved && styles.btnActive]} onPress={() => setShowSaved(v => !v)}>
          <Text style={[styles.btnText, showSaved && styles.btnActiveText]}>
            ↑ 불러오기 {saved.length > 0 ? `(${saved.length})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={handleMidi}>
          <Text style={styles.btnText}>↓ MIDI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => { stopPlay(); setProgression([]); setMeasureBreaks([0]); setMaxProg(16); }}>
          <Text style={styles.btnText}>✕ 초기화</Text>
        </TouchableOpacity>
      </View>

      {/* 재생 중 운지 표시 */}
      {playingChord && (
        <View style={styles.fingeringBox}>
          <View style={styles.fingeringHeader}>
            <Text style={styles.fingeringChordName}>{flatChordName(playingChord.name, activeKey, selMode)}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['guitar', 'piano'].map(instr => (
                <TouchableOpacity
                  key={instr}
                  style={[styles.instrBtn, curInstr === instr && styles.instrBtnActive]}
                  onPress={() => { setCurInstr(instr); setShapeIdx(0); }}>
                  <Text style={[styles.instrBtnText, curInstr === instr && styles.instrBtnTextActive]}>
                    {instr === 'guitar' ? '기타' : '피아노'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {curInstr === 'guitar' && (
            <View>
              {guitarShapes.length > 1 && (
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                  {guitarShapes.map((s, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.shapeBtn, shapeIdx === i && styles.shapeBtnActive]}
                      onPress={() => setShapeIdx(i)}>
                      <Text style={[styles.shapeBtnText, shapeIdx === i && styles.shapeBtnTextActive]}>
                        {s.pos}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <GuitarDiagram
                shape={curShape}
                name={playingChord.name}
                displayName={flatChordName(playingChord.name, activeKey, selMode)}
                posLabel={curShape?.pos}
              />
            </View>
          )}

          {curInstr === 'piano' && pianoIntervals && (
            <PianoDiagram
              rootNote={playingChord.note}
              chordIntervals={pianoIntervals}
              name={playingChord.name}
            />
          )}
        </View>
      )}

      {/* BPM */}
      <View style={styles.bpmRow}>
        <Text style={styles.bpmLabel}>BPM</Text>
        <Slider
          style={{ flex: 1 }}
          minimumValue={40} maximumValue={200} step={1}
          value={bpm} onValueChange={setBpm}
          minimumTrackTintColor={COLORS.accent}
          maximumTrackTintColor={COLORS.border}
          thumbTintColor={COLORS.accent}
        />
        <Text style={styles.bpmVal}>{bpm}</Text>
      </View>

      {/* 저장된 진행 목록 */}
      {showSaved && (
        <View style={styles.savedSection}>
          <Text style={styles.label}>저장된 진행</Text>
          {!saved.length && (
            <Text style={styles.savedEmpty}>저장된 진행이 없습니다</Text>
          )}
          {saved.map((p, i) => (
            <TouchableOpacity key={i} style={styles.savedItem} onPress={() => handleLoad(p)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.savedMeta}>{p.key} {p.mode === 'major' ? '장조' : '단조'} · {p.date}</Text>
                <Text style={styles.savedChords} numberOfLines={1}>{p.chords.map(n => flatChordName(n, p.key, p.mode)).join(' → ')}</Text>
              </View>
              <TouchableOpacity style={styles.delBtn} onPress={() => confirmDelete(i)}>
                <Text style={styles.delBtnText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap:           { flex: 1, backgroundColor: COLORS.bg },
  label:          { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5 },

  // 추천 진행
  sugSection:     { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  sugTitle:       { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, marginBottom: 6 },
  sugRow:         { flexDirection: 'row', gap: 6 },
  sugChip:        { flex: 1, backgroundColor: COLORS.card, borderRadius: 6, padding: 7, borderWidth: 1, borderColor: COLORS.border },
  sugLabel:       { fontSize: 9, color: COLORS.accent, fontWeight: '700', marginBottom: 2 },
  sugChords:      { fontSize: 10, color: COLORS.text2 },

  // 마디 (MEASURE_SIZE=4, 한 줄에 4슬롯)
  measure:           { marginBottom: 10 },
  measureSep:        { paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  measureHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  measureLabel:      { fontSize: 9, color: COLORS.text2, letterSpacing: 1 },
  addMeasureBtn:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: COLORS.accent, backgroundColor: COLORS.accent + '22' },
  addMeasureBtnText: { fontSize: 9, color: COLORS.accent, fontWeight: '700' },
  measureSlots:      { flexDirection: 'row', gap: 4 },
  slot:           { flex: 1, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 7, alignItems: 'center' },
  slotFilled:     { borderStyle: 'solid', borderColor: COLORS.accent },
  slotPlaying:    { backgroundColor: COLORS.accent, borderStyle: 'solid' },
  slotText:       { fontSize: 11, color: COLORS.text2 },
  slotTextFilled: { color: COLORS.accent, fontWeight: '700' },
  slotTextPlaying:{ color: '#111', fontWeight: '700' },

  // 액션
  actions:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  btn:            { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card },
  btnText:        { fontSize: 11, color: COLORS.text },
  btnPri:         { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  btnPriText:     { color: '#111', fontWeight: '700' },
  btnActive:      { borderColor: COLORS.blue, backgroundColor: 'rgba(74,158,255,0.1)' },
  btnActiveText:  { color: COLORS.blue },

  // BPM
  bpmRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  bpmLabel:       { fontSize: 11, color: COLORS.text2, minWidth: 32 },
  bpmVal:         { fontSize: 11, color: COLORS.text, minWidth: 28 },

  // 재생 중 운지
  fingeringBox:         { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: COLORS.accent + '55' },
  fingeringHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fingeringChordName:   { fontSize: 16, color: COLORS.accent, fontWeight: '700' },
  instrBtn:             { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  instrBtnActive:       { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '22' },
  instrBtnText:         { fontSize: 11, color: COLORS.text2 },
  instrBtnTextActive:   { color: COLORS.accent, fontWeight: '700' },
  shapeBtn:             { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  shapeBtnActive:       { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  shapeBtnText:         { fontSize: 9, color: COLORS.text2 },
  shapeBtnTextActive:   { color: '#111', fontWeight: '700' },

  // 저장된 진행
  savedSection:   { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
  savedEmpty:     { color: COLORS.text2, fontSize: 12, textAlign: 'center', marginTop: 8 },
  savedItem:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, marginTop: 6, backgroundColor: COLORS.card },
  savedMeta:      { fontSize: 10, color: COLORS.text2, marginBottom: 3 },
  savedChords:    { fontSize: 12, color: COLORS.text },
  delBtn:         { padding: 6 },
  delBtnText:     { color: COLORS.text2, fontSize: 14 },
});
