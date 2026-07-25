import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { usePurchase } from '../context/PurchaseContext';
import { COLORS, GENRE_PROGS } from '../data/musicData';
import { getChords } from '../utils/musicUtils';
import Purchases from '../utils/purchases';
import { t } from '../i18n';

// AI 분석 백엔드 (Cloudflare Worker) — API 키는 서버에만, 앱엔 없음
const WORKER_URL = 'https://chordnavigator-ai.symptomer.workers.dev';

export default function AnalyzeTab() {
  const {
    activeKey, selMode, transKey, selKey,
    progression,
    selGenre, setSelGenre, selLevel, setSelLevel,
    playChord,
  } = useApp();

  const { isPremium, showPaywall } = usePurchase();

  const [progInput, setProgInput] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [results,   setResults]   = useState(null);

  React.useEffect(() => {
    setProgInput(progression.map(p => p.name).join(' '));
  }, [progression]);

  async function runAI() {
    if (!isPremium) { showPaywall(); return; }
    if (!progInput.trim()) { Alert.alert(t('alertEnterChords')); return; }
    setLoading(true); setResults(null);

    const levelMap = { beginner: '입문', mid: '중급', jazz: '재즈' };

    try {
      const appUserId = await Purchases.getAppUserID();
      const res  = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appUserId,
          progression: progInput,
          genre: GENRE_PROGS[selGenre]?.name,
          level: levelMap[selLevel],
          key:   activeKey,
          mode:  selMode,
        }),
      });
      const data = await res.json();
      if (data.error === 'not_premium') { showPaywall(); return; }
      if (data.error === 'rate_limited') {
        Alert.alert(t('aiQuotaTitle'), t('aiQuotaBody'));
        return;
      }
      if (data.error) throw new Error(data.message || data.error);
      setResults({ type: 'ai', original: progInput, json: data });
    } catch (e) {
      Alert.alert(t('aiFailTitle'), e.message + '\n\n' + t('aiFailBody'));
    } finally { setLoading(false); }
  }

  function runLocal() {
    if (!progInput.trim()) { Alert.alert(t('alertEnterChords')); return; }
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
        { label: t('localOriginal'), chords, desc: t('localOriginalDesc', { n: chords.length }), color: COLORS.text2 },
        { label: t('localMid7'),     chords: with7, desc: t('localMid7Desc'), color: COLORS.purple },
        { label: t('resSubVersion'), chords: subChords, desc: t('localSubDesc'), color: COLORS.accent },
        { label: t('localJazzTri'),  chords: tritone, desc: t('localJazzTriDesc'), color: COLORS.accent2 },
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
      {/* Prog input */}
      <Text style={styles.label}>{t('progInputLabel')}</Text>
      <TextInput
        style={styles.progInput}
        value={progInput}
        onChangeText={setProgInput}
        placeholder={t('progInputPlaceholder')}
        placeholderTextColor={COLORS.text2}
        multiline
        autoCapitalize="none"
      />

      {/* Genre */}
      <Text style={styles.label}>{t('genreLabel')}</Text>
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
      <Text style={styles.label}>{t('level')}</Text>
      <View style={styles.levelRow}>
        {[['beginner',t('levelBeginner')],['mid',t('levelMid')],['jazz',`${t('levelJazz')} 🔒`]].map(([k, label]) => (
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
        <Text style={styles.fullBtnText}>{isPremium ? t('aiAnalyze') : t('aiAnalyzeLocked')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.fullBtn, { backgroundColor: COLORS.bg3 }]} onPress={runLocal}>
        <Text style={styles.fullBtnText}>{t('ruleAnalyze')}</Text>
      </TouchableOpacity>

      {loading && <ActivityIndicator color={COLORS.accent} style={{ marginTop: 16 }} />}

      {/* Results */}
      {results?.type === 'ai' && (
        <>
          <ResultCard
            title={t('resOriginal')} color={COLORS.text2}
            chords={results.original.split(/\s+/)}
            desc={results.json.analysis}
            onPlay={() => playSeq(results.original.split(/\s+/))} />
          {[
            { key: 'genre_version',     label: t('resGenreRec', { genre: GENRE_PROGS[selGenre]?.name }), color: COLORS.pink },
            { key: 'level_version',     label: selLevel === 'jazz' ? t('resJazzReharm') : selLevel === 'mid' ? t('resMidVersion') : t('resBeginnerVersion'), color: COLORS.purple },
            { key: 'substitute_version',label: t('resSubVersion'), color: COLORS.accent },
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
