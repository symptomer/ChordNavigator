import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';

const AUDIO_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="apple-mobile-web-app-capable" content="yes">
</head>
<body>
<!-- 무음 오디오 — iOS 오디오 세션 활성화용 -->
<audio id="sil" autoplay loop muted playsinline
  src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAA">
</audio>
<script>
var ctx = null;
var pending = [];

// VAR_IV: 루트로부터의 반음 인터벌 (14=9th, 17=11th, 21=13th 실제 값)
var VAR_IV = {
  '':     [0,4,7],
  'maj7': [0,4,7,11],
  'maj9': [0,4,7,11,14],
  '7':    [0,4,7,10],
  '9':    [0,4,7,10,14],
  '13':   [0,4,7,10,14,21],
  'add9': [0,4,7,14],
  'sus4': [0,5,7],
  'sus2': [0,2,7],
  '6':    [0,4,7,9],
  'm':    [0,3,7],
  'm7':   [0,3,7,10],
  'm9':   [0,3,7,10,14],
  'm11':  [0,3,7,10,14,17],
  'm6':   [0,3,7,9],
  'mMaj7':[0,3,7,11],
  '\u00b0':  [0,3,6],
  '\u00b07': [0,3,6,9],
  '\u00f87': [0,3,6,10]
};

var NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var FLAT2SHARP = { 'Bb':'A#','Eb':'D#','Ab':'G#','Db':'C#','Gb':'F#','Cb':'B','Fb':'E' };

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.onstatechange = function() {
      if (ctx.state === 'running') flushPending();
    };
  }
  return ctx;
}

function flushPending() {
  if (!ctx || ctx.state !== 'running') return;
  var toRun = pending.splice(0);
  toRun.forEach(function(fn) { try { fn(); } catch(e) {} });
}

function unlock() {
  var c = getCtx();
  loadGuitarSamples(); // 어쿠스틱 기타 샘플 미리 로드 (준비 전엔 합성음 폴백)
  var sil = document.getElementById('sil');
  if (sil) {
    sil.play().then(function() {
      c.resume().then(flushPending).catch(function(){});
    }).catch(function() {
      c.resume().then(flushPending).catch(function(){});
    });
  } else {
    c.resume().then(flushPending).catch(function(){});
  }
}

function playWhenReady(fn) {
  var c = getCtx();
  if (c.state === 'running') {
    try { fn(); } catch(e) {}
  } else {
    pending.push(fn);
    c.resume().then(flushPending).catch(function(){});
  }
}

// MIDI 번호 → 주파수 (A4=69=440Hz 기준)
function midi2f(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 노트명 → MIDI 번호 (C4=60)
function note2midi(noteName, oct) {
  var idx = NOTES.indexOf(noteName);
  if (idx < 0) return 60;
  return idx + (oct + 1) * 12;
}

// ── 어쿠스틱 기타 샘플(사운드폰트) — 실제 녹음 샘플로 리얼한 기타음 ──────────────
// MusyngKite acoustic_guitar_steel 의 base64 mp3 샘플을 직접 받아 디코딩.
// 외부 라이브러리/원격 스크립트 실행 없이 "데이터"만 fetch → 디코딩(App Store 안전).
// 실패·오프라인이면 GTR.ready=false → 합성 기타(makeGuitarTone)로 자동 폴백.
var SF_URL  = 'https://cdn.jsdelivr.net/gh/gleitz/midi-js-soundfonts@gh-pages/MusyngKite/acoustic_guitar_steel-mp3.js';
var SF_GAIN = 0.62; // 샘플 음량 보정 (너무 크면 클리핑 → 빌드 후 조정)
var GTR = { ready: false, loading: false, buffers: {}, keys: [] };

function noteNameToMidi(n) {
  var m = n.match(/^([A-G])(#?)(-?\\d+)$/);
  if (!m) return null;
  var pc = ({ C:0, D:2, E:4, F:5, G:7, A:9, B:11 })[m[1]] + (m[2] === '#' ? 1 : 0);
  return pc + (parseInt(m[3], 10) + 1) * 12;
}

function loadGuitarSamples() {
  if (GTR.ready || GTR.loading || typeof fetch === 'undefined') return;
  GTR.loading = true;
  fetch(SF_URL).then(function(r){ return r.text(); }).then(function(txt){
    var re = /"([A-G]#?-?\\d+)":\\s*"(data:audio\\/mp3;base64,[^"]+)"/g, m, jobs = [];
    var c = getCtx();
    while ((m = re.exec(txt))) {
      var midi = noteNameToMidi(m[1]);
      if (midi == null || midi < 36 || midi > 90) continue; // 앱 보이싱 범위만 (메모리 절약)
      (function(uri, midi){
        jobs.push(
          fetch(uri).then(function(r){ return r.arrayBuffer(); }).then(function(ab){
            return new Promise(function(res){
              c.decodeAudioData(ab, function(buf){ GTR.buffers[midi] = buf; res(); }, function(){ res(); });
            });
          }).catch(function(){})
        );
      })(m[2], midi);
    }
    return Promise.all(jobs);
  }).then(function(){
    GTR.keys = Object.keys(GTR.buffers).map(Number).sort(function(a, b){ return a - b; });
    GTR.ready = GTR.keys.length > 0;
    GTR.loading = false;
  }).catch(function(){ GTR.loading = false; });
}

function nearestSampleMidi(midi) {
  var keys = GTR.keys, best = keys[0], bd = 999;
  for (var i = 0; i < keys.length; i++) {
    var d = Math.abs(keys[i] - midi);
    if (d < bd) { bd = d; best = keys[i]; }
  }
  return best;
}

// 샘플 1음 재생 (가장 가까운 샘플을 피치시프트). 준비 안됐으면 false → 폴백.
function playGuitarSample(midi, when, gain, dur) {
  if (!GTR.ready) return false;
  var smid = nearestSampleMidi(midi);
  var buf = GTR.buffers[smid];
  if (!buf) return false;
  var src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - smid) / 12); // 최대 1~2반음
  var g = ctx.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.setValueAtTime(gain, when + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.25); // 부드러운 릴리즈
  src.connect(g); g.connect(ctx.destination);
  src.start(when);
  src.stop(when + dur + 0.3);
  return true;
}

/**
 * 코드 보이싱: 루트(옥타브3)부터 위로 쌓는 오름차순 배치
 * ivs: 루트로부터의 실제 반음 인터벌 배열
 */
function voiceChord(rootName, ivs, bassName) {
  var rootPc = NOTES.indexOf(rootName);
  if (rootPc < 0) return [];

  var midis = [];

  // 슬래시/페달 베이스음: 루트보다 한 옥타브 아래(옥타브2)에 깔아줌
  if (bassName) {
    var bn = FLAT2SHARP[bassName] || bassName;
    if (NOTES.indexOf(bn) >= 0) midis.push(note2midi(bn, 2));
  }

  var rootMidi = note2midi(rootName, 3); // 루트: C3=48, B3=59
  var prevMidi = rootMidi - 1;

  ivs.slice(0, 6).forEach(function(iv) {
    var targetPc = (rootPc + iv) % 12;
    // prevMidi 이후에 오는 targetPc 피치클래스의 최소 MIDI 값
    var midi = prevMidi + 1;
    while (midi % 12 !== targetPc) midi++;
    midis.push(midi);
    prevMidi = midi;
  });

  return midis; // MIDI 번호 배열 (합성은 midi2f로 변환, 샘플은 그대로 사용)
}

// ── 기타 음색: 통기타(어쿠스틱 스틸) — 따뜻한 기음 + 약한 배음 + 피크 어택 + 바디 공명 ──
// isBass=true (코드 최저음)이면: 옥타브 아래 사인 서브 + 저역 바디 강조 + 긴 울림
//   → 베이스 하강/페달 라인이 피아노처럼 또렷하게 들리도록.
function makeGuitarTone(f, now, vol, isBass) {
  var o1 = ctx.createOscillator(); // 기음 (따뜻한 triangle)
  var o2 = ctx.createOscillator(); // 현 광택 (약한 sawtooth)
  var o3 = ctx.createOscillator(); // 미세 디튠 유니즌 (현 울림)
  o1.type = 'triangle';
  o2.type = 'sawtooth';
  o3.type = 'triangle';
  o1.frequency.value = f;
  o2.frequency.value = f;
  o3.frequency.value = f * 1.004;
  // 광택(배음): 베이스는 탁하지 않게 줄이고, 일반음은 어쿠스틱 스틸 특유로 살짝 밝게
  var o2g = ctx.createGain(); o2g.gain.value = isBass ? 0.2 : 0.38;
  var o3g = ctx.createGain(); o3g.gain.value = 0.5;

  // 피킹 직후 밝게 → 점점 따뜻하게 닫히는 로우패스
  var lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(isBass ? Math.min(f * 6, 2800) : Math.min(f * 9, 6500), now);
  lpf.frequency.exponentialRampToValueAtTime(Math.min(f * 3, 2200), now + 0.18);
  lpf.frequency.exponentialRampToValueAtTime(Math.min(f * 1.8, 1200), now + 1.2);
  lpf.Q.value = 0.7;

  // 바디 공명 (저역 통울림 + 미드) — 베이스음은 저역을 더 끌어올림
  var body1 = ctx.createBiquadFilter();
  body1.type = 'peaking'; body1.frequency.value = 100; body1.Q.value = 1.0; body1.gain.value = isBass ? 9 : 5;
  var body2 = ctx.createBiquadFilter();
  body2.type = 'peaking'; body2.frequency.value = 230; body2.Q.value = 1.2; body2.gain.value = 3;

  var g = ctx.createGain();
  var v = vol * (isBass ? 0.115 : 0.085); // 베이스 기본 음량 ↑
  var tail = isBass ? 3.4 : 2.6;          // 베이스는 더 길게 울림
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(v, now + 0.005);                   // 5ms 어택
  g.gain.exponentialRampToValueAtTime(v * 0.5, now + 0.12);         // 초기 빠른 감쇠
  g.gain.exponentialRampToValueAtTime(v * 0.18, now + (isBass ? 1.1 : 0.8));
  g.gain.exponentialRampToValueAtTime(0.001, now + tail);          // 긴 자연 감쇠

  o1.connect(lpf);
  o2.connect(o2g); o2g.connect(lpf);
  o3.connect(o3g); o3g.connect(lpf);
  lpf.connect(body1); body1.connect(body2); body2.connect(g);
  g.connect(ctx.destination);
  o1.start(now); o1.stop(now + tail + 0.1);
  o2.start(now); o2.stop(now + tail + 0.1);
  o3.start(now); o3.stop(now + tail + 0.1);

  // 베이스 강조: 옥타브 아래 사인 서브 레이어 → 저음의 무게감/하강 라인이 또렷
  if (isBass) {
    var sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2;
    var subg = ctx.createGain();
    var sv = vol * 0.07;
    subg.gain.setValueAtTime(0.001, now);
    subg.gain.linearRampToValueAtTime(sv, now + 0.02);
    subg.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
    sub.connect(subg); subg.connect(ctx.destination);
    sub.start(now); sub.stop(now + 2.7);
  }

  // 피크 어택 노이즈 (현 뜯는 소리, 아주 짧게) — 어쿠스틱 피킹감 위해 일반음은 살짝 강하게
  var bufSize = Math.floor(ctx.sampleRate * 0.012);
  var nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  var nd = nBuf.getChannelData(0);
  for (var k = 0; k < bufSize; k++) nd[k] = (Math.random() * 2 - 1) * (1 - k / bufSize);
  var ns = ctx.createBufferSource(); ns.buffer = nBuf;
  var nbp = ctx.createBiquadFilter();
  nbp.type = 'bandpass'; nbp.frequency.value = Math.min(f * 3, 3000); nbp.Q.value = 0.8;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * (isBass ? 0.04 : 0.06), now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  ns.connect(nbp); nbp.connect(ng); ng.connect(ctx.destination);
  ns.start(now); ns.stop(now + 0.035);
}

// ── 피아노 음색: 어쿠스틱 그랜드 — 인하모닉 배음 + 유니즌 디튠 + 해머 어택 ────────
function makePianoTone(f, now, vol) {
  var Binh = 0.0004; // 인하모닉시티 (현 강성 → 배음이 약간 높아짐)
  var harmonics = [
    { n: 1, amp: 1.00, decay: 3.4 },
    { n: 2, amp: 0.64, decay: 2.1 },
    { n: 3, amp: 0.42, decay: 1.4 },
    { n: 4, amp: 0.24, decay: 0.95 },
    { n: 5, amp: 0.15, decay: 0.65 },
    { n: 6, amp: 0.09, decay: 0.48 },
    { n: 7, amp: 0.05, decay: 0.35 },
    { n: 8, amp: 0.03, decay: 0.27 },
  ];

  // 금속성 줄이는 톤 셰이핑 로우패스 (밝게 → 약간 닫힘)
  var tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(Math.min(f * 12, 9000), now);
  tone.frequency.exponentialRampToValueAtTime(Math.min(f * 5, 4500), now + 0.3);
  tone.Q.value = 0.5;
  tone.connect(ctx.destination);

  harmonics.forEach(function(h) {
    // 유니즌 2현 미세 디튠 (저~중 배음만) → 그랜드 특유의 풍부함/비팅
    var detunes = (h.n <= 4) ? [0, 0.0016] : [0];
    detunes.forEach(function(det) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * h.n * Math.sqrt(1 + Binh * h.n * h.n) * (1 + det);
      var v = vol * 0.08 * h.amp * (det ? 0.5 : 1);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(v, now + 0.003);          // 빠른 타건
      g.gain.exponentialRampToValueAtTime(v * 0.5, now + 0.08); // 초기 감쇠
      g.gain.exponentialRampToValueAtTime(0.0001, now + h.decay);
      o.connect(g); g.connect(tone);
      o.start(now); o.stop(now + h.decay + 0.05);
    });
  });

  // 해머 타격 노이즈 (타건감)
  var bufSize = Math.floor(ctx.sampleRate * 0.012);
  var nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  var nd = nBuf.getChannelData(0);
  for (var k = 0; k < bufSize; k++) nd[k] = (Math.random() * 2 - 1) * (1 - k / bufSize);
  var ns = ctx.createBufferSource();
  ns.buffer = nBuf;
  var hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 1200;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.035, now);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  ns.connect(hpf);
  hpf.connect(ng);
  ng.connect(ctx.destination);
  ns.start(now);
  ns.stop(now + 0.025);
}

// ── 코드 발음 (피아노=합성, 기타=샘플 우선·합성 폴백) ────────────────
// midis: 저음→고음 순서. 스트럼/아르페지오 타이밍·베이스 강조 공통 처리.
function playChordNotes(midis, vol, isPiano, isArp, arpBeatMs) {
  playWhenReady(function() {
    var now = ctx.currentTime;
    var strumMs = isArp ? (arpBeatMs || 200) / midis.length / 1000 : isPiano ? 0 : 0.038;
    var useSF = !isPiano && GTR.ready; // 기타 + 샘플 준비됨 → 리얼 샘플
    midis.forEach(function(mid, i) {
      var t = now + i * strumMs;
      if (isPiano) {
        var bassEmph = i === 0 ? 1.55 : (i === 1 ? 1.05 : 0.9);
        makePianoTone(midi2f(mid), t, vol * bassEmph);
      } else if (useSF) {
        // 어쿠스틱 기타 샘플 — 최저음 게인 강조로 베이스 또렷
        var isBass = i === 0;
        var gain = vol * (isBass ? 1.15 : (i === 1 ? 0.82 : 0.66)) * SF_GAIN;
        var dur  = isArp ? (arpBeatMs ? arpBeatMs / 1000 : 0.5) : 2.2;
        playGuitarSample(mid, t, gain, dur);
      } else {
        var gtrEmph = i === 0 ? 1.0 : (i === 1 ? 0.92 : 0.82);
        makeGuitarTone(midi2f(mid), t, vol * gtrEmph * (isArp ? 1.1 : 1), i === 0);
      }
    });
  });
}

// ── 코드 스케줄 ─────────────────────────────────────────────────
function scheduleChord(note, variant, quality, vol, instr, arpBeatMs, bass) {
  var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
  var ivs = VAR_IV[vk] || [0, 4, 7];

  var midis = voiceChord(note, ivs, bass);
  if (!midis.length) return;
  var isArp = (instr === 'guitar-arp' || instr === 'piano-arp');
  var isPiano = (instr === 'piano' || instr === 'piano-arp');
  playChordNotes(midis, vol, isPiano, isArp, arpBeatMs);
}

// ── 명시적 보이싱 스케줄 ────────────────────────────────────────
// midis: 발음할 MIDI 번호 배열 (저음→고음 순서 그대로 스트럼).
// 화면에 표시된 운지(기타 프렛/피아노 건반)에서 계산해 넘기므로 소리=그림.
function scheduleVoicing(midis, vol, instr, arpBeatMs) {
  if (!midis || !midis.length) return;
  var isArp = (instr === 'guitar-arp' || instr === 'piano-arp');
  var isPiano = (instr === 'piano' || instr === 'piano-arp');
  playChordNotes(midis, vol, isPiano, isArp, arpBeatMs);
}

function handleMsg(raw) {
  try {
    var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (m.type === 'playChord') {
      scheduleChord(m.note, m.variant || '', m.quality, m.vol || 0.5, m.instr || 'guitar', m.arpBeatMs, m.bass || null);
    } else if (m.type === 'playVoicing') {
      scheduleVoicing(m.midis || [], m.vol || 0.5, m.instr || 'guitar', m.arpBeatMs);
    } else if (m.type === 'unlock') {
      unlock();
    }
  } catch(e) {}
}

window.addEventListener('message', function(e) { handleMsg(e.data); });
document.addEventListener('message', function(e) { handleMsg(e.data); });

window.addEventListener('load', unlock);
document.addEventListener('DOMContentLoaded', unlock);
<\/script>
</body>
</html>`;

const AudioEngine = forwardRef((props, ref) => {
  const wvRef = useRef(null);

  useImperativeHandle(ref, () => ({
    playChord: (note, variant, quality, vol = 0.5, instr = 'guitar', arpBeatMs, bass) => {
      if (!wvRef.current) return;
      const msg = JSON.stringify({ type: 'playChord', note, variant: variant || '', quality, vol, instr, arpBeatMs, bass: bass || null });
      wvRef.current.injectJavaScript(`handleMsg(${JSON.stringify(msg)});true;`);
    },
    playVoicing: (midis, vol = 0.5, instr = 'guitar', arpBeatMs) => {
      if (!wvRef.current) return;
      const msg = JSON.stringify({ type: 'playVoicing', midis: midis || [], vol, instr, arpBeatMs });
      wvRef.current.injectJavaScript(`handleMsg(${JSON.stringify(msg)});true;`);
    },
    unlock: () => {
      wvRef.current?.injectJavaScript(`unlock();true;`);
    },
  }));

  return (
    <View style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
      <WebView
        ref={wvRef}
        source={{ html: AUDIO_HTML, baseUrl: 'https://chordnav.local/' }}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="always"
        originWhitelist={['*']}
        onLoad={() => {
          wvRef.current?.injectJavaScript(`unlock();true;`);
        }}
        onError={e => console.log('AudioEngine error:', e.nativeEvent)}
      />
    </View>
  );
});

export default AudioEngine;
