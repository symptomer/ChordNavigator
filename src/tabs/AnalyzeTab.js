import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { usePurchase } from '../context/PurchaseContext';
import { COLORS, GENRE_PROGS } from '../data/musicData';
import { getChords } from '../utils/musicUtils';

export default function AnalyzeTab() {
  const {
    activeKey, selMode, transKey, selKey,
    progression, apiKey, setApiKey,
    selGenre, setSelGenre, selLevel, setSelLevel,
    playChord,
  } = useApp();

  const { isPremium, showPaywall } = usePurchase();

  const [apiInput,  setApiInput]  = useState(apiKey);
  const [progInput, setProgInput] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState(null);

  React.useEffect(() => {
    setProgInput(progression.map(p => p.name).join(' '));
  }, [progression]);

  async function saveKey() {
    await setApiKey(apiInput.trim());
    Alert.alert(apiInput.trim() ? 'API 키 저장됨' : 'API 키 삭제됨');
  }

  async function runAI() {
    if (!isPremium) { showPaywall(); return; }
    if (!progInput.trim()) { Alert.alert('코드를 입력하세요'); return; }
    if (!apiKey)            { Alert.alert('API 키를 먼저 입력하세요'); return; }
    setLoading(true); setResults(null);

    const levelMap = {
      beginner: '입문 (기본 코드 유지)',
      mid:      '중급 (7th, 텐션 추가)',
      jazz:     '재즈 (리하모니제이션, 트리톤 대리)',
    };
    const prompt = `음악 코드 진행 분석 전문가야. 다음 코드 진행을 분석하고 추천해줘.

코드 진행: ${progInput}
장르: ${GENRE_PROGS[selGenre]?.name}
레벨: ${levelMap[selLevel]}
기준 키: ${activeKey} ${selMode === 'major' ? '장조' : '단조'}

다음 4가지를 JSON으로 응답해줘. 다른 텍스트 없이 JSON만:
{"analysis":"원본 진행 분석 (2문장)","genre_version":{"chords":"코드1 코드2 ...","desc":"장르 특성 설명"},"level_version":{"chords":"코드1 코드2 ...","desc":"레벨 설명"},"substitute_version":{"chords":"코드1 코드2 ...","desc":"대리코드 설명"}}`;

    try {
      const res  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 800,
          messages:   [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content[0].text;
      const json = JSON.parse(text.replace(/```json|```/g, '').trim());
      setResults({ type: 'ai', original: progInput, json });
    } catch (e) {
      Alert.alert('AI 분석 실패', e.message + '\n\n규칙 기반 분석을 사용해보세요');
    } finally { setLoading(false); }
  }

  function runLocal() {
    if (!progInput.trim()) { Alert.alert('코드를 입력하세요'); return; }
    const chords   = progInput.trim().split(/[\s,]+/).filter(Boolean);
    const diatonic = getChords(activeKey, selMode);

    const with7 = chords.map(c => {
      if (c.match(/[°7]|maj7|m7|add|sus/)) return c;
      return c.includes('m') && !c.includes('maj') ? c + '7' : c + 'maj7';
    });

    // 노트 기준 대리코드 매핑 (확장 코드명에도 작동)
    const noteSubMap = {};
    diatonic.forEach((c, i) => {
      if (i === 0 && diatonic[5]) noteSubMap[c.note] = diatonic[5];
      if (i === 4 && diatonic[1]) noteSubMap[c.note] = diatonic[1];
    });
    const subChords = chords.map(c => {
      const note = c.match(/^[A-G][b#]?/)?.[0];
      const sub  = note && noteSubMap[note];
      return sub ? sub.name : c;
    });

    const tritone = chords.map(c => {
      if (!c.includes('7') || c.includes('maj7')) return c;
      const note = c.replace(/7.*/, '');
      const ni   = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].indexOf(note);
      if (ni < 0) return c;
      return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][(ni + 6) % 12] + '7';
    });

    setResults({
      type: 'local',
      items: [
        { label: '원본 진행',         chords, desc: `${chords.length}개 코드 진행`, color: COLORS.text2 },
        { label: '중급 버전 (7th)',   chords: with7, desc: 'maj7, m7로 색감 풍부하게', color: COLORS.purple },
        { label: '대리코드 버전',     chords: subChords, desc: '동일 기능 대리코드로 교체', color: COLORS.accent },
        { label: '재즈 (트리톤 대리)',chords: tritone, desc: 'dom7을 반음 위 코드로 교체', color: COLORS.accent2 },
      ],
    });
  }

  function playSeq(chordNames) {
    let i = 0;
    function tick() {
      if (i >= chordNames.length) return;
      const name = chordNames[i];
      const note = name.match(/^[A-G][b#]?/)?.[0] || 'C';
      const qual = name.includes('m') && !name.includes('maj') ? 'min'
                 : name.includes('°') ? 'dim' : 'maj';
      playChord(note, '', qual);
      i++;
      if (i < chordNames.length) setTimeout(tick, 1500);
    }
    tick();
  }

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 20 }}>
      {/* API Key */}
      <View style={styles.apiBox}>
        <Text style={styles.label}>Claude API 키</Text>
        <TextInput
          style={styles.apiInput}
          value={apiInput}
          onChangeText={setApiInput}
          placeholder="sk-ant-api03-..."
          placeholderTextColor={COLORS.text2}
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.smBtn} onPress={saveKey}>
          <Text style={styles.smBtnText}>저장</Text>
        </TouchableOpacity>
      </View>

      {/* Prog input */}
      <Text style={styles.label}>코드 진행 입력</Text>
      <TextInput
        style={styles.progInput}
        value={progInput}
        onChangeText={setProgInput}
        placeholder="예: C Am F G"
        placeholderTextColor={COLORS.text2}
        multiline
        autoCapitalize="none"
      />

      {/* Genre */}
      <Text style={styles.label}>장르</Text>
      <View style={styles.genreGrid}>
        {Object.entries(GENRE_PROGS).map(([k, v]) => (
          <TouchableOpacity
            key={k}
            style={[styles.gbtn, selGenre === k && styles.gbtnSel]}
            onPress={() => setSelGenre(k)}>
            <Text style={[styles.gbtnText, selGenre === k && styles.gbtnTextSel]}>{v.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Level */}
      <Text style={styles.label}>레벨</Text>
      <View style={styles.levelRow}>
        {[['beginner','입문'],['mid','중급'],['jazz','재즈 🔒']].map(([k, label]) => (
          <TouchableOpacity
            key={k}
            style={[styles.lvbtn, selLevel === k && styles.lvbtnSel]}
            onPress={() => {
              if (k === 'jazz' && !isPremium) { showPaywall(); return; }
              setSelLevel(k);
            }}>
            <Text style={[styles.lvbtnText, selLevel === k && styles.lvbtnTextSel]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Buttons */}
      <TouchableOpacity style={[styles.fullBtn, { backgroundColor: COLORS.purple }]} onPress={runAI}>
        <Text style={styles.fullBtnText}>{isPremium ? '✦ AI 분석 (Claude)' : '🔒 AI 분석 (프리미엄)'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fullBtn, { backgroundColor: COLORS.bg3 }]} onPress={runLocal}>
        <Text style={styles.fullBtnText}>⚙ 규칙 기반 분석 (API 없이)</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />}

      {/* Results */}
      {results?.type === 'ai' && (
        <>
          <ResultCard
            title="원본 분석" color={COLORS.text2}
            chords={results.original.split(/\s+/)}
            desc={results.json.analysis}
            onPlay={() => playSeq(results.original.split(/\s+/))} />
          {[
            { key: 'genre_version',     label: `${GENRE_PROGS[selGenre]?.name} 추천`, color: COLORS.pink },
            { key: 'level_version',     label: selLevel === 'jazz' ? '재즈 리하모니제이션' : selLevel === 'mid' ? '중급 버전' : '입문 버전', color: COLORS.purple },
            { key: 'substitute_version',label: '대리코드 버전', color: COLORS.accent },
          ].map(v => {
            const d = results.json[v.key];
            if (!d) return null;
            const cs = d.chords.split(/\s+/);
            return <ResultCard key={v.key} title={v.label} color={v.color}
              chords={cs} desc={d.desc} onPlay={() => playSeq(cs)} />;
          })}
        </>
      )}

      {results?.type === 'local' && results.items.map((item, i) => (
        <ResultCard key={i} title={item.label} color={item.color}
          chords={item.chords} desc={item.desc} onPlay={() => playSeq(item.chords)} />
      ))}
    </ScrollView>
  );
}

function ResultCard({ title, color, chords, desc, onPlay }) {
  return (
    <View style={rcStyles.card}>
      <View style={rcStyles.row}>
        <Text style={[rcStyles.title, { color }]}>{title}</Text>
        <TouchableOpacity style={rcStyles.playBtn} onPress={onPlay}>
          <Text style={rcStyles.playBtnText}>▶</Text>
        </TouchableOpacity>
      </View>
      <Text style={rcStyles.prog}>{chords.join(' → ')}</Text>
      <Text style={rcStyles.desc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:         { flex: 1, backgroundColor: COLORS.bg },
  label:        { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, marginBottom: 6 },
  apiBox:       { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginBottom: 14 },
  apiInput:     { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, borderRadius: 6, padding: 8, fontSize: 12, marginBottom: 6 },
  smBtn:        { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  smBtnText:    { color: COLORS.text, fontSize: 11 },
  progInput:    { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, minHeight: 44 },
  genreGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 12 },
  gbtn:         { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card },
  gbtnSel:      { backgroundColor: COLORS.pink, borderColor: COLORS.pink },
  gbtnText:     { fontSize: 11, color: COLORS.text2 },
  gbtnTextSel:  { color: '#fff', fontWeight: '700' },
  levelRow:     { flexDirection: 'row', gap: 6, marginBottom: 12 },
  lvbtn:        { flex: 1, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 7, backgroundColor: COLORS.card, alignItems: 'center' },
  lvbtnSel:     { backgroundColor: COLORS.green, borderColor: COLORS.green },
  lvbtnText:    { fontSize: 12, color: COLORS.text2 },
  lvbtnTextSel: { color: '#fff', fontWeight: '700' },
  fullBtn:      { padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  fullBtnText:  { fontSize: 13, color: '#fff', fontWeight: '600' },
});

const rcStyles = StyleSheet.create({
  card:       { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginTop: 8 },
  row:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  title:      { fontSize: 11, fontWeight: '700', letterSpacing: 1, flex: 1 },
  playBtn:    { borderWidth: 1, borderColor: COLORS.border, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  playBtnText:{ fontSize: 10, color: COLORS.text2 },
  prog:       { fontSize: 14, letterSpacing: 1, color: COLORS.text, marginBottom: 4 },
  desc:       { fontSize: 11, color: COLORS.text2, lineHeight: 18 },
});
