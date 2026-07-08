import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { usePurchase } from '../context/PurchaseContext';
import { COLORS, LEVEL_DEFAULT, LEVEL_VARS, NOTES, GENRE_PROGS, VAR_IV } from '../data/musicData';
import { getChords, getChordTones, getSubstitutes, ki, getGuitarShapes, getVariantKey, flatChordName, displayChordName,
         chordNameToNote, chordNameToQuality, chordNameToVariant, TO_FLAT, usesFlatDisplay, flatNote,
         pianoVoicingMidis, voiceLeadSequence, pianoVoiceLeadSequence } from '../utils/musicUtils';
import { exportMIDI } from '../utils/midiUtils';
import { SONG_PATTERNS } from '../data/songPatterns';
import GuitarDiagram from '../components/GuitarDiagram';
import PianoDiagram  from '../components/PianoDiagram';
import Purchases from '../utils/purchases';

// AI GPS 백엔드 (Cloudflare Worker) — API 키는 서버에만, 앱엔 없음
const WORKER_URL = 'https://chordnavigator-ai.symptomer.workers.dev';

// 도수별 역할 레이블 (GPS 카드용)
const CHORD_ROLE = {
  0: { label: '안정', color: '#4CAF50' },
  1: { label: '움직임', color: '#2196F3' },
  2: { label: '따뜻함', color: '#FF9800' },
  3: { label: '여유', color: '#9C27B0' },
  4: { label: '긴장', color: '#f44336' },
  5: { label: '감성', color: '#E91E63' },
  6: { label: '불안', color: '#795548' },
};

// 진행 → 도수 배열 변환 후 곡 패턴 매칭
function matchSongPatterns(progression, chords) {
  if (progression.length < 2) return [];
  const degrees = progression.map(p => chords.findIndex(c => c.note === p.note));
  const matched = [];
  for (const sp of SONG_PATTERNS) {
    const len = sp.pattern.length;
    if (len > degrees.length) continue;
    for (let i = 0; i <= degrees.length - len; i++) {
      const match = sp.pattern.every((d, j) => degrees[i + j] === d);
      if (match) { matched.push(...sp.songs); break; }
    }
  }
  return [...new Set(matched)].slice(0, 4);
}

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

// 장르 이모지 맵
const GENRE_EMOJI = {
  pop: '🎵', rock: '🎸', jazz: '🎹', rnb: '🎤', ballad: '💙', bossa: '🌊',
};
const GENRE_KO = {
  pop: '팝', rock: '록', jazz: '재즈', rnb: 'R&B', ballad: '발라드', bossa: '보사노바',
};

// 현재 진행 → 장르 자동 감지 (단일, 하위 호환용)
function detectGenre(progression, chords) {
  const all = detectGenres(progression, chords);
  return all[0] || null;
}

// 현재 진행 → 장르 다중 감지 (상위 3개)
function detectGenres(progression, chords) {
  if (progression.length < 2) return [];
  const degrees = progression.map(p => chords.findIndex(c => c.note === p.note));
  const results = [];
  for (const [genre, patterns] of Object.entries(GENRE_PATTERNS)) {
    let score = 0;
    for (const gp of patterns) {
      const len = gp.pattern.length;
      for (let i = 0; i <= degrees.length - len; i++) {
        if (gp.pattern.every((d, j) => degrees[i + j] === d)) score += len;
      }
    }
    if (score >= 2) results.push({ genre, score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 3).map(r => r.genre);
}

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

function getLevelSuffixStatic(quality, degIdx, levelDef, mode) {
  if (!levelDef) return '';
  if (quality === 'dim') return levelDef.dim;
  if (quality === 'min') return levelDef.min;
  // 도미넌트 7화음 위치: 장조는 V(4), 자연단조는 VII(6) — 자연단조 VII은 C7 같은 도미넌트
  const domIdx = mode === 'minor' ? 6 : 4;
  if (degIdx === domIdx) return levelDef.V;
  return levelDef.maj;
}

// 규칙 기반 GPS 루트 계산 (즉각, API 불필요)
function getLocalGPSRoutes(curChord, chords, selGenre, levelDef, mode) {
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
        return ch.note + getLevelSuffixStatic(ch.quality, di, levelDef, mode);
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
async function fetchGPSRoutes({ progression, curChord, activeKey, selMode, selLevel, selGenre, appUserId, chords }) {
  const levelStr  = selLevel === 'beginner' ? '입문' : selLevel === 'mid' ? '중급' : '재즈';
  const genreName = GENRE_PROGS[selGenre]?.name || '팝';

  // 진행 도수 패턴 문자열
  const degNames  = ['I','II','III','IV','V','VI','VII'];
  const progDeg   = progression.length
    ? progression.map(p => {
        const di = (chords || []).findIndex(c => c.note === p.note);
        return di >= 0 ? degNames[di] : p.name;
      }).join('→')
    : '(시작)';
  const progNames = progression.length
    ? progression.slice(-8).map(p => p.name).join(' → ')
    : '(시작)';

  // 감지된 장르
  const detectedG = (() => {
    if (!chords || progression.length < 2) return null;
    const degrees = progression.map(p => (chords || []).findIndex(c => c.note === p.note));
    let best = null, bestScore = 0;
    for (const [g, patterns] of Object.entries(GENRE_PATTERNS)) {
      let score = 0;
      for (const gp of patterns) {
        const len = gp.pattern.length;
        for (let i = 0; i <= degrees.length - len; i++) {
          if (gp.pattern.every((d, j) => degrees[i + j] === d)) score += len;
        }
      }
      if (score > bestScore) { bestScore = score; best = g; }
    }
    return bestScore >= 2 ? (GENRE_KO[best] || best) : null;
  })();

  // AI GPS = Cloudflare Worker(Gemini) 프록시. 프리미엄 검증·API키는 서버에.
  const res = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'gps',
      appUserId,
      curChord: curChord.name,
      progression: progNames,
      progDeg,
      detectedGenre: detectedG,
      genre: genreName,
      level: levelStr,
      key: activeKey,
      mode: selMode,
    }),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error);   // not_premium / rate_limited / ai_failed → 로컬 루트 유지
  return data.routes;
}

// 코드 품질 → 인터벌 (보이스리딩 운지용)
const QUAL_IV = { maj: [0, 4, 7], min: [0, 3, 7], dim: [0, 3, 6] };

// 기법 시퀀스 items 에 보이스리딩 기타 운지(gShape)를 붙임.
// specs: items와 같은 길이의 [{pcs,bassPc,rootPc}] (음 이어짐·연주가능 운지 계산용)
// 기타 보이스리딩 운지(gShape) 부착. withPiano=true면 피아노 오디오용 pShape도 부착
// (피아노 다이어그램은 라벨 정확성 위해 getSlashBassKeys 사용 — pShape는 베이스가 C 아래로
//  내려가야 하는 베이스하강 오디오에만 필요)
function attachVoiceLed(items, specs, withPiano) {
  if (!items || items.length !== specs.length) return;
  const shapes = voiceLeadSequence(specs);
  if (shapes) items.forEach((it, i) => { if (shapes[i]) it.gShape = shapes[i]; });
  if (withPiano) {
    const pkeys = pianoVoiceLeadSequence(specs);
    if (pkeys) items.forEach((it, i) => { if (pkeys[i]) it.pShape = pkeys[i]; });
  }
}

// ── 기법 제안 계산 ─────────────────────────────────────────────
function getTechniques(curChord, chords, key, mode) {
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
  });

  // 2. 클리셰 — 7음 반음 하강
  const n = curChord.note;
  if (curChord.quality === 'maj') {
    const items = [
      { label: n,          note: n, quality: 'maj', hint: '원코드' },
      { label: n + 'maj7', note: n, quality: 'maj', hint: '7↓' },
      { label: n + '7',    note: n, quality: 'maj', hint: '♭7↓' },
      { label: n + '6',    note: n, quality: 'maj', hint: '6↓' },
    ];
    const t = [r, (r + 4) % 12, (r + 7) % 12]; // 유지 트라이어드
    attachVoiceLed(items, [
      { pcs: t,                    bassPc: r, rootPc: r },
      { pcs: [...t, (r + 11) % 12], bassPc: r, rootPc: r },
      { pcs: [...t, (r + 10) % 12], bassPc: r, rootPc: r },
      { pcs: [...t, (r + 9) % 12],  bassPc: r, rootPc: r },
    ]);
    groups.push({
      type: '클리셰',
      desc: `7음 하강 · ${n} → ${n}maj7 → ${n}7 → ${n}6`,
      items,
      useAll: true,
    });
  } else if (curChord.quality === 'min') {
    const items = [
      { label: n + 'm',   note: n, quality: 'min', hint: '원코드' },
      { label: n + 'mMaj7', note: n, quality: 'min', hint: '7↓' },
      { label: n + 'm7',  note: n, quality: 'min', hint: '♭7↓' },
      { label: n + 'm6',  note: n, quality: 'min', hint: '6↓' },
    ];
    const t = [r, (r + 3) % 12, (r + 7) % 12];
    attachVoiceLed(items, [
      { pcs: t,                    bassPc: r, rootPc: r },
      { pcs: [...t, (r + 11) % 12], bassPc: r, rootPc: r },
      { pcs: [...t, (r + 10) % 12], bassPc: r, rootPc: r },
      { pcs: [...t, (r + 9) % 12],  bassPc: r, rootPc: r },
    ]);
    groups.push({
      type: '클리셰',
      desc: `7음 하강 · ${n}m → ${n}mMaj7 → ${n}m7 → ${n}m6`,
      items,
      useAll: true,
    });
  }

  // 3. 베이스 하강 (I 도에서)
  if (degIdx === 0) {
    const b7 = NOTES[(r + 11) % 12];
    const b6 = NOTES[(r + 9)  % 12];
    const b5 = NOTES[(r + 7)  % 12];
    const vi = chords[5];
    const items = [
      { label: n,                              note: n,        quality: 'maj', hint: '루트' },
      { label: `${n}maj7/${b7}`,               note: n,        quality: 'maj', hint: `/${b7}` },
      { label: vi ? vi.name : '?',             note: vi?.note, quality: 'min', hint: `/${b6}` },
      { label: vi ? `${vi.name}7/${b5}` : '?', note: vi?.note, quality: 'min', hint: `/${b5}` },
    ].filter(i => i.note);
    if (vi && items.length === 4) {
      const vR = ki(vi.note);
      attachVoiceLed(items, [
        { pcs: [r, (r + 4) % 12, (r + 7) % 12],               bassPc: r,            rootPc: r },
        { pcs: [r, (r + 4) % 12, (r + 7) % 12, (r + 11) % 12], bassPc: (r + 11) % 12, rootPc: r },
        { pcs: [vR, (vR + 3) % 12, (vR + 7) % 12],             bassPc: (r + 9) % 12,  rootPc: vR },
        { pcs: [vR, (vR + 3) % 12, (vR + 7) % 12, (vR + 10) % 12], bassPc: (r + 7) % 12, rootPc: vR },
      ], true); // 베이스하강: 피아노 오디오 베이스가 C 아래로 하강해야 하므로 pShape 부착
    }
    groups.push({
      type: '베이스 하강',
      desc: `${n} → ${n}maj7 → ${vi?.name || '?'} → ${vi?.name || '?'}7`,
      items,
      useAll: true,
    });
  }

  // 4. 페달 포인트
  const pedNote  = curChord.note;
  const pedP     = ki(pedNote);
  const pedDis   = [degIdx, 3, 4, 5, 1]
    .filter((di, i, arr) => arr.indexOf(di) === i && chords[di])
    .slice(0, 4);
  const pedItems = pedDis.map(di => {
    const ch = chords[di];
    return {
      label:   di === degIdx ? ch.name : `${ch.name}/${pedNote}`,   // 상위코드 품질 포함 (Dm/A 등)
      note:    di === degIdx ? ch.note : pedNote,   // 슬래시 항목: context는 페달음
      quality: ch.quality,                           // 인터벌 계산용 상위코드 quality 보존
      hint:    di === degIdx ? '페달 루트' : `/${pedNote}`,
    };
  });
  // 페달음(P)을 베이스로 유지하며 상성부만 보이스리딩
  attachVoiceLed(pedItems, pedDis.map(di => {
    const ch = chords[di];
    const uR = ki(ch.note);
    const iv = QUAL_IV[ch.quality] || [0, 4, 7];
    return { pcs: iv.map(x => (uR + x) % 12), bassPc: pedP, rootPc: uR };
  }));
  groups.push({
    type: '페달 포인트',
    desc: `${pedNote}음을 유지하며 상성부만 진행`,
    items: pedItems,
    useAll: true,
  });

  // 5. 세컨더리 도미넌트 — 다음 코드들의 V7
  const nextIdxArr = NEXT_FROM[degIdx] || [];
  const secDomItems = [];
  nextIdxArr.slice(0, 3).forEach(ni => {
    const nc = chords[ni];
    if (!nc) return;
    const sdNote = NOTES[(ki(nc.note) + 7) % 12];
    secDomItems.push({ label: sdNote + '7', note: sdNote, quality: 'maj', hint: `→${nc.name}` });
  });
  if (secDomItems.length) {
    groups.push({
      type: '세컨더리 도미넌트',
      desc: '다음 코드를 향한 V7 — 강한 해결감·긴장감 연출',
      info: '다이아토닉 밖의 dom7이지만 "다음 코드의 V" 역할로 자연스럽게 들림',
      items: secDomItems,
    });
  }

  // 6. 모달 인터체인지 — 평행 조성에서 코드 차용
  if (key && mode) {
    const parallelMode   = mode === 'major' ? 'minor' : 'major';
    const parallelChords = getChords(key, parallelMode);
    const diatonicNotes  = new Set(chords.map(c => c.note));
    const borrowedItems  = [];
    parallelChords.forEach(pc => {
      if (!diatonicNotes.has(pc.note) && borrowedItems.length < 4) {
        borrowedItems.push({
          label:   pc.name,
          note:    pc.note,
          quality: pc.quality,
          hint:    `${parallelMode === 'minor' ? '단조' : '장조'} 차용`,
        });
      }
    });
    if (borrowedItems.length) {
      groups.push({
        type: '모달 인터체인지',
        desc: `평행 ${parallelMode === 'minor' ? '단조' : '장조'}에서 차용 — 색채감·어두움 추가`,
        info: '같은 으뜸음의 다른 조성 코드를 빌려 쓰는 기법. 예: C장조에서 Fm(단조의 IV) 사용',
        items: borrowedItems,
      });
    }
  }

  // 7. 폴리코드 — 두 코드 겹치기
  const polyItems = [];
  const maj3rd = NOTES[(r + 4) % 12];
  const perf5th = NOTES[(r + 7) % 12];
  const min7th  = NOTES[(r + 10) % 12];
  // note: n (현재 코드 루트) → 기법제안 컨텍스트 유지; 피아노 인터벌은 상위코드에서 재파싱
  polyItems.push({ label: `${maj3rd}/${n}`,  note: n, quality: curChord.quality, hint: '장3도 쌓기' });
  polyItems.push({ label: `${perf5th}m/${n}`,note: n, quality: curChord.quality, hint: '5도 쌓기' });
  polyItems.push({ label: `${min7th}/${n}`,  note: n, quality: curChord.quality, hint: '7도 쌓기' });
  groups.push({
    type: '폴리코드',
    desc: `두 코드를 겹쳐 현대적·영화음악 색채 연출`,
    info: '분수 표기 (위/아래): 아래 코드 베이스 위에 위 코드를 쌓음. 피아노·현악에 효과적',
    items: polyItems,
  });

  // 8. 재즈 기법 (Premium) — 턴어라운드
  const I  = chords[0];
  const VI = chords[5];
  const II = chords[1];
  const V  = chords[4];
  if (I && VI && II && V) {
    groups.push({
      type: '턴어라운드',
      desc: 'I-VI-II-V — 재즈 핵심 순환, 자연스럽게 I로 귀결',
      info: '재즈의 가장 기본적인 순환 진행. 어떤 조성에서든 응용 가능',
      items: [
        { label: I.note  + 'maj7', note: I.note,  quality: 'maj', hint: 'I' },
        { label: VI.note + '7',    note: VI.note, quality: 'min', hint: 'VI' },
        { label: II.note + 'm7',   note: II.note, quality: 'min', hint: 'II' },
        { label: V.note  + '7',    note: V.note,  quality: 'maj', hint: 'V' },
      ],
      useAll: true,
      premium: true,
    });
  }

  // 9. 재즈 기법 (Premium) — 트리톤 대리
  if (V) {
    const vIdx       = ki(V.note);
    const triNote    = NOTES[(vIdx + 6) % 12];
    groups.push({
      type: '트리톤 대리',
      desc: `${V.note}7 대신 ${triNote}7 — 반음 하강 베이스라인 생성`,
      info: '도미넌트 7th를 삼전음(6반음) 위의 코드로 교체. 3음↔7음이 서로 교환되어 해결감 유지',
      items: [
        { label: V.note  + '7',  note: V.note,  quality: 'maj', hint: `원래 V7` },
        { label: triNote + '7',  note: triNote, quality: 'maj', hint: `삼전음 대리` },
      ],
      premium: true,
    });
  }

  return groups;
}

// 기법 아이템 라벨 → 실제 재생/진행용 (root·quality·variant·bass) 파싱
// 클리셰: 'Cmaj7' → variant 'maj7' (소리도 maj7) / 페달 슬래시: 'Dm/A' → root D, bass A
// item.note/item.quality 를 그대로 쓰면 클리셰는 전부 같은 3화음, 페달은 베이스음을 루트로
// 잘못 울리므로 반드시 이 함수로 라벨을 재파싱해서 재생/저장해야 한다.
function resolveTechItem(item) {
  const label     = item.label || '';
  const slashIdx  = label.indexOf('/');
  const chordPart = slashIdx >= 0 ? label.slice(0, slashIdx) : label;
  const root      = slashIdx >= 0 ? chordNameToNote(chordPart) : item.note;
  const quality   = slashIdx >= 0 ? chordNameToQuality(chordPart) : item.quality;
  const variant   = chordNameToVariant(chordPart, root);
  const bass      = slashIdx >= 0 ? label.slice(slashIdx + 1) : null;
  return { root, quality, variant, bass };
}

// 개방현 MIDI: 저음E…고음e (GuitarDiagram의 OPEN_PITCH와 동일 피치클래스)
const GUITAR_BASE = [40, 45, 50, 55, 59, 64];

// 화면에 표시되는 운지(기타 shape / 피아노 건반)를 그대로 발음할 MIDI 배열(저음→고음).
// 소리=그림 보장. shape가 없으면 null → 호출부에서 기존 playChord로 폴백.
function displayedVoicingMidis(chord, variant, instr, shapeIdx = 0) {
  if (!chord || (!chord.note && !chord.name)) return null;

  if (instr === 'guitar') {
    // 기법 보이스리딩 운지가 지정돼 있으면 그대로 사용 (소리=그림, 음 이어짐)
    let shape = (chord.shape && chord.shape.frets) ? chord.shape : null;
    if (!shape) {
      const shapes = getGuitarShapes(chord.name, chord.note, chord.quality, variant || '');
      if (!shapes.length) return null;
      shape = shapes[Math.min(shapeIdx, shapes.length - 1)] || shapes[0];
    }
    if (!shape) return null;
    const midis = [];
    shape.frets.forEach((f, i) => { if (f >= 0) midis.push(GUITAR_BASE[i] + f); });
    return midis.length ? midis : null;
  }

  // 피아노 — 기법 보이스리딩 운지가 지정돼 있으면 그 MIDI 사용 (베이스 하행/유지)
  if (chord.pShape && chord.pShape.midis && chord.pShape.midis.length) return chord.pShape.midis;
  // 슬래시면 코드 파트 기준으로 root/quality/variant + 베이스음 분리
  const slashIdx  = chord.name ? chord.name.indexOf('/') : -1;
  const hasSlash  = slashIdx >= 0;
  const slashBass = hasSlash ? chord.name.slice(slashIdx + 1) : null;
  const chordPart = hasSlash ? chord.name.slice(0, slashIdx) : null;
  const root = hasSlash ? chordNameToNote(chordPart) : chord.note;
  const qual = hasSlash ? chordNameToQuality(chordPart) : chord.quality;
  const vrt  = hasSlash ? chordNameToVariant(chordPart, root) : (variant || '');
  const vk   = getVariantKey(vrt, qual);
  const ivs  = VAR_IV[vk] || (qual === 'min' ? [0, 3, 7] : [0, 4, 7]);
  const midis = pianoVoicingMidis(root, ivs, slashBass, 0);
  return midis && midis.length ? midis : null;
}

export default function ChordsTab({ onTranspose }) {
  const {
    activeKey, selMode, transKey, setTransKey,
    selKey, setSelKey, setSelMode,
    curChord, setCurChord, curVar, setCurVar,
    progression, setProgression, playChord, playVoicing,
    curInstr, setCurInstr, strumMode, setStrumMode,
    selLevel, selGenre,
    bpm, setBpm, vol,
    saved, loadSaved, saveProg, deleteSaved,
    maxProg, setMaxProg,
    measureBreaks, setMeasureBreaks,
  } = useApp();

  const { isPremium, showPaywall } = usePurchase();

  const gpsTimerRef    = useRef(null);
  const ivRef          = useRef(null);
  const playingRef     = useRef(false);
  const lastPlayPosRef = useRef(-1);
  const playChordRef   = useRef(playChord);
  const playVoicingRef = useRef(playVoicing);
  const curInstrRef    = useRef(curInstr);
  const bpmRef         = useRef(bpm);
  const scrollRef      = useRef(null);
  useEffect(() => { playChordRef.current = playChord; }, [playChord]);
  useEffect(() => { playVoicingRef.current = playVoicing; }, [playVoicing]);
  useEffect(() => { curInstrRef.current = curInstr; }, [curInstr]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  const [gpsRoutes,    setGpsRoutes]    = useState([]);
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [diagPosIdx,   setDiagPosIdx]   = useState(0);
  const [playing,      setPlaying]      = useState(false);
  const [playIdx,      setPlayIdx]      = useState(-1);
  const [playShapeIdx, setPlayShapeIdx] = useState(0);
  const [showSaved,    setShowSaved]    = useState(false);
  const [editIdx,      setEditIdx]      = useState(null);
  const [techBeatMap,  setTechBeatMap]  = useState({});

  const chords = getChords(activeKey, selMode);
  const levelDef  = LEVEL_DEFAULT[selLevel]  || LEVEL_DEFAULT.mid;
  const levelVars = LEVEL_VARS[selLevel]     || LEVEL_VARS.mid;

  // 레벨에 맞는 기본 변형 접미사 반환 (V도는 7, 나머지는 질에 따라)
  function getLevelSuffix(quality, degIdx) {
    if (quality === 'dim') return levelDef.dim;
    if (quality === 'min') return levelDef.min;
    // 도미넌트 7화음 위치: 장조는 V(4), 자연단조는 VII(6)
    const domIdx = selMode === 'minor' ? 6 : 4;
    if (degIdx === domIdx) return levelDef.V;
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
    const entry = { name: levelName, note: c.note, quality: c.quality, variant: suffix };
    setCurChord({ name: levelName, note: c.note, quality: c.quality });
    setCurVar(suffix);
    playChord(c.note, suffix, c.quality, 60000 / bpm);
    if (editIdx !== null && editIdx < progression.length) {
      setProgression(prev => prev.map((p, i) => i === editIdx ? entry : p));
    } else {
      if (progression.length >= maxProg) return;
      setProgression(prev => [...prev, entry]);
      setEditIdx(null);
      // 마지막 마디가 4코드가 되면 자동으로 새 마디 시작
      const lastBreak = measureBreaks[measureBreaks.length - 1];
      if (progression.length + 1 - lastBreak === 4) {
        setMeasureBreaks(prev => [...prev, progression.length + 1]);
        setMaxProg(prev => prev + 4);
      }
    }
  }

  // 장·단 전환: 현재 코드의 3도를 뒤집어 마이너↔메이저 (Cmaj7↔Cm7, C↔Cm 등)
  function flipCurChordMinor() {
    if (!curChord) { Alert.alert('먼저 코드를 선택하세요'); return; }
    const q = curChord.quality;
    if (q !== 'maj' && q !== 'min') {
      Alert.alert('전환할 수 없어요', '이 코드 종류(감·서스펜디드 등)는 장/단 전환 대상이 아니에요.');
      return;
    }
    const toMin  = q === 'maj';
    const TO_MIN = { '': 'm', 'maj7': 'm7', 'maj9': 'm9', '6': 'm6', '7': 'm7', '9': 'm9', 'add9': 'm', '13': 'm11' };
    const TO_MAJ = { 'm': '', 'm7': 'maj7', 'm9': 'maj9', 'm6': '6', 'm11': 'm9', 'mMaj7': 'maj7' };
    const nv = (toMin ? TO_MIN : TO_MAJ)[curVar || ''];
    if (nv == null) {
      Alert.alert('전환할 수 없어요', `이 코드 종류는 대응하는 ${toMin ? '마이너' : '메이저'} 형태가 없어요.`);
      return;
    }
    const newQual = toMin ? 'min' : 'maj';
    setCurChord({ name: curChord.note + nv, note: curChord.note, quality: newQual });
    setCurVar(nv);
    playChord(curChord.note, nv, newQual, 60000 / bpm);
  }

  // "단조 전환" 버튼 → 적용 범위 선택 (이 코드만 / 키 전체)
  function onMinorConvert() {
    const isMin = selMode === 'minor';
    const curLabel = curChord ? ` (${flatChordName(curChord.note + (curVar || ''), activeKey, selMode)})` : '';
    Alert.alert('장·단 전환', '무엇을 바꿀까요?', [
      { text: `이 코드만${curLabel}`, onPress: flipCurChordMinor },
      { text: isMin ? '키 전체 → 장조' : '키 전체 → 단조', onPress: () => setSelMode(isMin ? 'major' : 'minor') },
      { text: '취소', style: 'cancel' },
    ]);
  }

  function selectVariant(note, quality, v) {
    const name = note + (v || '');
    setCurChord({ name, note, quality });
    setCurVar(v);
    playChord(note, v, quality, 60000 / bpm);
    if (editIdx !== null && editIdx < progression.length) {
      setProgression(prev => prev.map((p, i) =>
        i === editIdx ? { ...p, name, variant: v } : p
      ));
    }
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
    if (last === progression.length) return;
    setMeasureBreaks(prev => [...prev, progression.length]);
    setMaxProg(prev => prev + 4);
    setEditIdx(null);
  }

  function clearHistory() {
    setProgression([]);
    setCurChord(null);
    setCurVar('');
    setMeasureBreaks([0]);
    setEditIdx(null);
  }

  // 코드 변경 시 다이어그램 포지션 리셋
  useEffect(() => { setDiagPosIdx(0); }, [curChord?.name, curVar]);
  // unmount 시 재생 정리
  useEffect(() => () => { if (ivRef.current) clearTimeout(ivRef.current); }, []);

  // GPS 루트 실시간 업데이트
  useEffect(() => {
    if (!curChord) { setGpsRoutes([]); return; }

    // 규칙 기반 루트는 즉각 표시
    const localRoutes = getLocalGPSRoutes(curChord, chords, selGenre, levelDef, selMode);
    setGpsRoutes(localRoutes);

    // 프리미엄이면 AI 루트로 교체 (Worker+Gemini, debounce)
    if (!isPremium) return;
    if (gpsTimerRef.current) clearTimeout(gpsTimerRef.current);
    gpsTimerRef.current = setTimeout(async () => {
      setGpsLoading(true);
      try {
        const appUserId = await Purchases.getAppUserID();
        const aiRoutes = await fetchGPSRoutes({
          progression, curChord, activeKey, selMode, selLevel, selGenre, appUserId, chords,
        });
        if (aiRoutes?.length) setGpsRoutes(aiRoutes);
      } catch (_) {
        // 실패 시 로컬 루트 유지
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
        const note    = name.match(/^[A-G][b#]?/)?.[0] || name;
        const quality = name.includes('m') && !name.includes('maj') ? 'min'
                      : name.includes('°') ? 'dim' : 'maj';
        return { name, note, quality, variant: '' };
      });
      return [...prev, ...toAdd];
    });
  }

  // 화면에 표시되는 운지 그대로 발음 (소리=그림). shape 없으면 일반 코드 재생으로 폴백.
  function playChordView(chord, variant, shapeIdx = 0, arpBeatMs) {
    if (!chord) return;
    const instr = curInstrRef.current;
    const midis = displayedVoicingMidis(chord, variant, instr, shapeIdx);
    if (midis && midis.length) { playVoicingRef.current(midis, arpBeatMs); return; }
    // 폴백: 라벨에서 root/quality/variant/bass 파싱
    const slashIdx = chord.name ? chord.name.indexOf('/') : -1;
    if (slashIdx >= 0) {
      const part = chord.name.slice(0, slashIdx);
      const r = chordNameToNote(part);
      playChordRef.current(r, chordNameToVariant(part, r), chordNameToQuality(part), arpBeatMs, chord.name.slice(slashIdx + 1));
    } else {
      playChordRef.current(chord.note, variant || '', chord.quality, arpBeatMs, null);
    }
  }

  // 히스토리 칩 탭 → 편집 커서를 해당 슬롯으로 이동
  function tapHistChip(p, i) {
    setEditIdx(i);
    setCurChord({ name: p.name, note: p.note, quality: p.quality, shape: p.shape, pShape: p.pShape });
    setCurVar(p.variant || '');
    setDiagPosIdx(0);
    playChordView(p, p.variant || '', 0, 60000 / bpm);
  }

  function addTechChord(item) {
    if (!item?.note) return;
    // 슬래시 코드: 상위코드 루트(F in F/C)에서 variant/재생/진행 파생
    const { root, quality, variant } = resolveTechItem(item);
    // curChord.note = item.note (페달/베이스음) → 기법제안·코드그리드 컨텍스트 유지
    const chord = { name: item.label, note: item.note, quality: item.quality, shape: item.gShape, pShape: item.pShape };
    setCurChord(chord);
    setCurVar(variant);
    setDiagPosIdx(0);
    // 화면에 뜰 운지(보이스리딩) 그대로 발음
    playChordView(chord, variant, 0, 60000 / bpm);
    // 진행에 추가: 재생·히스토리는 상위코드 기준 (+보이스리딩 운지 보존)
    setProgression(prev =>
      prev.length < maxProg
        ? [...prev, { name: item.label, note: root, quality, variant, shape: item.gShape, pShape: item.pShape }]
        : prev
    );
    // 다이어그램으로 자동 스크롤
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
  }

  function replaceWithTech(items, beatValue) {
    if (!items?.length) return;
    setProgression(prev => {
      const last  = prev[prev.length - 1];
      const isCur = last && curChord && last.note === curChord.note;
      const base  = isCur ? prev.slice(0, -1) : prev;
      const space = maxProg - base.length;
      if (space <= 0) return prev;
      return [
        ...base,
        ...items.slice(0, space).map(item => {
          // 라벨 재파싱: 클리셰 variant(maj7/7/6 등)·페달 상위코드 루트를 정확히 저장
          const { root, quality, variant } = resolveTechItem(item);
          return {
            name: item.label, note: root, quality, variant, shape: item.gShape, pShape: item.pShape,
            ...(beatValue != null ? { beats: beatValue } : {}),
          };
        }),
      ];
    });
    // 마지막 추가 코드로 커서 이동
    const last = items[items.length - 1];
    if (last?.note) {
      const { variant } = resolveTechItem(last);
      const chord = { name: last.label, note: last.note, quality: last.quality, shape: last.gShape, pShape: last.pShape };
      setCurChord(chord);
      setCurVar(variant);
      setDiagPosIdx(0);
      playChordView(chord, variant, 0, 60000 / bpm);
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
        if (prog[i]?.beats != null) { beats[i] = prog[i].beats; continue; }
        if (count === 1)      beats[i] = 4;
        else if (count === 2) beats[i] = 2;
        else if (count === 3) beats[i] = (i === si) ? 2 : 1;
        else                  beats[i] = 4 / count;
      }
    });
    return beats;
  }

  function stopPlay() {
    const wasPlaying = playingRef.current;
    if (ivRef.current) clearTimeout(ivRef.current);
    ivRef.current = null;
    playingRef.current = false;
    setPlaying(false);
    // 정지 시 마지막 연주 코드 운지를 그대로 유지 (사라지지 않게)
    if (wasPlaying) {
      const p = progression[lastPlayPosRef.current];
      if (p) {
        setCurChord({ name: p.name, note: p.note, quality: p.quality, shape: p.shape, pShape: p.pShape });
        setCurVar(p.variant || '');
        setDiagPosIdx(0);
      }
    }
    setPlayIdx(-1);
  }

  function startPlay() {
    if (!progression.length) return;
    stopPlay();
    const snap   = [...progression];
    const breaks = [...measureBreaks];
    const beats  = getChordBeats(snap, breaks);
    playingRef.current = true;
    let idx = 0;
    function tick() {
      if (!playingRef.current) return;
      const pos    = idx % snap.length;
      const p      = snap[pos];
      const beatMs = 60000 / bpmRef.current;
      lastPlayPosRef.current = pos;
      // 화면에 표시되는 운지(shape 0)대로 발음 → 소리=그림
      const midis = displayedVoicingMidis(p, p.variant, curInstrRef.current, 0);
      if (midis && midis.length) {
        playVoicingRef.current(midis, beatMs);
      } else {
        const bass = p.name && p.name.includes('/') ? p.name.split('/')[1] : null;
        playChordRef.current(p.note, p.variant, p.quality, beatMs, bass);
      }
      setPlayIdx(pos);
      idx++;
      ivRef.current = setTimeout(tick, (beats[pos] || 1) * (60000 / bpmRef.current));
    }
    tick();
    setPlaying(true);
  }

  // BPM 직접 입력
  function promptBpm() {
    Alert.prompt(
      '템포 설정',
      '40 ~ 200 BPM',
      (val) => {
        const n = parseInt(val, 10);
        if (!isNaN(n)) setBpm(Math.max(40, Math.min(200, n)));
      },
      'plain-text',
      String(bpm),
      'number-pad',
    );
  }

  // ── MIDI 내보내기 ─────────────────────────────────────────────
  async function handleExportMIDI() {
    if (!progression.length) { Alert.alert('진행이 없습니다'); return; }
    try {
      await exportMIDI(progression, bpm);
    } catch (e) {
      Alert.alert('MIDI 내보내기 실패', e.message);
    }
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

  function playTechSequence(items) {
    items.forEach((item, i) => {
      setTimeout(() => {
        if (!item?.note) return;
        const beatMs = 60000 / bpmRef.current;
        // 화면에 뜰 운지(보이스리딩) 그대로 발음
        const { variant } = resolveTechItem(item);
        const chord = { name: item.label, note: item.note, quality: item.quality, shape: item.gShape, pShape: item.pShape };
        playChordView(chord, variant, 0, beatMs);
      }, i * (60000 / bpmRef.current));
    });
  }

  const subs     = curChord ? getSubstitutes(curChord.name, chords) : [];
  // 슬래시 코드(F/C): 구성음은 상위코드(F) 기준으로 계산
  const _tonesNote = curChord?.name?.includes('/')
    ? chordNameToNote(curChord.name.split('/')[0])
    : curChord?.note;
  const tones    = curChord ? getChordTones(_tonesNote, curVar, curChord.quality) : [];

  // 현재 선택된 기타 운지의 실제 발음음 집합 (guitar 모드에서만 구성음 골드/회색 구분)
  const playedNotesForTones = (() => {
    if (!curChord || curInstr !== 'guitar') return null;
    const _OP = [4, 9, 2, 7, 11, 4];
    const pos = getGuitarShapes(curChord.name, curChord.note, curChord.quality, curVar);
    const shape = pos[Math.min(diagPosIdx, Math.max(pos.length - 1, 0))];
    if (!shape) return null;
    return new Set(shape.frets.map((f, i) => f >= 0 ? NOTES[(_OP[i] + f) % 12] : null).filter(Boolean));
  })();
  const variants = curChord ? (levelVars[curChord.quality] || levelVars.maj) : [];
  // 슬래시 코드 베이스음 (F/D → 'D', 플랫 키 반영)
  const _slashRaw = curChord?.name?.includes('/') ? curChord.name.split('/')[1] : null;
  const chordSlashBass = _slashRaw
    ? (usesFlatDisplay(activeKey, selMode) ? (TO_FLAT[_slashRaw] || _slashRaw) : _slashRaw)
    : null;
  const matchedSongs   = matchSongPatterns(progression, chords);
  const detectedGenres = detectGenres(progression, chords);
  const detectedGenre  = detectedGenres[0] || null;
  const diatonicNotes  = new Set(chords.map(c => c.note));
  const isNonDiatonic  = curChord && !diatonicNotes.has(curChord.note);

  // 추천 진행 (하단 고정)
  const c = i => chords[i]?.name || '';
  const suggestions = [
    { label: 'I-V-VI-IV', prog: [c(0), c(4), c(5), c(3)] },
    { label: 'I-IV-V-I',  prog: [c(0), c(3), c(4), c(0)] },
    { label: 'II-V-I',    prog: [c(1), c(4), c(0)] },
  ];

  return (
    <ScrollView ref={scrollRef} style={styles.wrap} contentContainerStyle={{ paddingBottom: 24 }}>

      {/* ── 내 진행 ── */}
      <View style={styles.histSection}>
        {/* 헤더 1줄: 제목 + 저장/불러오기/초기화 */}
        <View style={styles.histHeaderRow1}>
          <Text style={styles.miniLabel}>내 진행 ({progression.length}/{maxProg})</Text>
          <View style={styles.histControls}>
            <TouchableOpacity style={styles.ctrlBtn} onPress={handleSave}>
              <Text style={styles.ctrlBtnTxt}>☆</Text>
              <Text style={styles.ctrlBtnLabel}>저장</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.ctrlBtn, showSaved && styles.ctrlBtnActive]}
              onPress={() => { loadSaved(); setShowSaved(v => !v); }}>
              <Text style={[styles.ctrlBtnTxt, showSaved && styles.ctrlBtnActiveTxt]}>↑</Text>
              <Text style={[styles.ctrlBtnLabel, showSaved && styles.ctrlBtnActiveTxt]}>불러오기</Text>
            </TouchableOpacity>
            {progression.length > 0 && (
              <TouchableOpacity style={styles.ctrlBtn} onPress={handleExportMIDI}>
                <Text style={styles.ctrlBtnTxt}>♪</Text>
                <Text style={styles.ctrlBtnLabel}>MIDI</Text>
              </TouchableOpacity>
            )}
            {progression.length > 0 && (
              <TouchableOpacity style={styles.ctrlBtn} onPress={clearHistory}>
                <Text style={styles.ctrlBtnTxt}>✕</Text>
                <Text style={styles.ctrlBtnLabel}>초기화</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* 악기 + 스트럼 토글 — 상시 표시 */}
        <View style={styles.instrRow}>
          {['guitar','piano'].map(instr => (
            <TouchableOpacity key={instr}
              style={[styles.instrBtn, curInstr === instr && styles.instrBtnSel]}
              onPress={() => { setCurInstr(instr); setDiagPosIdx(0); setPlayShapeIdx(0); }}>
              <Text style={[styles.instrBtnText, curInstr === instr && styles.instrBtnTextSel]}>
                {instr === 'guitar' ? '기타' : '피아노'}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.strumSep} />
          {['strum','arp'].map(mode => (
            <TouchableOpacity key={mode}
              style={[styles.instrBtn, strumMode === mode && styles.instrBtnSel]}
              onPress={() => setStrumMode(mode)}>
              <Text style={[styles.instrBtnText, strumMode === mode && styles.instrBtnTextSel]}>
                {mode === 'strum' ? '스트럼' : '아르페지오'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 헤더 2줄: 재생(크게) + 템포(크게) */}
        {progression.length > 0 && (
          <View style={styles.histHeaderRow2}>
            <TouchableOpacity
              style={[styles.playBigBtn, playing && styles.playBigBtnStop]}
              onPress={playing ? stopPlay : startPlay}>
              <Text style={[styles.playBigIcon, playing && styles.playBigIconStop]}>
                {playing ? '■' : '▶'}
              </Text>
              <Text style={[styles.playBigLabel, playing && styles.playBigIconStop]}>
                {playing ? '정지' : '재생'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bpmBigWrap} onPress={promptBpm} activeOpacity={0.7}>
              <View style={styles.bpmBigInner}>
                <TouchableOpacity onPress={() => setBpm(b => Math.max(40, b - 5))} style={styles.bpmBigAdj} hitSlop={{top:8,bottom:8,left:4,right:4}}>
                  <Text style={styles.bpmBigAdjTxt}>−</Text>
                </TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.bpmBigTxt}>{bpm}</Text>
                  <Text style={styles.bpmBigLabel}>BPM</Text>
                </View>
                <TouchableOpacity onPress={() => setBpm(b => Math.min(200, b + 5))} style={styles.bpmBigAdj} hitSlop={{top:8,bottom:8,left:4,right:4}}>
                  <Text style={styles.bpmBigAdjTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </View>
        )}

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
                        {p.chords.map(n => displayChordName(n, p.key, p.mode)).join(' → ')}
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
                      {/* 빈 마디이거나 2번째 이상 마디는 삭제 가능 — 왼쪽 */}
                      {(mIdx > 0 || slice.length === 0) && (
                        <TouchableOpacity onPress={() => deleteMeasure(mIdx)} style={styles.delMeasureBtn}>
                          <Text style={styles.delMeasureBtnText}>✕</Text>
                        </TouchableOpacity>
                      )}
                      {/* 마디 추가 — 오른쪽 */}
                      {isLast && (
                        <TouchableOpacity onPress={addMeasure} style={styles.addMeasureBtn}>
                          <Text style={styles.addMeasureBtnText}>+</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {slice.length === 0
                    ? isLast
                      ? (
                        <View style={styles.measureChips}>
                          <TouchableOpacity
                            style={[styles.histChip, styles.emptySlotChip, editIdx === null && styles.emptySlotActive]}
                            onPress={() => setEditIdx(null)}>
                          </TouchableOpacity>
                        </View>
                      )
                      : <Text style={styles.emptyMeasureTxt}>빈 마디</Text>
                    : (
                      <View style={styles.measureChips}>
                        {slice.map((p, si) => {
                          const i         = startIdx + si;
                          const isActive  = curChord?.note === p.note;
                          const isLatest  = i === progression.length - 1;
                          const isPlaying = playIdx === i;
                          const isEditing = editIdx === i;
                          return (
                            <TouchableOpacity
                              key={i}
                              style={[
                                styles.histChip,
                                isLatest  && styles.histChipLast,
                                isActive  && styles.histChipActive,
                                isPlaying && styles.histChipPlaying,
                                isEditing && styles.histChipEditing,
                              ]}
                              onPress={() => tapHistChip(p, i)}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                <Text style={[
                                  styles.histName,
                                  isLatest  && styles.histNameLast,
                                  isActive  && styles.histNameActive,
                                  isPlaying && styles.histNamePlaying,
                                  isEditing && styles.histNameEditing,
                                ]}>
                                  {displayChordName(p.name, activeKey, selMode)}
                                </Text>
                                {p.beats === 0.5 && <Text style={styles.beatDot}>♪</Text>}
                                {p.beats === 2   && <Text style={styles.beatDot}>♩♩</Text>}
                              </View>
                              <TouchableOpacity onPress={() => removeFromHistory(i)} hitSlop={{top:6,bottom:6,left:4,right:4}}>
                                <Text style={styles.histX}>✕</Text>
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                        {/* 빈 끝 슬롯 — 마지막 마디에만, 탭하면 append 모드 */}
                        {isLast && (
                          <TouchableOpacity
                            style={[styles.histChip, styles.emptySlotChip, editIdx === null && styles.emptySlotActive]}
                            onPress={() => setEditIdx(null)}>
                          </TouchableOpacity>
                        )}
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

        {/* ── 운지 (진행 바로 아래) — 재생 중엔 연주 코드 따라가고, 멈추면 마지막 코드 유지 ── */}
        {(() => {
          const isPlay    = playing && playIdx >= 0 && !!progression[playIdx];
          const dispChord = isPlay ? progression[playIdx] : curChord;
          if (!dispChord) return null;
          const dispVar   = isPlay ? (progression[playIdx].variant || '') : curVar;

          // 기법 보이스리딩 운지가 지정돼 있으면 그것만 표시 (음 이어짐), 아니면 일반 운지
          const fixedShape = (dispChord.shape && dispChord.shape.frets) ? dispChord.shape : null;
          const positions = fixedShape
            ? [fixedShape]
            : getGuitarShapes(dispChord.name, dispChord.note, dispChord.quality, dispVar);
          const guitarIdx = fixedShape ? 0 : (isPlay ? 0 : Math.min(diagPosIdx, Math.max(positions.length - 1, 0)));

          // 슬래시 코드 파싱
          const slashIdx  = dispChord.name ? dispChord.name.indexOf('/') : -1;
          const hasSlash  = slashIdx >= 0;
          const chordPart = hasSlash ? dispChord.name.slice(0, slashIdx) : null;
          const slashBassRaw  = hasSlash ? dispChord.name.slice(slashIdx + 1) : null;
          const slashBassDisp = slashBassRaw
            ? (usesFlatDisplay(activeKey, selMode) ? (TO_FLAT[slashBassRaw] || slashBassRaw) : slashBassRaw)
            : null;
          const pianoRootNote = hasSlash ? chordNameToNote(chordPart) : dispChord.note;

          const vk = getVariantKey(dispVar, dispChord.quality);
          const chordIntervals = VAR_IV[vk] || (dispChord.quality === 'min' ? [0,3,7] : [0,4,7]);
          const maxInv   = Math.min(2, chordIntervals.length - 1);
          const pianoInv = isPlay ? 0 : Math.min(diagPosIdx, maxInv);
          const PIANO_LABELS = ['루트 포지션', '1전위', '2전위'];

          // 구성음 (슬래시면 상위코드 기준) + 표시 기타 운지의 실제 발음음
          const tonesRoot = hasSlash ? chordNameToNote(chordPart) : dispChord.note;
          const dTones = getChordTones(tonesRoot, dispVar, dispChord.quality);
          const dPlayed = (() => {
            if (curInstr !== 'guitar') return null;
            const _OP = [4,9,2,7,11,4];
            const shp = positions[guitarIdx];
            if (!shp) return null;
            return new Set(shp.frets.map((f,i) => f>=0 ? NOTES[(_OP[i]+f)%12] : null).filter(Boolean));
          })();

          const variantChordName = hasSlash ? dispChord.name : dispChord.note + (dispVar || '');
          const variantDisplayName = displayChordName(variantChordName, activeKey, selMode);

          let pianoDisplayName = variantDisplayName;
          let invBassNote = dispChord.note;
          if (!hasSlash && pianoInv > 0 && pianoInv < chordIntervals.length) {
            const rootSt = ki(dispChord.note);
            const raw = NOTES[(rootSt + chordIntervals[pianoInv]) % 12];
            invBassNote = usesFlatDisplay(activeKey, selMode) ? (TO_FLAT[raw] || raw) : raw;
            pianoDisplayName += '/' + invBassNote;
          }
          const invHintText = hasSlash
            ? `분수코드 ${PIANO_LABELS[pianoInv]} — ${slashBassDisp}이 최저음 (고정)`
            : pianoInv === 0
              ? `루트 포지션 — ${flatNote(dispChord.note, activeKey, selMode)}이 최저음`
              : `${PIANO_LABELS[pianoInv]} — ${invBassNote}이 최저음`;

          return (
            <View style={styles.diagSection}>
              <View style={styles.diagHeader}>
                <Text style={styles.miniLabel}>운지{isPlay ? ' · 재생 중' : ''}</Text>
                <View style={styles.instrToggle}>
                  {['guitar','piano'].map(instr => (
                    <TouchableOpacity key={instr}
                      style={[styles.instrBtn, curInstr === instr && styles.instrBtnSel]}
                      onPress={() => { setCurInstr(instr); setDiagPosIdx(0); }}>
                      <Text style={[styles.instrBtnText, curInstr === instr && styles.instrBtnTextSel]}>
                        {instr === 'guitar' ? '기타' : '피아노'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.strumSep} />
                  {['strum','arp'].map(mode => (
                    <TouchableOpacity key={mode}
                      style={[styles.instrBtn, strumMode === mode && styles.instrBtnSel]}
                      onPress={() => setStrumMode(mode)}>
                      <Text style={[styles.instrBtnText, strumMode === mode && styles.instrBtnTextSel]}>
                        {mode === 'strum' ? '스트럼' : '아르페지오'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {!isPlay && curInstr === 'guitar' && positions.length > 1 && (
                <View style={styles.posRow}>
                  {positions.map((p, i) => (
                    <TouchableOpacity key={i}
                      style={[styles.posBtn, guitarIdx === i && styles.posBtnSel]}
                      onPress={() => setDiagPosIdx(i)}>
                      <Text style={[styles.posBtnText, guitarIdx === i && styles.posBtnTextSel]}>
                        {p.pos || `${i + 1}포지션`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!isPlay && curInstr === 'piano' && (
                <View style={styles.posRow}>
                  {PIANO_LABELS.map((label, i) => (
                    <TouchableOpacity key={i}
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
              <View style={styles.diagNameRow}>
                <Text style={styles.diagChordNameLabel}>
                  {curInstr === 'piano' ? pianoDisplayName : variantDisplayName}
                </Text>
                <View style={styles.tonesRow}>
                  {slashBassDisp && (
                    <React.Fragment>
                      <Text style={[styles.diagTone, styles.diagToneBass]}>{slashBassDisp}</Text>
                      <Text style={styles.diagToneSep}> / </Text>
                    </React.Fragment>
                  )}
                  {dTones.map((t, i) => {
                    const isOmitted = dPlayed && !dPlayed.has(t);
                    return (
                      <React.Fragment key={i}>
                        {i > 0 && <Text style={styles.diagToneSep}> · </Text>}
                        <Text style={[styles.diagTone, i === 0 && styles.diagToneRoot, isOmitted && styles.diagToneOmitted]}>{flatNote(t, activeKey, selMode)}</Text>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
              <View style={styles.diagWrap}>
                {curInstr === 'guitar' ? (
                  <GuitarDiagram
                    shape={positions[guitarIdx] || null}
                    name={variantChordName}
                    displayName={variantDisplayName}
                    posLabel={positions[guitarIdx]?.pos}
                    slashBass={hasSlash ? slashBassRaw : undefined}
                  />
                ) : (
                  <>
                    <PianoDiagram
                      name={pianoDisplayName}
                      rootNote={pianoRootNote}
                      chordIntervals={chordIntervals}
                      inversion={pianoInv}
                      slashBass={hasSlash ? slashBassRaw : undefined}
                    />
                    <Text style={styles.invHint}>{invHintText}</Text>
                  </>
                )}
              </View>
            </View>
          );
        })()}
      </View>

      {/* ── 곡 참조 + 장르 감지 ── */}
      {(matchedSongs.length > 0 || detectedGenres.length > 0 || isNonDiatonic) && (
        <View style={styles.songMatchRow}>
          {detectedGenres.map(g => (
            <View key={g} style={styles.genreBadge}>
              <Text style={styles.genreBadgeTxt}>
                {GENRE_EMOJI[g]} {GENRE_KO[g]}
              </Text>
            </View>
          ))}
          {matchedSongs.length > 0 && (
            <View style={styles.songMatchInner}>
              <Text style={styles.songMatchLabel}>비슷한 곡</Text>
              <Text style={styles.songMatchText} numberOfLines={1}>
                {matchedSongs.join('  ·  ')}
              </Text>
            </View>
          )}
          {isNonDiatonic && (
            <View style={styles.nonDiatonicBadge}>
              <Text style={styles.nonDiatonicTxt}>✦ 전조 포인트</Text>
            </View>
          )}
        </View>
      )}

      {/* ── 추천 진행 ── */}
      <View style={styles.sugSection}>
        <View style={styles.sugSectionHeader}>
          <Text style={styles.sugSectionLabel}>추천 진행</Text>
          {detectedGenre && (
            <View style={styles.sugGenreBadge}>
              <Text style={styles.sugGenreBadgeTxt}>{GENRE_EMOJI[detectedGenre]} {GENRE_KO[detectedGenre]} 스타일</Text>
            </View>
          )}
        </View>
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
        <TouchableOpacity style={styles.smBtn} onPress={onMinorConvert}>
          <Text style={styles.smBtnText}>🎼 장·단</Text>
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
              : <Text style={styles.gpsSrc}>{isPremium ? 'AI' : '🔒 AI'}</Text>
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
                      <Text style={[styles.gpsCurChord, { color: routeColor }]}>{displayChordName(curChord.name, activeKey, selMode)}</Text>
                      <Text style={styles.gpsArrow}>→</Text>
                      {route.chords.map((ch, ci) => {
                        const noteOnly = ch.match(/^[A-G][b#]?/)?.[0] || ch;
                        const degIdx = chords.findIndex(c => c.note === noteOnly);
                        const role = degIdx >= 0 ? CHORD_ROLE[degIdx] : null;
                        return (
                          <React.Fragment key={ci}>
                            <View style={{ alignItems: 'center' }}>
                              <TouchableOpacity
                                style={[styles.gpsChordChip, { borderColor: routeColor }]}
                                onPress={() => {
                                  const qual = ch.includes('m') && !ch.includes('maj') ? 'min'
                                             : ch.includes('°') ? 'dim' : 'maj';
                                  selectChord({ note: noteOnly, quality: qual, degree: '', name: ch });
                                }}>
                                <Text style={[styles.gpsChordText, { color: routeColor }]}>{flatChordName(ch, activeKey, selMode)}</Text>
                              </TouchableOpacity>
                              {role && (
                                <Text style={[styles.gpsRoleLabel, { color: role.color }]}>{role.label}</Text>
                              )}
                            </View>
                            {ci < route.chords.length - 1 && (
                              <Text style={styles.gpsArrow}>→</Text>
                            )}
                          </React.Fragment>
                        );
                      })}
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
          <Text style={styles.infoTitle}>
            {curChord.name.includes('/')
              ? flatChordName(curChord.name.split('/')[0], activeKey, selMode) + '/' + chordSlashBass
              : flatChordName(curChord.note + (curVar || ''), activeKey, selMode)}
          </Text>
          <View style={styles.tonesRow}>
            <Text style={styles.infoText}>구성음: </Text>
            {chordSlashBass && (
              <React.Fragment>
                <Text style={[styles.infoText, styles.bassTone]}>{chordSlashBass}</Text>
                <Text style={styles.infoText}> / </Text>
              </React.Fragment>
            )}
            {tones.map((t, i) => {
              const isOmitted = playedNotesForTones && !playedNotesForTones.has(t);
              return (
                <React.Fragment key={i}>
                  {i > 0 && <Text style={styles.infoText}> · </Text>}
                  <Text style={[styles.infoText, i === 0 && styles.rootTone, isOmitted && styles.omittedTone]}>{flatNote(t, activeKey, selMode)}</Text>
                </React.Fragment>
              );
            })}
          </View>
          {subs.length > 0 && (
            <Text style={styles.infoText}>대리코드: {subs.join(', ')}</Text>
          )}
        </View>
      ) : (
        <Text style={styles.hint}>코드를 선택하면 진행이 쌓입니다</Text>
      )}

      {/* ── 기법 제안 ── */}
      {curChord && (() => {
        const techs = getTechniques(curChord, chords, activeKey, selMode);
        return techs.length > 0 ? (
          <View style={styles.techSection}>
            <Text style={[styles.label, { marginTop: 14 }]}>기법 제안</Text>
            {techs.map((g, gi) => {
              const locked = g.premium && !isPremium;
              return (
                <View key={gi} style={[styles.techGroup, g.premium && styles.techGroupPremium]}>
                  <View style={styles.techHeader}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                        <Text style={[styles.techType, g.premium && styles.techTypePremium]}>
                          {g.type}{g.premium ? '  🔒' : ''}
                        </Text>
                      </View>
                      {g.desc ? <Text style={styles.techDesc}>{g.desc}</Text> : null}
                      {g.info ? <Text style={styles.techInfo}>{g.info}</Text> : null}
                    </View>
                    {!locked && g.useAll && g.items.length >= 1 && (
                      <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        <View style={styles.beatPickerRow}>
                          {[{l:'♩ 4분', v:1},{l:'♪ 8분', v:0.5},{l:'♩♩ 2분', v:2}].map(({l,v}) => (
                            <TouchableOpacity
                              key={v}
                              style={[styles.beatBtn, (techBeatMap[gi] ?? 1) === v && styles.beatBtnSel]}
                              onPress={() => setTechBeatMap(m => ({...m,[gi]:v}))}>
                              <Text style={[(techBeatMap[gi] ?? 1) === v ? styles.beatBtnTextSel : styles.beatBtnText]}>{l}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          <TouchableOpacity
                            style={styles.techPlayBtn}
                            onPress={() => playTechSequence(g.items)}>
                            <Text style={styles.techPlayBtnText}>▶</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.techUseBtn}
                            onPress={() => replaceWithTech(g.items, techBeatMap[gi] ?? 1)}>
                            <Text style={styles.techUseBtnText}>→ 사용</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                  {locked ? (
                    <TouchableOpacity style={styles.techLockBanner} onPress={showPaywall}>
                      <Text style={styles.techLockText}>🔒 프리미엄에서 사용 가능</Text>
                      <Text style={styles.techLockSub}>탭하여 업그레이드</Text>
                    </TouchableOpacity>
                  ) : g.items.length > 0 ? (
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
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null;
      })()}


    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },

  // 내 진행
  histSection:      { backgroundColor: COLORS.bg3, borderRadius: 10, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border },
  histHeaderRow1:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  histHeaderRow2:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  miniLabel:        { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5 },
  histControls:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ctrlBtn:          { paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: COLORS.card, alignItems: 'center' },
  ctrlBtnStop:      { borderColor: COLORS.red, backgroundColor: 'rgba(255,80,80,0.1)' },
  ctrlBtnTxt:       { fontSize: 11, color: COLORS.text },
  ctrlBtnLabel:     { fontSize: 8, color: COLORS.text2, marginTop: 2 },
  ctrlBtnStopTxt:   { color: COLORS.red },
  ctrlBtnActive:    { borderColor: COLORS.blue, backgroundColor: 'rgba(74,158,255,0.1)' },
  ctrlBtnActiveTxt: { color: COLORS.blue },
  // 재생 버튼 (크게)
  playBigBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderWidth: 1.5, borderColor: COLORS.accent, borderRadius: 8, backgroundColor: 'rgba(232,196,106,0.1)' },
  playBigBtnStop:   { borderColor: COLORS.red, backgroundColor: 'rgba(255,80,80,0.1)' },
  playBigIcon:      { fontSize: 18, color: COLORS.accent },
  playBigIconStop:  { color: COLORS.red },
  playBigLabel:     { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
  // 템포 (크게)
  bpmBigWrap:       { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, paddingVertical: 6 },
  bpmBigInner:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  bpmBigTxt:        { fontSize: 20, color: COLORS.text, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  bpmBigLabel:      { fontSize: 9, color: COLORS.text2, textAlign: 'center' },
  bpmBigAdj:        { paddingHorizontal: 6 },
  bpmBigAdjTxt:     { fontSize: 18, color: COLORS.accent, fontWeight: '700' },
  histEmptyTxt:   { fontSize: 11, color: COLORS.text2, textAlign: 'center', paddingVertical: 8 },
  measuresRow:        { flexDirection: 'column', alignItems: 'stretch' },
  measureBlock:       { marginBottom: 4 },
  measureBlockSep:    { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 4, paddingTop: 6 },
  measureHeaderRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  measureLabel:       { fontSize: 9, color: COLORS.text2, letterSpacing: 1 },
  addMeasureBtn:      { paddingHorizontal: 6, paddingVertical: 1, borderWidth: 1, borderColor: COLORS.accent, borderRadius: 4 },
  addMeasureBtnText:  { fontSize: 9, color: COLORS.accent },
  delMeasureBtn:      { paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: COLORS.red, borderRadius: 4 },
  delMeasureBtnText:  { fontSize: 9, color: COLORS.red },
  emptyMeasureTxt:    { fontSize: 9, color: COLORS.text2, fontStyle: 'italic', paddingVertical: 2 },
  measureChips:       { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  histChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  histChipLast:    { borderColor: COLORS.accent },
  histChipActive:  { borderColor: COLORS.blue, backgroundColor: 'rgba(74,158,255,0.1)' },
  histChipPlaying: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  histChipEditing: { borderColor: COLORS.accent, borderWidth: 2, backgroundColor: 'rgba(232,196,106,0.15)' },
  histName:        { fontSize: 12, color: COLORS.text, fontWeight: '600' },
  histNameLast:    { color: COLORS.accent },
  histNameActive:  { color: COLORS.blue },
  histNamePlaying: { color: '#111' },
  histNameEditing: { color: COLORS.accent },
  histX:           { fontSize: 10, color: COLORS.text2 },
  emptySlotChip:   { borderStyle: 'dashed', borderColor: COLORS.border, backgroundColor: 'transparent' },
  emptySlotActive: { borderColor: COLORS.accent },
  emptySlotTxt:    { fontSize: 14, color: COLORS.text2, paddingHorizontal: 2, display: 'none' },
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
  instrRow:      { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 6 },
  instrToggle:   { flexDirection: 'row', gap: 5, alignItems: 'center' },
  strumSep:      { width: 1, height: 16, backgroundColor: COLORS.border, marginHorizontal: 2 },
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
  tonesRow:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  rootTone:      { color: COLORS.accent, fontWeight: '700' },
  omittedTone:   { color: '#555' },
  bassTone:      { color: COLORS.blue,   fontWeight: '700' },
  diagToneBass:  { color: COLORS.blue,   fontWeight: '700' },
  // 운지 섹션 코드명 + 구성음 헤더
  diagNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 },
  diagChordNameLabel: { fontSize: 14, color: COLORS.accent, fontWeight: '700', minWidth: 30 },
  diagTone:        { fontSize: 11, color: COLORS.text2 },
  diagToneRoot:    { color: COLORS.accent, fontWeight: '700' },
  diagToneOmitted: { color: '#555' },
  diagToneSep:   { fontSize: 11, color: COLORS.border },
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
  gpsRoleLabel:  { fontSize: 9, marginTop: 2, fontWeight: '500' },
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
  techPlayBtn:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: COLORS.green, backgroundColor: 'rgba(76,175,80,0.12)' },
  techPlayBtnText:   { fontSize: 10, color: COLORS.green, fontWeight: '700' },
  techUseBtn:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: COLORS.pink, backgroundColor: 'rgba(244,114,182,0.12)' },
  techUseBtnText:    { fontSize: 10, color: COLORS.pink, fontWeight: '700' },
  techGroupPremium:  { borderColor: COLORS.accent + '55' },
  techTypePremium:   { color: COLORS.accent },
  techInfo:          { fontSize: 10, color: COLORS.text2, fontStyle: 'italic', marginTop: 3, lineHeight: 15 },
  techLockBanner:    { marginTop: 6, padding: 10, borderRadius: 7, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.accent + '66', alignItems: 'center', backgroundColor: 'rgba(232,196,106,0.05)' },
  techLockText:      { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  techLockSub:       { fontSize: 10, color: COLORS.text2, marginTop: 2 },
  beatPickerRow: { flexDirection: 'row', gap: 4 },
  beatBtn:       { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  beatBtnSel:    { borderColor: COLORS.purple, backgroundColor: 'rgba(167,139,250,0.15)' },
  beatBtnText:   { fontSize: 10, color: COLORS.text2 },
  beatBtnTextSel:{ fontSize: 10, color: COLORS.purple, fontWeight: '700' },
  beatDot:       { fontSize: 9, color: COLORS.purple, lineHeight: 14 },
  // 추천 진행
  songMatchRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 2, marginBottom: 6, flexWrap: 'wrap' },
  songMatchInner:    { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  songMatchLabel:    { fontSize: 9, color: COLORS.text2, letterSpacing: 0.8 },
  songMatchText:     { fontSize: 12, color: COLORS.text2, flex: 1 },
  genreBadge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border },
  genreBadgeTxt:     { fontSize: 11, color: COLORS.accent, fontWeight: '600' },
  nonDiatonicBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(255,152,0,0.12)', borderWidth: 1, borderColor: '#FF9800' },
  nonDiatonicTxt:    { fontSize: 11, color: '#FF9800', fontWeight: '600' },
  sugSection:        { backgroundColor: COLORS.bg3, borderRadius: 8, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  sugSectionHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sugSectionLabel:   { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5 },
  sugGenreBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(232,196,106,0.12)', borderWidth: 1, borderColor: COLORS.accent },
  sugGenreBadgeTxt:  { fontSize: 10, color: COLORS.accent, fontWeight: '700' },
  sugList:           { gap: 5 },
  sugRow:            { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sugLabel:          { fontSize: 10, color: COLORS.text2, width: 60 },
  sugChords:         { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' },
  sugArrow:          { color: COLORS.text2, fontSize: 10 },
  sugChord:          { fontSize: 13, color: COLORS.text2 },
  sugChordHighlight: { color: COLORS.accent, fontWeight: '700' },
});
