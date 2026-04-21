import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, LEVEL_DEFAULT, LEVEL_VARS, NOTES, GENRE_PROGS, VAR_IV } from '../data/musicData';
import { getChords, getChordTones, getSubstitutes, ki, getGuitarShapes, getVariantKey, flatChordName,
         chordNameToNote, chordNameToQuality, chordNameToVariant } from '../utils/musicUtils';
import { exportMIDI } from '../utils/midiUtils';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram  from '../components/PianoDiagram';

// 각 도수에서 다음으로 자주 가는 도수 인덱스 (음악 이론 기반)
const NEXT_FROM = {
  0: [3, 4, 5, 1],   // I  → IV V VI II
  1: [4, 0, 6],      // II → V I VII
  2: [5, 3, 1],      // III→ VI IV II
  3: [0, 4, 1, 5],   // IV → I V II VI
  4: [0, 5, 3],      // V  → I VI IV
  5: [1, 3, 4, 0],   // VI → II IV V I
  6: [0, 2],         // VII→ I III
};


// ── 장르별 코드 진행 패턴 DB (도수 인덱스 기반) ──────────────────
const GENRE_PATTERNS = {
  pop: [
    { pattern:[0,4,5,3], mood:'밝고 상쾌한',  tip:'팝의 황금 진행' },
    { pattern:[0,3,4,0], mood:'클래식',        tip:'가장 기본적인 팝' },
    { pattern:[5,3,0,4], mood:'감성적',        tip:'VI-IV-I-V 팝 감성' },
    { pattern:[1,4,0,5], mood:'세련된',        tip:'II-V-I 팝 버전' },
  ],
  rock: [
    { pattern:[0,3,4,0], mood:'파워풀',        tip:'I-IV-V 록 기본' },
    { pattern:[0,5,3,4], mood:'드라이브',      tip:'I-VI-IV-V 드라이빙 록' },
    { pattern:[0,3,5,4], mood:'그루비',        tip:'I-IV-VI-V 그루비 록' },
    { pattern:[0,4,3,5], mood:'어두운',        tip:'I-V-IV-VI 헤비' },
  ],
  jazz: [
    { pattern:[1,4,0],   mood:'스윙',          tip:'II-V-I 정통 재즈' },
    { pattern:[0,5,1,4], mood:'서정적',        tip:'I-VI-II-V 리듬 체인지' },
    { pattern:[2,5,1,4], mood:'모달',          tip:'III-VI-II-V 재즈 순환' },
    { pattern:[0,4,3,1], mood:'바운시',        tip:'I-V-IV-II 재즈 터치' },
  ],
  rnb: [
    { pattern:[0,3,5,4], mood:'그루비',        tip:'I-IV-VI-V 소울' },
    { pattern:[5,3,0,4], mood:'소울풀',        tip:'VI-IV-I-V R&B 클래식' },
    { pattern:[0,5,3,1], mood:'부드러운',      tip:'I-VI-IV-II 네오소울' },
    { pattern:[0,4,5,1], mood:'리드미컬',      tip:'I-V-VI-II 펑키' },
  ],
  ballad: [
    { pattern:[0,4,5,3], mood:'서정적',        tip:'발라드 황금 진행' },
    { pattern:[0,4,2,5], mood:'드라마틱',      tip:'I-V-III-VI 서사적' },
    { pattern:[0,3,0,4], mood:'잔잔한',        tip:'I-IV-I-V 단순한 아름다움' },
    { pattern:[5,4,0,3], mood:'슬픈',          tip:'VI-V-I-IV 슬로우 발라드' },
  ],
  bossa: [
    { pattern:[0,5,1,4], mood:'달콤한',        tip:'보사노바 기본 순환' },
    { pattern:[0,3,5,1], mood:'리드미컬',      tip:'I-IV-VI-II 라틴 감성' },
    { pattern:[1,5,1,4], mood:'유러피안',      tip:'II-VI-II-V 세련된' },
  ],
};

const DEG_NAMES = ['I','II','III','IV','V','VI','VII'];

function getLevelSuffixStatic(quality, degIdx, levelDef) {
  if (!levelDef) return '';
  if (quality === 'dim') return levelDef.dim;
  if (quality === 'min') return levelDef.min;
  if (degIdx === 4)      return levelDef.V;
  return levelDef.maj;
}

// 규칙 기반 GPS 루트 계산 (즉각, API 불필요)
function getLocalGPSRoutes(curChord, chords, selGenre, levelDef) {
  const degIdx = chords.findIndex(c => c.note === curChord.note);
  if (degIdx < 0) return [];

  const genreOrder = [selGenre, ...Object.keys(GENRE_PATTERNS).filter(g => g !== selGenre)];
  const routes     = [];
  const seen       = new Set();

  for (const genre of genreOrder) {
    if (routes.length >= 3) break;
    for (const { pattern, mood, tip } of (GENRE_PATTERNS[genre] || [])) {
      if (routes.length >= 3) break;
      const pos = pattern.indexOf(degIdx);
      if (pos < 0) continue;
      const key = pattern.join('-');
      if (seen.has(key)) continue;

      const tail      = pattern.slice(pos + 1);
      const remaining = tail.length >= 2 ? tail : [...tail, ...pattern.slice(0, Math.max(0, pos))];
      const routeChords = remaining.slice(0, 4).map(di => {
        const ch = chords[di];
        if (!ch) return null;
        return ch.note + getLevelSuffixStatic(ch.quality, di, levelDef);
      }).filter(Boolean);

      if (routeChords.length >= 2) {
        const degPath = [degIdx, ...remaining.slice(0, routeChords.length)]
          .map(d => DEG_NAMES[d] ?? '?').join('→');
        routes.push({
          genre: GENRE_PROGS[genre]?.name || genre,
          mood,
          chords: routeChords,
          tip: `${tip}  ${degPath}`,
        });
        seen.add(key);
      }
    }
  }
  return routes;
}

// ── GPS 루트 API 호출 ────────────────────────────────────────────
async function fetchGPSRoutes({ progression, curChord, activeKey, selMode, selLevel, selGenre, apiKey }) {
  const progStr   = progression.length ? progression.map(p => p.name).join(' → ') : '(시작)';
  const levelStr  = selLevel === 'beginner' ? '입문' : selLevel === 'mid' ? '중급' : '재즈';
  const genreName = GENRE_PROGS[selGenre]?.name || '팝';

  const prompt = `너는 음악가를 위한 코드 진행 GPS야. 현재 상황을 보고 앞으로 가능한 루트 3가지를 제시해.

현재 진행: ${progStr}
현재 코드: ${curChord.name}
키: ${activeKey} ${selMode === 'major' ? '장조' : '단조'}
레벨: ${levelStr}
선호 장르: ${genreName}

"${curChord.name}" 다음에 이어갈 수 있는 루트 3가지. 각 루트는 앞으로의 코드 3~4개.
레벨에 맞는 코드 복잡도를 사용할 것 (입문=기본코드, 중급=7th, 재즈=텐션).
JSON만 응답, 다른 텍스트 없이:
{"routes":[{"genre":"장르","mood":"분위기","chords":["코드1","코드2","코드3"],"tip":"한 줄 설명"},{"genre":"장르2","mood":"분위기2","chords":["코드1","코드2","코드3","코드4"],"tip":"설명"},{"genre":"장르3","mood":"분위기3","chords":["코드1","코드2","코드3"],"tip":"설명"}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.content[0].text.replace(/```json|```/g, '').trim();
  return JSON.parse(text).routes;
}

// ── 기법 제안 계산 ─────────────────────────────────────────────
function getTechniques(curChord, chords) {
  if (!curChord) return [];
  const r      = ki(curChord.note);
  const degIdx = chords.findIndex(c => c.note === curChord.note);
  const groups = [];

  // 1. 대리코드
  const subs = [];
  if (degIdx === 0 && chords[5])
    subs.push({ label: chords[5].name, note: chords[5].note, quality: chords[5].quality, hint: 'VI 대리' });
  if (degIdx === 5 && chords[0])
    subs.push({ label: chords[0].name, note: chords[0].note, quality: chords[0].quality, hint: 'I 대리' });
  if (degIdx === 4) {
    const tNote = NOTES[(r + 6) % 12];
    subs.push({ label: tNote + '7', note: tNote, quality: 'maj', hint: '삼전음' });
    if (chords[1]) subs.push({ label: chords[1].name, note: chords[1].note, quality: chords[1].quality, hint: 'II-V' });
  }
  if (degIdx === 1 && chords[3])
    subs.push({ label: chords[3].name, note: chords[3].note, quality: chords[3].quality, hint: 'IV 대리' });
  if (subs.length) groups.push({
    type: '대리코드',
    desc: `${curChord.name} 자리를 대신할 수 있는 코드`,
    items: subs,
    useAll: true,
  });

  // 2. 클리셰 (동일 근음 · 3음 반음 하강)
  if (curChord.quality === 'maj') {
    groups.push({
      type: '클리셰',
      desc: '동일 근음, 3음이 반음씩 하강',
      items: [
        { label: curChord.note,        note: curChord.note, quality: 'maj', hint: '원코드' },
        { label: curChord.note + 'm',  note: curChord.note, quality: 'min', hint: '3음↓' },
        { label: curChord.note + 'm7', note: curChord.note, quality: 'min', hint: '+7' },
      ],
      useAll: true,
    });
  }

  // 3. 베이스 하강 (I 도에서)
  if (degIdx === 0) {
    const b7 = NOTES[(r + 11) % 12];
    const b6 = NOTES[(r + 9)  % 12];
    const b5 = NOTES[(r + 7)  % 12];
    const vi = chords[5];
    groups.push({
      type: '베이스 하강',
      desc: `${curChord.note} → /${b7} → /${b6} → /${b5}`,
      items: [
        { label: curChord.note,              note: curChord.note, quality: 'maj', hint: '루트' },
        { label: `${curChord.note}/${b7}`,   note: curChord.note, quality: 'maj', hint: b7      },
        { label: vi ? `${vi.name}/${b6}` : `?/${b6}`, note: vi?.note, quality: 'min', hint: b6  },
        { label: vi ? `${vi.name}/${b5}` : `?/${b5}`, note: vi?.note, quality: 'min', hint: b5  },
      ].filter(i => i.note),
      useAll: true,
    });
  }

  // 4. 페달 포인트 — 같은 베이스 위에서 움직이는 코드들
  const pedNote  = curChord.note;
  const pedItems = [degIdx, 3, 4, 5]
    .filter((di, i, arr) => arr.indexOf(di) === i && chords[di])
    .slice(0, 3)
    .map(di => {
      const ch = chords[di];
      return {
        label: di === degIdx ? ch.note : `${ch.note}/${pedNote}`,
        note:  ch.note,
        quality: ch.quality,
        hint:  di === degIdx ? '페달 루트' : `/${pedNote}`,
      };
    });
  groups.push({
    type: '페달 포인트',
    desc: `${pedNote}음을 유지하며 상성부만 진행`,
    items: pedItems,
    useAll: true,
  });

  // 5. 코드 쪼개기 (Secondary Dominant 삽입)
  const nextIdxArr = NEXT_FROM[degIdx] || [];
  if (nextIdxArr.length) {
    const nextChord = chords[nextIdxArr[0]];
    if (nextChord) {
      const sdNote = NOTES[(ki(nextChord.note) + 7) % 12];
      groups.push({
        type: '코드 쪼개기',
        desc: `${nextChord.name} 앞 경과 코드`,
        items: [{ label: sdNote + '7', note: sdNote, quality: 'maj', hint: `→${nextChord.name}` }],
      });
    }
  }

  return groups;
}

export default function ChordsTab({ onTranspose }) {
  const {
    activeKey, selMode, transKey, setTransKey,
    selKey, setSelKey, setSelMode,
    curChord, setCurChord, curVar, setCurVar,
    progression, setProgression, playChord,
    curInstr, setCurInstr,
    selLevel, selGenre,
    bpm, setBpm, vol,
    saved, loadSaved, saveProg, deleteSaved,
    maxProg, setMaxProg,
    measureBreaks, setMeasureBreaks,
    apiKey,
  } = useApp();

  const gpsTimerRef    = useRef(null);
  const ivRef          = useRef(null);
  const playingRef     = useRef(false);
  const [gpsRoutes,    setGpsRoutes]    = useState([]);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [diagPosIdx,   setDiagPosIdx]   = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [playIdx,      setPlayIdx]      = useState(-1);
  const [playShapeIdx, setPlayShapeIdx] = useState(0);
  const [showSaved,    setShowSaved]    = useState(false);

  const chords = getChords(activeKey, selMode);
  const levelDef  = LEVEL_DEFAULT[selLevel]  || LEVEL_DEFAULT.mid;
  const levelVars = LEVEL_VARS[selLevel]     || LEVEL_VARS.mid;

  // 레벨에 맞는 기본 변형 접미사 반환 (V도는 7, 나머지는 질에 따라)
  function getLevelSuffix(quality, degIdx) {
    if (quality === 'dim') return levelDef.dim;
    if (quality === 'min') return levelDef.min;
    // V도 (인덱스 4) = 도미넌트
    if (degIdx === 4) return levelDef.V;
    return levelDef.maj;
  }

  // 현재 선택된 코드의 다이아토닉 인덱스
  const curDegIdx = curChord
    ? chords.findIndex(c => c.name === curChord.name || c.note === curChord.note)
    : -1;

  // 예측 다음 코드 인덱스
  // note 기준으로 매칭 (변형코드 선택 시에도 예측 유지)
  const predictedIdxs = curChord
    ? (NEXT_FROM[chords.findIndex(c => c.note === curChord.note)] || []).slice(0, 3)
    : [];

  function selectChord(c) {
    const degIdx = chords.findIndex(ch => ch.note === c.note);
    const suffix = getLevelSuffix(c.quality, degIdx);
    const levelName = c.note + suffix;
    const levelChord = { name: levelName, note: c.note, quality: c.quality };
    setCurChord(levelChord);
    setCurVar(suffix);
    playChord(c.note, suffix, c.quality);
    setProgression(prev =>
      prev.length < maxProg
        ? [...prev, { name: levelName, note: c.note, quality: c.quality, variant: suffix }]
        : prev
    );
  }

  function selectVariant(note, quality, v) {
    const name = note + (v || '');
    setCurChord({ name, note, quality });
    setCurVar(v);
    playChord(note, v, quality);
  }

  function removeFromHistory(i) {
    setProgression(prev => prev.filter((_, idx) => idx !== i));
    setMeasureBreaks(prev => {
      const adjusted = prev.map(b => b > i ? b - 1 : b);
      return adjusted.filter((b, idx) => idx === 0 || b > adjusted[idx - 1]);
    });
  }

  function addMeasure() {
    if (progression.length === 0) return;
    const last = measureBreaks[measureBreaks.length - 1];
    if (last === progression.length) return; // 현재 마디가 이미 비어 있음
    setMeasureBreaks(prev => [...prev, progression.length]);
  }

  function clearHistory() {
    setProgression([]);
    setCurChord(null);
    setCurVar('');
    setMeasureBreaks([0]);
  }

  // 코드 변경 시 다이어그램 포지션 리셋
  useEffect(() => { setDiagPosIdx(0); }, [curChord?.name, curVar]);
  // unmount 시 재생 정리
  useEffect(() => () => { if (ivRef.current) clearTimeout(ivRef.current); }, []);

  // GPS 루트 실시간 업데이트
  useEffect(() => {
    if (!curChord) { setGpsRoutes([]); return; }

    // 규칙 기반 루트는 즉각 표시
    const localRoutes = getLocalGPSRoutes(curChord, chords, selGenre, levelDef);
    setGpsRoutes(localRoutes);

    // API 키 있으면 AI 루트로 교체 (debounce)
    if (!apiKey) return;
    if (gpsTimerRef.current) clearTimeout(gpsTimerRef.current);
    gpsTimerRef.current = setTimeout(async () => {
      setGpsLoading(true);
      try {
        const aiRoutes = await fetchGPSRoutes({
          progression, curChord, activeKey, selMode, selLevel, selGenre, apiKey,
        });
        if (aiRoutes?.length) setGpsRoutes(aiRoutes);
      } catch (_) {
        // API 실패 시 로컬 루트 유지
      } finally {
        setGpsLoading(false);
      }
    }, 700);
    return () => clearTimeout(gpsTimerRef.current);
  }, [curChord?.name, activeKey, selMode, selLevel, selGenre]);

  // 루트 전체를 진행에 추가
  function applyRoute(route) {
    setProgression(prev => {
      const space = maxProg - prev.length;
      if (space <= 0) return prev;
      const toAdd = route.chords.slice(0, space).map(name => {
        const note    = name.replace(/m7?|maj7|°|add9|sus[24]|[679]|ø7/g, '') || name;
        const quality = name.includes('m') && !name.includes('maj') ? 'min'
                      : name.includes('°') ? 'dim' : 'maj';
        return { name, note, quality, variant: '' };
      });
      return [...prev, ...toAdd];
    });
  }

  // 히스토리 칩 탭 → 그 코드로 이동 (진행에 추가 없이 네비게이션만)
  function navigateToHistChord(p) {
    setCurChord({ name: p.name, note: p.note, quality: p.quality });
    setCurVar(p.variant || '');
    playChord(p.note, p.variant || '', p.quality);
  }

  function addTechChord(item) {
    if (!item?.note) return;
    const chord = { name: item.label, note: item.note, quality: item.quality };
    setCurChord(chord);
    setCurVar('');
    playChord(item.note, '', item.quality);
    setProgression(prev =>
      prev.length < maxProg
        ? [...prev, { name: item.label, note: item.note, quality: item.quality, variant: '' }]
        : prev
    );
  }

  // 현재 코드 자리를 기법 시퀀스로 교체 (마지막 항목이 현재 코드면 교체, 아니면 추가)
  function replaceWithTech(items) {
    if (!items?.length) return;
    setProgression(prev => {
      const last  = prev[prev.length - 1];
      const isCur = last && curChord && last.note === curChord.note;
      const base  = isCur ? prev.slice(0, -1) : prev;
      const space = maxProg - base.length;
      if (space <= 0) return prev;
      return [
        ...base,
        ...items.slice(0, space).map(item => ({
          name: item.label, note: item.note, quality: item.quality, variant: '',
        })),
      ];
    });
    // 마지막 추가 코드로 커서 이동
    const last = items[items.length - 1];
    if (last?.note) {
      setCurChord({ name: last.label, note: last.note, quality: last.quality });
      setCurVar('');
      playChord(last.note, '', last.quality);
    }
  }

  // ── 마디 삭제 ─────────────────────────────────────────────────
  function deleteMeasure(mIdx) {
    const startIdx = measureBreaks[mIdx];
    const endIdx   = mIdx + 1 < measureBreaks.length
      ? measureBreaks[mIdx + 1]
      : progression.length;
    const count = endIdx - startIdx;
    setProgression(prev => prev.filter((_, i) => i < startIdx || i >= endIdx));
    setMeasureBreaks(prev => {
      const next = prev
        .filter((_, i) => i !== mIdx)
        .map(b => b > startIdx ? b - count : b);
      return next.length > 0 ? next : [0];
    });
    setMaxProg(prev => Math.max(16, prev - Math.max(count, 4)));
  }

  // ── 재생 (진행) ───────────────────────────────────────────────
  function getChordBeats(prog, breaks) {
    const beats = new Array(prog.length).fill(1);
    breaks.forEach((si, mIdx) => {
      const ei    = mIdx + 1 < breaks.length ? breaks[mIdx + 1] : prog.length;
      const count = ei - si;
      if (count <= 0) return;
      for (let i = si; i < ei; i++) {
        if (count === 1)      beats[i] = 4;
        else if (count === 2) beats[i] = 2;
        else if (count === 3) beats[i] = (i === si) ? 2 : 1;
        else                  beats[i] = 4 / count;
      }
    });
    return beats;
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
      idx++;
      ivRef.current = setTimeout(tick, (beats[pos] || 1) * beatMs);
    }
    tick();
    setPlaying(true);
  }

  // ── 저장/불러오기 ──────────────────────────────────────────────
  async function handleSave() {
    const ok = await saveProg();
    if (ok) { loadSaved(); setShowSaved(true); }
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
    setMeasureBreaks([0]);
    setMaxProg(16);
    setShowSaved(false);
  }

  function confirmDeleteSaved(i) {
    Alert.alert('삭제', '이 진행을 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteSaved(i) },
    ]);
  }

  // ── 기법 시퀀스 순차 재생 (BPM 기준 1비트 간격)
  function playTechSequence(items) {
    const beatMs = 60000 / bpm;
    items.forEach((item, i) => {
      setTimeout(() => {
        if (item?.note) playChord(item.note, '', item.quality);
      }, i * beatMs);
    });
  }

  const subs     = curChord ? getSubstitutes(curChord.name, chords) : [];
  const tones    = curChord ? getChordTones(curChord.note, curVar, curChord.quality) : [];
  const variants = curChord ? (levelVars[curChord.quality] || levelVars.maj) : [];

  // 추천 진행 (하단 고정)
  const c = i => chords[i]?.name || '';
  const suggestions = [
    { label: 'I-V-VI-IV', prog: [c(0), c(4), c(5), c(3)] },
    { label: 'I-IV-V-I',  prog: [c(0), c(3), c(4), c(0)] },
    { label: 'II-V-I',    prog: [c(1), c(4), c(0)] },
  ];

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* ── 내 진행 ── */}
      <View style={styles.histSection}>
        {/* 헤더: 제목 + 재생/저장/불러오기/초기화 */}
        <View style={styles.histHeader}>
          <Text style={styles.miniLabel}>내 진행 ({progression.length}/{maxProg})</Text>
          <View style={styles.histControls}>
            {progression.length > 0 && (
              <TouchableOpacity
                style={[styles.ctrlBtn, playing && styles.ctrlBtnStop]}
                onPress={playing ? stopPlay : startPlay}>
                <Text style={[styles.ctrlBtnTxt, playing && styles.ctrlBtnStopTxt]}>
                  {playing ? '■' : '▶'}
                </Text>
              </TouchableOpacity>
            )}
            {/* BPM ± */}
            {progression.length > 0 && (
              <View style={styles.bpmInline}>
                <TouchableOpacity onPress={() => setBpm(b => Math.max(40, b - 5))} style={styles.bpmAdjBtn}>
                  <Text style={styles.bpmAdjTxt}>−</Text>
                </TouchableOpacity>
                <Text style={styles.bpmInlineTxt}>{bpm}</Text>
                <TouchableOpacity onPress={() => setBpm(b => Math.min(200, b + 5))} style={styles.bpmAdjBtn}>
                  <Text style={styles.bpmAdjTxt}>+</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleSave}>
              <Text style={styles.ctrlBtnTxt}>☆</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, showSaved && styles.ctrlBtnActive]}
              onPress={() => { loadSaved(); setShowSaved(v => !v); }}>
              <Text style={[styles.ctrlBtnTxt, showSaved && styles.ctrlBtnActiveTxt]}>↑</Text>
            </TouchableOpacity>
            {progression.length > 0 && (
              <TouchableOpacity style={styles.ctrlBtn} onPress={clearHistory}>
                <Text style={styles.ctrlBtnTxt}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 저장된 진행 목록 */}
        {showSaved && (
          <View style={styles.savedList}>
            {!saved.length
              ? <Text style={styles.savedEmpty}>저장된 진행 없음</Text>
              : saved.map((p, i) => (
                  <TouchableOpacity key={i} style={styles.savedItem} onPress={() => handleLoad(p)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.savedMeta}>{p.key} {p.mode === 'major' ? '장' : '단'}조 · {p.date}</Text>
                      <Text style={styles.savedChords} numberOfLines={1}>
                        {p.chords.map(n => flatChordName(n, p.key, p.mode)).join(' → ')}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => confirmDeleteSaved(i)} hitSlop={{top:6,bottom:6,left:6,right:6}}>
                      <Text style={styles.savedDel}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
            }
          </View>
        )}

        {/* 마디들 */}
        {progression.length > 0 ? (
          <View style={styles.measuresRow}>
            {measureBreaks.map((startIdx, mIdx) => {
              const endIdx = mIdx + 1 < measureBreaks.length
                ? measureBreaks[mIdx + 1]
                : progression.length;
              const slice  = progression.slice(startIdx, endIdx);
              const isLast = mIdx === measureBreaks.length - 1;
              return (
                <View key={mIdx} style={[styles.measureBlock, mIdx > 0 && styles.measureBlockSep]}>
                  <View style={styles.measureHeaderRow}>
                    <Text style={styles.measureLabel}>마디 {mIdx + 1}</Text>
                    <View style={{ flexDirection:'row', gap:4 }}>
                      {isLast && (
                        <TouchableOpacity onPress={addMeasure} style={styles.addMeasureBtn}>
                          <Text style={styles.addMeasureBtnText}>+</Text>
                        </TouchableOpacity>
                      )}
                      {/* 빈 마디이거나 2번째 이상 마디는 삭제 가능 */}
                      {(mIdx > 0 || slice.length === 0) && (
                        <TouchableOpacity onPress={() => deleteMeasure(mIdx)} style={styles.delMeasureBtn}>
                          <Text style={styles.delMeasureBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {slice.length === 0
                    ? <Text style={styles.emptyMeasureTxt}>빈 마디</Text>
                    : (
                      <View style={styles.measureChips}>
                        {slice.map((p, si) => {
                          const i       = startIdx + si;
                          const isActive  = curChord?.note === p.note;
                          const isLatest  = i === progression.length - 1;
                          const isPlaying = playIdx === i;
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.histChip,
                                isLatest  && styles.histChipLast,
                                isActive  && styles.histChipActive,
                                isPlaying && styles.histChipPlaying,
                              ]}
                              onPress={() => navigateToHistChord(p)}>
                              <Text style={[
                                styles.histName,
                                isLatest  && styles.histNameLast,
                                isActive  && styles.histNameActive,
                                isPlaying && styles.histNamePlaying,
                              ]}>
                                {flatChordName(p.name, activeKey, selMode)}
                              </Text>
                              <TouchableOpacity onPress={() => removeFromHistory(i)} hitSlop={{top:6,bottom:6,left:4,right:4}}>
                                <Text style={styles.histX}>✕</Text>
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )
                  }
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.histEmptyTxt}>코드를 선택하면 진행이 쌓입니다</Text>
        )}

        {/* 재생 중 운지 */}
        {playing && playIdx >= 0 && progression[playIdx] && (() => {
          const pc     = progression[playIdx];
          const shapes = getGuitarShapes(pc.name, pc.note, pc.quality, pc.variant);
          const shape  = shapes[playShapeIdx] || shapes[0] || null;
          const vk     = getVariantKey(pc.variant, pc.quality);
          const pianoIvs = VAR_IV[vk] || (pc.quality === 'min' ? [0,3,7] : [0,4,7]);
          return (
            <View style={styles.playingFingering}>
              <View style={styles.fingeringHdr}>
                <Text style={styles.fingeringName}>{flatChordName(pc.name, activeKey, selMode)}</Text>
                <View style={{ flexDirection:'row', gap:5 }}>
                  {['guitar','piano'].map(instr => (
                    <TouchableOpacity key={instr}
                      style={[styles.instrBtn, curInstr === instr && styles.instrBtnSel]}
                      onPress={() => { setCurInstr(instr); setPlayShapeIdx(0); }}>
                      <Text style={[styles.instrBtnText, curInstr === instr && styles.instrBtnTextSel]}>
                        {instr === 'guitar' ? '기타' : '피아노'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {curInstr === 'guitar' && shapes.length > 1 && (
                <View style={styles.posRow}>
                  {shapes.map((s, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.posBtn, playShapeIdx === i && styles.posBtnSel]}
                      onPress={() => setPlayShapeIdx(i)}>
                      <Text style={[styles.posBtnText, playShapeIdx === i && styles.posBtnTextSel]}>{s.pos}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <View style={styles.diagWrap}>
                {curInstr === 'guitar'
                  ? <GuitarDiagram shape={shape} name={pc.name} displayName={flatChordName(pc.name, activeKey, selMode)} posLabel={shape?.pos} />
                  : <PianoDiagram rootNote={pc.note} chordIntervals={pianoIvs} name={pc.name} />
                }
              </View>
            </View>
          );
        })()}
      </View>

      {/* ── 추천 진행 ── */}
      <View style={styles.sugSection}>
        <Text style={styles.sugSectionLabel}>추천 진행</Text>
        <View style={styles.sugList}>
          {suggestions.map((s, i) => (
            <View key={i} style={styles.sugRow}>
              <Text style={styles.sugLabel}>{s.label}</Text>
              <View style={styles.sugChords}>
                {s.prog.map((name, j) => {
                  const isInMyProg = progression.some(p => p.note === name.replace(/m$|m7$|°$/,''));
                  return (
                    <React.Fragment key={j}>
                      {j > 0 && <Text style={styles.sugArrow}>→</Text>}
                      <Text style={[styles.sugChord, isInMyProg && styles.sugChordHighlight]}>
                        {flatChordName(name, activeKey, selMode)}
                      </Text>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ── 전조 / 헤더 ── */}
      <View style={styles.row}>
        <Text style={styles.label}>다이아토닉 코드</Text>
        {transKey && <View style={styles.badge}><Text style={styles.badgeText}>→{transKey}</Text></View>}
        {transKey && (
          <TouchableOpacity style={styles.smBtn} onPress={() => setTransKey(null)}>
            <Text style={styles.smBtnText}>✕ 전조 해제</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.smBtn} onPress={onTranspose}>
          <Text style={styles.smBtnText}>🎵 전조</Text>
        </TouchableOpacity>
      </View>

      {/* ── 다이아토닉 코드 버튼 ── */}
      <View style={styles.chordGrid}>
        {chords.map((c2, idx) => {
          const isSelected  = curChord?.note === c2.note;
          const isPredicted = predictedIdxs.includes(idx);
          const inProg      = progression.some(p => p.note === c2.note);
          const suffix      = getLevelSuffix(c2.quality, idx);
          const displayName = flatChordName(c2.note + suffix, activeKey, selMode);

          return (
            <TouchableOpacity
              key={c2.name}
              style={[
                styles.chordBtn,
                isSelected  && styles.chordBtnSelected,
                isPredicted && !isSelected && styles.chordBtnPredicted,
              ]}
              onPress={() => selectChord(c2)}>
              {isPredicted && !isSelected && (
                <Text style={styles.predictArrow}>↑</Text>
              )}
              <Text style={styles.chordDeg}>{c2.degree}</Text>
              <Text style={[
                styles.chordName,
                isSelected  && styles.chordNameSelected,
                isPredicted && !isSelected && styles.chordNamePredicted,
              ]}>
                {displayName}
              </Text>
              {/* 진행에 있음 표시 */}
              {inProg && <View style={styles.inProgDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 예측 안내 텍스트 ── */}
      {curChord && predictedIdxs.length > 0 && (
        <View style={styles.predBox}>
          <Text style={styles.predLabel}>다음 추천 ›</Text>
          <Text style={styles.predChords}>
            {predictedIdxs.map(i => flatChordName(chords[i]?.name, activeKey, selMode)).join('  ·  ')}
          </Text>
        </View>
      )}

      {/* ── GPS 루트 ── */}
      {curChord && (
        <View style={styles.gpsSection}>
          <View style={styles.gpsHeader}>
            <Text style={styles.gpsDot}>◉</Text>
            <Text style={styles.gpsTitle}>GPS 루트</Text>
            {gpsLoading
              ? <ActivityIndicator size="small" color={COLORS.blue} style={{ marginLeft: 6 }} />
              : <Text style={styles.gpsSrc}>{apiKey ? 'AI' : '규칙'}</Text>
            }
          </View>
          {gpsRoutes.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {gpsRoutes.map((route, ri) => {
                const routeColor = ri === 0 ? COLORS.blue
                  : ri === 1 ? COLORS.purple : COLORS.green;
                return (
                  <View key={ri} style={[styles.gpsCard, { borderColor: routeColor }]}>
                    <View style={styles.gpsCardTop}>
                      <View style={[styles.gpsGenreBadge, { backgroundColor: routeColor + '22' }]}>
                        <Text style={[styles.gpsGenreText, { color: routeColor }]}>{route.genre}</Text>
                      </View>
                      <Text style={styles.gpsMood}>{route.mood}</Text>
                    </View>
                    {/* 코드 흐름 */}
                    <View style={styles.gpsChordRow}>
                      <Text style={[styles.gpsCurChord, { color: routeColor }]}>{flatChordName(curChord.name, activeKey, selMode)}</Text>
                      <Text style={styles.gpsArrow}>→</Text>
                      {route.chords.map((ch, ci) => (
                        <React.Fragment key={ci}>
                          <TouchableOpacity
                            style={[styles.gpsChordChip, { borderColor: routeColor }]}
                            onPress={() => {
                              const note = ch.replace(/m7?|maj7|°|add9|sus[24]|[679]|ø7/g,'') || ch;
                              const qual = ch.includes('m') && !ch.includes('maj') ? 'min'
                                         : ch.includes('°') ? 'dim' : 'maj';
                              selectChord({ note, quality: qual, degree: '', name: ch });
                            }}>
                            <Text style={[styles.gpsChordText, { color: routeColor }]}>{flatChordName(ch, activeKey, selMode)}</Text>
                          </TouchableOpacity>
                          {ci < route.chords.length - 1 && (
                            <Text style={styles.gpsArrow}>→</Text>
                          )}
                        </React.Fragment>
                      ))}
                    </View>
                    {/* 팁 + 루트 버튼 */}
                    <View style={styles.gpsCardBottom}>
                      <Text style={styles.gpsTip} numberOfLines={1}>{route.tip}</Text>
                      <TouchableOpacity
                        style={[styles.gpsApplyBtn, { borderColor: routeColor }]}
                        onPress={() => applyRoute(route)}>
                        <Text style={[styles.gpsApplyText, { color: routeColor }]}>이 루트로</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* ── 변형 코드 ── */}
      {curChord && (
        <>
          <Text style={[styles.label, { marginTop: 14 }]}>변형 코드</Text>
          <View style={styles.varRow}>
            {variants.map((v, vi) => {
              const vName  = curChord.note + (v || '');
              const active = curVar === v;
              const label  = vi === 0 ? vName + ' (기본)' : vName;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.varBtn, active && styles.varBtnActive]}
                  onPress={() => selectVariant(curChord.note, curChord.quality, v)}>
                  <Text style={[styles.varBtnText, active && styles.varBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* ── 코드 정보 ── */}
      {curChord ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{curChord.name}</Text>
          <Text style={styles.infoText}>구성음: {tones.join(' · ')}</Text>
          {subs.length > 0 && (
            <Text style={styles.infoText}>대리코드: {subs.join(', ')}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>코드를 선택하면 진행이 쌓입니다</Text>
      )}

      {/* ── 기법 제안 ── */}
      {curChord && (() => {
        const techs = getTechniques(curChord, chords);
        return techs.length > 0 ? (
          <View style={styles.techSection}>
            <Text style={[styles.label, { marginTop: 14 }]}>기법 제안</Text>
            {techs.map((g, gi) => (
              <View key={gi} style={styles.techGroup}>
                <View style={styles.techHeader}>
                  <Text style={styles.techType}>{g.type}</Text>
                  {g.desc ? <Text style={styles.techDesc}>{g.desc}</Text> : null}
                  {g.useAll && g.items.length >= 1 && (
                    <View style={{ flexDirection: 'row', gap: 5 }}>
                      <TouchableOpacity
                        style={styles.techPlayBtn}
                        onPress={() => playTechSequence(g.items)}>
                        <Text style={styles.techPlayBtnText}>▶</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.techUseBtn}
                        onPress={() => replaceWithTech(g.items)}>
                        <Text style={styles.techUseBtnText}>→ 사용</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {g.items.length > 0 && (
                  <View style={styles.techItems}>
                    {g.items.map((item, ii) => (
                      <TouchableOpacity
                        key={ii}
                        style={styles.techChip}
                        onPress={() => addTechChord(item)}>
                        <Text style={styles.techChipText}>{item.label}</Text>
                        <Text style={styles.techChipHint}>{item.hint}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : null;
      })()}

      {/* ── 인라인 운지 ── */}
      {curChord && (() => {
        const positions = getGuitarShapes(curChord.name, curChord.note, curChord.quality, curVar);
        const clampedPos = Math.min(diagPosIdx, Math.max(positions.length - 1, 0));
        // 피아노 전위 계산
        const vk = getVariantKey(curVar, curChord.quality);
        const chordIntervals = VAR_IV[vk] || (curChord.quality === 'min' ? [0,3,7] : [0,4,7]);
        const maxInv = Math.min(2, chordIntervals.length - 1);
        const pianoInv = Math.min(diagPosIdx, maxInv);
        const PIANO_LABELS = ['루트 포지션', '1전위', '2전위'];
        return (
          <View style={styles.diagSection}>
            <View style={styles.diagHeader}>
              <Text style={styles.miniLabel}>운지</Text>
              <View style={styles.instrToggle}>
                {['guitar','piano'].map(instr => (
                  <TouchableOpacity
                    key={instr}
                    style={[styles.instrBtn, curInstr === instr && styles.instrBtnSel]}
                    onPress={() => { setCurInstr(instr); setDiagPosIdx(0); }}>
                    <Text style={[styles.instrBtnText, curInstr === instr && styles.instrBtnTextSel]}>
                      {instr === 'guitar' ? '기타' : '피아노'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {curInstr === 'guitar' && positions.length > 1 && (
              <View style={styles.posRow}>
                {positions.map((p, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.posBtn, clampedPos === i && styles.posBtnSel]}
                    onPress={() => setDiagPosIdx(i)}>
                    <Text style={[styles.posBtnText, clampedPos === i && styles.posBtnTextSel]}>
                      {p.pos || `${i + 1}포지션`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {curInstr === 'piano' && (
              <View style={styles.posRow}>
                {PIANO_LABELS.map((label, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.posBtn, pianoInv === i && styles.posBtnSel, i > maxInv && styles.posBtnDis]}
                    onPress={() => i <= maxInv && setDiagPosIdx(i)}
                    disabled={i > maxInv}>
                    <Text style={[styles.posBtnText, pianoInv === i && styles.posBtnTextSel, i > maxInv && styles.posBtnTextDis]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.diagWrap}>
              {curInstr === 'guitar' ? (
                <GuitarDiagram
                  shape={positions[clampedPos] || null}
                  name={curChord.name}
                  displayName={flatChordName(curChord.name, activeKey, selMode)}
                  posLabel={positions[clampedPos]?.pos}
                />
              ) : (
                <>
                  <PianoDiagram
                    name={curChord.name}
                    rootNote={curChord.note}
                    chordIntervals={chordIntervals}
                    inversion={pianoInv}
                  />
                  <Text style={styles.tonesText}>구성음: {tones.join(' · ')}</Text>
                  <Text style={styles.invHint}>
                    {pianoInv === 0 ? '루트 포지션 — 근음이 최저음'
                      : pianoInv === 1 ? '1전위 — 3음이 최저음'
                      : '2전위 — 5음이 최저음'}
                  </Text>
                </>
              )}
            </View>
          </View>
        );
      })()}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },

  // 내 진행
  histSection:    { backgroundColor: COLORS.bg3, borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  histHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  miniLabel:      { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5 },
  histControls:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ctrlBtn:        { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.card },
  ctrlBtnStop:    { borderColor: COLORS.red, backgroundColor: 'rgba(255,80,80,0.1)' },
  ctrlBtnTxt:     { fontSize: 11, color: COLORS.text },
  ctrlBtnStopTxt: { color: COLORS.red },
  ctrlBtnActive:  { borderColor: COLORS.blue, backgroundColor: 'rgba(74,158,255,0.1)' },
  ctrlBtnActiveTxt:{ color: COLORS.blue },
  bpmInline:      { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.card, paddingHorizontal: 4, paddingVertical: 2 },
  bpmInlineTxt:   { fontSize: 10, color: COLORS.text, minWidth: 22, textAlign: 'center' },
  bpmAdjBtn:      { paddingHorizontal: 4 },
  bpmAdjTxt:      { fontSize: 13, color: COLORS.accent, fontWeight: '700' },
  histEmptyTxt:   { fontSize: 11, color: COLORS.text2, textAlign: 'center', paddingVertical: 8 },
  measuresRow:        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  measureBlock:       { marginBottom: 4 },
  measureBlockSep:    { borderLeftWidth: 1, borderLeftColor: COLORS.border, marginLeft: 8, paddingLeft: 8 },
  measureHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  measureLabel:       { fontSize: 9, color: COLORS.text2, letterSpacing: 1 },
  addMeasureBtn:      { paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 4 },
  addMeasureBtnText:  { fontSize: 9, color: COLORS.accent },
  delMeasureBtn:      { paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: COLORS.red, borderRadius: 4 },
  delMeasureBtnText:  { fontSize: 9, color: COLORS.red },
  emptyMeasureTxt:    { fontSize: 9, color: COLORS.text2, fontStyle: 'italic', paddingVertical: 2 },
  measureChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  histChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  histChipLast:   { borderColor: COLORS.accent },
  histChipActive: { borderColor: COLORS.blue, backgroundColor: 'rgba(74,158,255,0.1)' },
  histChipPlaying:{ borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  histName:       { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  histNameLast:   { color: COLORS.accent },
  histNameActive: { color: COLORS.blue },
  histNamePlaying:{ color: '#111' },
  histX:          { fontSize: 10, color: COLORS.text2 },
  // 저장된 진행
  savedList:      { backgroundColor: COLORS.card, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8, padding: 6 },
  savedEmpty:     { fontSize: 11, color: COLORS.text2, textAlign: 'center', paddingVertical: 6 },
  savedItem:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  savedMeta:      { fontSize: 9, color: COLORS.text2, marginBottom: 2 },
  savedChords:    { fontSize: 11, color: COLORS.text },
  savedDel:       { fontSize: 12, color: COLORS.text2, paddingHorizontal: 6 },
  // 재생 중 운지
  playingFingering:{ marginTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10 },
  fingeringHdr:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fingeringName:  { fontSize: 15, color: COLORS.accent, fontWeight: '700' },

  // 헤더
  row:           { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  label:         { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, flex: 1 },
  badge:         { backgroundColor: COLORS.blue, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:     { color: '#fff', fontSize: 10 },
  smBtn:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  smBtnText:     { color: COLORS.text, fontSize: 11 },

  // 코드 그리드 (7개 가로)
  chordGrid:     { flexDirection: 'row', gap: 5, marginBottom: 6 },
  chordBtn:      {
    flex: 1, alignItems: 'center', paddingVertical: 10,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    backgroundColor: COLORS.card, position: 'relative',
  },
  chordBtnSelected:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chordBtnPredicted: {
    borderColor: COLORS.green, borderWidth: 1.5,
    backgroundColor: 'rgba(76,175,80,0.08)',
  },
  chordDeg:      { fontSize: 8, color: COLORS.text2, marginBottom: 2 },
  chordName:     { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  chordNameSelected:  { color: '#111' },
  chordNamePredicted: { color: COLORS.green },
  predictArrow:  { fontSize: 9, color: COLORS.green, position: 'absolute', top: 2, right: 4 },
  inProgDot:     {
    position: 'absolute', bottom: 4, width: 4, height: 4,
    borderRadius: 2, backgroundColor: COLORS.green,
  },

  // 예측 박스
  predBox:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, paddingHorizontal: 10, backgroundColor: 'rgba(76,175,80,0.07)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)', marginBottom: 4, gap: 8 },
  predLabel:     { fontSize: 10, color: COLORS.green, fontWeight: '700' },
  predChords:    { fontSize: 13, color: COLORS.green },

  // 변형
  varRow:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 8 },
  varBtn:        { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.card },
  varBtnActive:  { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.1)' },
  varBtnText:    { fontSize: 11, color: COLORS.text2 },
  varBtnTextActive:{ color: COLORS.purple },

  // 코드 정보
  infoBox:       { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginTop: 4 },
  infoTitle:     { fontSize: 15, color: COLORS.accent, fontWeight: '700', marginBottom: 4 },
  infoText:      { fontSize: 12, color: COLORS.text2, lineHeight: 20 },
  hint:          { fontSize: 12, color: COLORS.text2, marginTop: 12, textAlign: 'center' },

  // 인라인 운지
  diagSection:   { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 10, marginTop: 14 },
  diagHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  instrToggle:   { flexDirection: 'row', gap: 5 },
  instrBtn:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  instrBtnSel:   { borderColor: COLORS.accent, backgroundColor: 'rgba(232,196,106,0.12)' },
  instrBtnText:  { fontSize: 11, color: COLORS.text2 },
  instrBtnTextSel:{ color: COLORS.accent },
  diagWrap:      { alignItems: 'center' },
  posRow:        { flexDirection: 'row', gap: 4, marginBottom: 8 },
  posBtn:        { flex: 1, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.card, alignItems: 'center' },
  posBtnSel:     { borderColor: COLORS.accent, backgroundColor: 'rgba(232,196,106,0.12)' },
  posBtnText:    { fontSize: 10, color: COLORS.text2, textAlign: 'center' },
  posBtnTextSel: { color: COLORS.accent, fontWeight: '700' },
  posBtnDis:     { opacity: 0.35 },
  posBtnTextDis: { color: COLORS.border },
  tonesText:     { fontSize: 11, color: COLORS.text2, marginTop: 8, textAlign: 'center' },
  invHint:       { fontSize: 10, color: COLORS.text2, marginTop: 3, textAlign: 'center', letterSpacing: 0.3 },
  // GPS 루트
  gpsSection:    { marginBottom: 6, marginTop: 2 },
  gpsHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  gpsDot:        { fontSize: 10, color: COLORS.blue },
  gpsTitle:      { fontSize: 10, color: COLORS.blue, fontWeight: '700', letterSpacing: 1.5 },
  gpsSrc:        { fontSize: 9, color: COLORS.text2, marginLeft: 6, letterSpacing: 0.5 },
  gpsCard:       { width: 240, backgroundColor: COLORS.bg3, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  gpsCardTop:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  gpsGenreBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  gpsGenreText:  { fontSize: 10, fontWeight: '700' },
  gpsMood:       { fontSize: 10, color: COLORS.text2 },
  gpsChordRow:   { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  gpsCurChord:   { fontSize: 13, fontWeight: '800' },
  gpsArrow:      { fontSize: 10, color: COLORS.text2 },
  gpsChordChip:  { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderRadius: 6, backgroundColor: 'transparent' },
  gpsChordText:  { fontSize: 13, fontWeight: '600' },
  gpsCardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gpsTip:        { fontSize: 9, color: COLORS.text2, flex: 1, marginRight: 8 },
  gpsApplyBtn:   { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  gpsApplyText:  { fontSize: 10, fontWeight: '700' },
  // 기법 제안
  techSection:   { marginTop: 4 },
  techGroup:     { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, marginBottom: 6 },
  techHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  techType:      { fontSize: 10, color: COLORS.pink, fontWeight: '700', letterSpacing: 0.8 },
  techDesc:      { fontSize: 10, color: COLORS.text2, flex: 1 },
  techItems:     { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  techChip:      { paddingHorizontal: 9, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.pink, borderRadius: 7, backgroundColor: 'rgba(244,114,182,0.08)', alignItems: 'center' },
  techChipText:  { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  techChipHint:  { fontSize: 9, color: COLORS.pink, marginTop: 1 },
  techPlayBtn:    { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: COLORS.green, backgroundColor: 'rgba(76,175,80,0.12)' },
  techPlayBtnText:{ fontSize: 10, color: COLORS.green, fontWeight: '700' },
  techUseBtn:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: COLORS.pink, backgroundColor: 'rgba(244,114,182,0.12)' },
  techUseBtnText:{ fontSize: 10, color: COLORS.pink, fontWeight: '700' },
  // 추천 진행
  sugSection:        { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  sugSectionLabel:   { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5, marginBottom: 6 },
  sugList:           { gap: 5 },
  sugRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sugLabel:          { fontSize: 10, color: COLORS.text2, width: 60 },
  sugChords:         { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  sugArrow:          { color: COLORS.text2, fontSize: 10 },
  sugChord:          { fontSize: 13, color: COLORS.text2 },
  sugChordHighlight: { color: COLORS.accent, fontWeight: '700' },
});
