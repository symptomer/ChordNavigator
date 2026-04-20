import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS } from '../data/musicData';
import { chordNameToNote, chordNameToQuality } from '../utils/musicUtils';

export default function SavedTab({ onLoadProg }) {
  const { saved, loadSaved, deleteSaved } = useApp();

  useEffect(() => { loadSaved(); }, []);

  function confirmDelete(i) {
    Alert.alert('삭제', '이 진행을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSaved(i) },
    ]);
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 20 }}>
      <Text style={styles.label}>저장된 진행 ({saved.length})</Text>
      {!saved.length && (
        <Text style={styles.empty}>저장된 진행이 없습니다</Text>
      )}
      {saved.map((p, i) => (
        <TouchableOpacity key={i} style={styles.item} onPress={() => onLoadProg(p)}>
          <View style={{ flex: 1 }}>
            <Text style={styles.meta}>{p.key} {p.mode === 'major' ? '장조' : '단조'} · {p.date}</Text>
            <Text style={styles.chords}>{p.chords.join(' → ')}</Text>
          </View>
          <TouchableOpacity style={styles.delBtn} onPress={() => confirmDelete(i)}>
            <Text style={styles.delBtnText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap:       { flex: 1, backgroundColor: COLORS.bg },
  label:      { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, marginBottom: 10 },
  empty:      { color: COLORS.text2, fontSize: 12, textAlign: 'center', marginTop: 20 },
  item:       { flexDirection: 'row', alignItems: 'center', padding: 12, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, marginBottom: 6, backgroundColor: COLORS.card },
  meta:       { fontSize: 10, color: COLORS.text2, marginBottom: 4 },
  chords:     { fontSize: 13, color: COLORS.text },
  delBtn:     { padding: 6 },
  delBtnText: { color: COLORS.text2, fontSize: 14 },
});
