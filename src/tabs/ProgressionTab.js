import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useApp } from '../context/AppContext';
import { COLORS } from '../data/musicData';
import { getChords, chordNameToNote, chordNameToQuality, chordNameToVariant } from '../utils/musicUtils';
import { exportMIDI } from '../utils/midiUtils';

const MEASURE_SIZE = 8; // 마디당 최대 코드 수

export default function ProgressionTab({ onSwitchToAnalyze }) {
  const {
    activeKey, selMode, curChord, curVar,
    progression, setProgression,
    selKey, setSelKey, selMode: _sm, setSelMode,
    setTransKey, setCurChord, setCurVar,
    bpm, setBpm, vol,
    saved, loadSaved, saveProg, deleteSaved,
    playChord,
  } = useApp();

  const ivRef   = useRef(null);
  const beatRef = useRef(0);
  const [playing,     setPlaying]     = useState(false);
  const [playIdx,     setPlayIdx]     = useState(-1);
  const [showSaved,   setShowSaved]   = useState(false);

  useEffect(() => {
    loadSaved();
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  function removeSlot(i) {
    setProgression(prev => prev.filter((_, idx) => idx !== i));
  }

  function stopPlay() {
    if (ivRef.current) clearInterval(ivRef.current);
    ivRef.current = null;
    setPlaying(false);
    setPlayIdx(-1);
    beatRef.current = 0;
  }

  function startPlay() {
    if (!progression.length) return;
    stopPlay();
    const snap = [...progression];
    beatRef.current = 0;
    const ms = (60000 / bpm) * 2;
    function tick() {
      const idx = beatRef.current % snap.length;
      const p   = snap[idx];
      playChord(p.note, p.variant, p.quality);
      setPlayIdx(idx);
      beatRef.current++;
    }
    tick();
    ivRef.current = setInterval(tick, ms);
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

  // 2마디 슬롯 렌더
  function renderMeasure(measureIdx) {
    const start = measureIdx * MEASURE_SIZE;
    return (
      <View style={styles.measure}>
        <Text style={styles.measureLabel}>마디 {measureIdx + 1}</Text>
        <View style={styles.measureSlots}>
          {Array.from({ length: MEASURE_SIZE }).map((_, si) => {
            const i = start + si;
            const p = progression[i];
            return (
              <TouchableOpacity
                key={i}
                style={[styles.slot, p && styles.slotFilled, playIdx === i && styles.slotPlaying]}
                onPress={() => p && removeSlot(i)}>
                <Text style={[styles.slotText, p && styles.slotTextFilled, playIdx === i && styles.slotTextPlaying]}
                  numberOfLines={1}>
                  {p ? p.name : '·'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 20 }}>

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
              <Text style={styles.sugChords}>{s.prog.join('→')}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 2마디 슬롯 */}
      <Text style={[styles.label, { marginBottom: 8 }]}>
        코드 진행 ({progression.length}/16)
      </Text>
      {renderMeasure(0)}
      {renderMeasure(1)}

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
        <TouchableOpacity style={styles.btn} onPress={() => { stopPlay(); setProgression([]); }}>
          <Text style={styles.btnText}>✕ 초기화</Text>
        </TouchableOpacity>
      </View>

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
                <Text style={styles.savedChords} numberOfLines={1}>{p.chords.join(' → ')}</Text>
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

  // 마디
  measure:        { marginBottom: 10 },
  measureLabel:   { fontSize: 9, color: COLORS.text2, letterSpacing: 1, marginBottom: 4 },
  measureSlots:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  slot:           { width: '23%', paddingVertical: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, borderRadius: 7, alignItems: 'center' },
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

  // 저장된 진행
  savedSection:   { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: COLORS.border, marginTop: 4 },
  savedEmpty:     { color: COLORS.text2, fontSize: 12, textAlign: 'center', marginTop: 8 },
  savedItem:      { flexDirection: 'row', alignItems: 'center', padding: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, marginTop: 6, backgroundColor: COLORS.card },
  savedMeta:      { fontSize: 10, color: COLORS.text2, marginBottom: 3 },
  savedChords:    { fontSize: 12, color: COLORS.text },
  delBtn:         { padding: 6 },
  delBtnText:     { color: COLORS.text2, fontSize: 14 },
});
