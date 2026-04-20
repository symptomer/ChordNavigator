import React from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, NOTES } from '../data/musicData';

export default function HomeScreen({ navigation }) {
  const { selKey, setSelKey, selMode, setSelMode, selLevel, setSelLevel, resetNavigator, loadApiKey } = useApp();

  React.useEffect(() => { loadApiKey(); }, []);

  function start() {
    resetNavigator();
    navigation.navigate('Navigator');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.heroChar}>♩</Text>
          <Text style={styles.heroTitle}>CHORD NAVIGATOR</Text>
          <Text style={styles.heroSub}>코드 진행 탐색기</Text>
        </View>

        <Text style={styles.label}>키 선택</Text>
        <View style={styles.keyGrid}>
          {NOTES.map(k => (
            <TouchableOpacity
              key={k}
              style={[styles.kbtn, selKey === k && styles.kbtnSel]}
              onPress={() => setSelKey(k)}>
              <Text style={[styles.kbtnText, selKey === k && styles.kbtnTextSel]}>{k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>장조 / 단조</Text>
        <View style={styles.modeRow}>
          {[['major','장조'],['minor','단조']].map(([m, label]) => (
            <TouchableOpacity
              key={m}
              style={[styles.mbtn, selMode === m && styles.mbtnSel]}
              onPress={() => setSelMode(m)}>
              <Text style={[styles.mbtnText, selMode === m && styles.mbtnTextSel]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>레벨</Text>
        <View style={styles.levelRow}>
          {[['beginner','입문'],['mid','중급'],['jazz','재즈']].map(([lv, label]) => (
            <TouchableOpacity
              key={lv}
              style={[styles.lvbtn, selLevel === lv && styles.lvbtnSel]}
              onPress={() => setSelLevel(lv)}>
              <Text style={[styles.lvbtnText, selLevel === lv && styles.lvbtnTextSel]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>선택된 키</Text>
          <Text style={styles.previewKey}>{selKey} {selMode === 'major' ? '장조' : '단조'}</Text>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={start}>
          <Text style={styles.startBtnText}>▶ 탐색 시작</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: COLORS.bg },
  wrap:          { padding: 16, paddingBottom: 40 },
  hero:          { alignItems: 'center', paddingVertical: 28 },
  heroChar:      { fontSize: 56, color: COLORS.accent },
  heroTitle:     { fontSize: 14, color: COLORS.accent, letterSpacing: 4, marginTop: 4, fontWeight: '700' },
  heroSub:       { fontSize: 11, color: COLORS.text2, letterSpacing: 2, marginTop: 4 },
  label:         { fontSize: 10, color: COLORS.text2, letterSpacing: 2, marginBottom: 10, marginTop: 4 },
  keyGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18 },
  kbtn:          { width: '14.5%', paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center' },
  kbtnSel:       { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  kbtnText:      { fontSize: 13, color: COLORS.text },
  kbtnTextSel:   { color: '#111', fontWeight: '700' },
  modeRow:       { flexDirection: 'row', gap: 8, marginBottom: 20 },
  mbtn:          { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center' },
  mbtnSel:       { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  mbtnText:      { fontSize: 14, color: COLORS.text },
  mbtnTextSel:   { color: '#111', fontWeight: '700' },
  previewBox:    { alignItems: 'center', paddingVertical: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.bg3, marginBottom: 20 },
  previewLabel:  { fontSize: 10, color: COLORS.text2, letterSpacing: 2 },
  previewKey:    { fontSize: 28, color: COLORS.accent, fontWeight: '700', marginTop: 4 },
  startBtn:      { backgroundColor: COLORS.accent, borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  startBtnText:  { fontSize: 16, color: '#111', fontWeight: '800', letterSpacing: 2 },
  levelRow:      { flexDirection: 'row', gap: 8, marginBottom: 20 },
  lvbtn:         { flex: 1, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center' },
  lvbtnSel:      { backgroundColor: COLORS.green, borderColor: COLORS.green },
  lvbtnText:     { fontSize: 14, color: COLORS.text },
  lvbtnTextSel:  { color: '#fff', fontWeight: '700' },
});
