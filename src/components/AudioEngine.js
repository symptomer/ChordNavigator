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

// 마스터 버스: 모든 음을 한 곳에 모아 리미터로 코드 합산 클리핑(깨짐) 방지
var master = null;
function getMaster() {
  if (!master) {
    var c = getCtx();
    master = c.createGain();
    master.gain.value = 0.85;
    var lim = c.createDynamicsCompressor(); // 피크만 눌러 깨짐 방지(리미터)
    lim.threshold.value = -8;
    lim.knee.value = 6;
    lim.ratio.value = 12;
    lim.attack.value = 0.003;
    lim.release.value = 0.25;
    master.connect(lim);
    lim.connect(c.destination);
  }
  return master;
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

/**
 * 코드 보이싱: 루트(옥타브3)부터 위로 쌓는 오름차순 배치
 * ivs: 루트로부터의 실제 반음 인터벌 배열
 */
function voiceChord(rootName, ivs, bassName) {
  var rootPc = NOTES.indexOf(rootName);
  if (rootPc < 0) return [];

  var freqs = [];

  // 슬래시/페달 베이스음: 루트보다 한 옥타브 아래(옥타브2)에 깔아줌
  if (bassName) {
    var bn = FLAT2SHARP[bassName] || bassName;
    if (NOTES.indexOf(bn) >= 0) freqs.push(midi2f(note2midi(bn, 2)));
  }

  var rootMidi = note2midi(rootName, 3); // 루트: C3=48, B3=59
  var prevMidi = rootMidi - 1;

  ivs.slice(0, 6).forEach(function(iv) {
    var targetPc = (rootPc + iv) % 12;
    // prevMidi 이후에 오는 targetPc 피치클래스의 최소 MIDI 값
    var midi = prevMidi + 1;
    while (midi % 12 !== targetPc) midi++;
    freqs.push(midi2f(midi));
    prevMidi = midi;
  });

  return freqs;
}

// ── 기타 음색: 통기타(어쿠스틱 스틸) — 따뜻한 기음 + 약한 배음 + 피크 어택 + 바디 공명 ──
function makeGuitarTone(f, now, vol) {
  // 스틸기타(스틸현): 밝고 또렷한 sawtooth 기음 + 상위 배음 + 하이 셸프 광택
  var o1 = ctx.createOscillator(); // 기음 (밝은 sawtooth = 스틸현)
  var o2 = ctx.createOscillator(); // 상위 배음 보강 (5도 위 살짝)
  var o3 = ctx.createOscillator(); // 미세 디튠 유니즌 (현 울림/바디)
  o1.type = 'sawtooth';
  o2.type = 'sawtooth';
  o3.type = 'triangle';
  o1.frequency.value = f;
  o2.frequency.value = f;
  o3.frequency.value = f * 1.004;
  var o1g = ctx.createGain(); o1g.gain.value = 0.62; // sawtooth 기음 (밝음)
  var o2g = ctx.createGain(); o2g.gain.value = 0.55; // 상위 배음↑ (밝게/스틸)
  var o3g = ctx.createGain(); o3g.gain.value = 0.26; // 따뜻한 triangle↓ (부드러움 감소)

  // 피킹 직후 매우 밝게 → 천천히 닫힘(고음 오래 유지 = 스틸현 광택/twang)
  var lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(Math.min(f * 15, 12000), now);
  lpf.frequency.exponentialRampToValueAtTime(Math.min(f * 8, 6000), now + 0.18);
  lpf.frequency.exponentialRampToValueAtTime(Math.min(f * 5, 3600), now + 1.4);
  lpf.Q.value = 0.9;

  // 바디 공명 (따뜻함/박스감 최소화)
  var body1 = ctx.createBiquadFilter();
  body1.type = 'peaking'; body1.frequency.value = 110; body1.Q.value = 1.0; body1.gain.value = 1;
  var body2 = ctx.createBiquadFilter();
  body2.type = 'peaking'; body2.frequency.value = 240; body2.Q.value = 1.2; body2.gain.value = 0;
  // 스틸 광택: 고역 하이 셸프 부스트 (금속성 반짝임 — 리미터가 피크 잡아줌)
  var bright = ctx.createBiquadFilter();
  bright.type = 'highshelf'; bright.frequency.value = 2600; bright.gain.value = 8;
  // 존재감(프레즌스) 프레즌스 피크
  var pres = ctx.createBiquadFilter();
  pres.type = 'peaking'; pres.frequency.value = 3500; pres.Q.value = 1.0; pres.gain.value = 4;

  var g = ctx.createGain();
  var v = vol * 0.07; // 리미터가 코드 합산 피크를 잡으므로 개별음은 여유있게
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(v, now + 0.004);           // 4ms 어택(또렷)
  g.gain.exponentialRampToValueAtTime(v * 0.55, now + 0.12);
  g.gain.exponentialRampToValueAtTime(v * 0.2, now + 0.9);
  g.gain.exponentialRampToValueAtTime(0.001, now + 2.8);    // 긴 자연 감쇠

  o1.connect(o1g); o1g.connect(lpf);
  o2.connect(o2g); o2g.connect(lpf);
  o3.connect(o3g); o3g.connect(lpf);
  lpf.connect(body1); body1.connect(body2); body2.connect(bright); bright.connect(pres); pres.connect(g);
  g.connect(getMaster());
  o1.start(now); o1.stop(now + 2.9);
  o2.start(now); o2.stop(now + 2.9);
  o3.start(now); o3.stop(now + 2.9);

  // 피크 어택 노이즈 (현 뜯는 소리 — 밝고 또렷하게)
  var bufSize = Math.floor(ctx.sampleRate * 0.012);
  var nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  var nd = nBuf.getChannelData(0);
  for (var k = 0; k < bufSize; k++) nd[k] = (Math.random() * 2 - 1) * (1 - k / bufSize);
  var ns = ctx.createBufferSource(); ns.buffer = nBuf;
  var nbp = ctx.createBiquadFilter();
  nbp.type = 'bandpass'; nbp.frequency.value = Math.min(f * 5, 5000); nbp.Q.value = 0.8;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.08, now); // 픽 어택 강조(twang)
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  ns.connect(nbp); nbp.connect(ng); ng.connect(getMaster());
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
  tone.connect(getMaster());

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
  ng.connect(getMaster());
  ns.start(now);
  ns.stop(now + 0.025);
}

// ── 코드 스케줄 ─────────────────────────────────────────────────
function scheduleChord(note, variant, quality, vol, instr, arpBeatMs, bass) {
  var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
  var ivs = VAR_IV[vk] || [0, 4, 7];

  var freqs = voiceChord(note, ivs, bass);
  if (!freqs.length) return;

  playWhenReady(function() {
    var now = ctx.currentTime;
    var isArp = (instr === 'guitar-arp' || instr === 'piano-arp');
    var isPiano = (instr === 'piano' || instr === 'piano-arp');
    var strumMs = isArp
      ? (arpBeatMs || 200) / freqs.length / 1000
      : isPiano ? 0 : 0.038;

    freqs.forEach(function(f, i) {
      var t = now + i * strumMs;
      // 최저음(베이스) 강조 → 하강/진행 베이스가 또렷하게 들림
      var bassEmph = i === 0 ? 1.55 : (i === 1 ? 1.05 : 0.9);
      if (isPiano) {
        makePianoTone(f, t, vol * bassEmph);
      } else {
        makeGuitarTone(f, t, vol * bassEmph * (isArp ? 1.1 : 1));
      }
    });
  });
}

// ── 명시적 보이싱 스케줄 ────────────────────────────────────────
// midis: 발음할 MIDI 번호 배열 (저음→고음 순서 그대로 스트럼).
// 화면에 표시된 운지(기타 프렛/피아노 건반)에서 계산해 넘기므로 소리=그림.
function scheduleVoicing(midis, vol, instr, arpBeatMs) {
  if (!midis || !midis.length) return;
  var freqs = midis.map(midi2f);

  playWhenReady(function() {
    var now = ctx.currentTime;
    var isArp = (instr === 'guitar-arp' || instr === 'piano-arp');
    var isPiano = (instr === 'piano' || instr === 'piano-arp');
    var strumMs = isArp
      ? (arpBeatMs || 200) / freqs.length / 1000
      : isPiano ? 0 : 0.038;

    freqs.forEach(function(f, i) {
      var t = now + i * strumMs;
      // 최저음(베이스) 강조 → 하강/진행 베이스가 또렷하게 들림
      var bassEmph = i === 0 ? 1.55 : (i === 1 ? 1.05 : 0.9);
      if (isPiano) {
        makePianoTone(f, t, vol * bassEmph);
      } else {
        makeGuitarTone(f, t, vol * bassEmph * (isArp ? 1.1 : 1));
      }
    });
  });
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
        source={{ html: AUDIO_HTML }}
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
