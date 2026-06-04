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
function voiceChord(rootName, ivs) {
  var rootPc = NOTES.indexOf(rootName);
  if (rootPc < 0) return [];

  var rootMidi = note2midi(rootName, 3); // 루트: C3=48, B3=59
  var freqs = [];
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

// ── 기타 음색: 디튠 sawtooth 2개 + 필터 스윕 (현 진동 시뮬) ──────
function makeGuitarTone(f, now, vol) {
  // 두 오실레이터를 약간 디튠 → 코러스/현 진동 느낌
  var o1 = ctx.createOscillator();
  var o2 = ctx.createOscillator();
  o1.type = 'sawtooth';
  o2.type = 'sawtooth';
  o1.frequency.value = f;
  o2.frequency.value = f * 1.0035; // 미세 디튠

  // 피킹 직후 밝다가 어두워지는 필터 스윕
  var lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.setValueAtTime(Math.min(f * 10, 6000), now);
  lpf.frequency.exponentialRampToValueAtTime(Math.min(f * 2.5, 2000), now + 0.25);
  lpf.Q.value = 1.5;

  // 바디 공명 (미드 살짝 부스트)
  var body = ctx.createBiquadFilter();
  body.type = 'peaking';
  body.frequency.value = Math.min(f * 2, 400);
  body.Q.value = 1.2;
  body.gain.value = 3;

  var g = ctx.createGain();
  var v = vol * 0.09;
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(v, now + 0.004);      // 4ms 빠른 어택
  g.gain.exponentialRampToValueAtTime(v * 0.38, now + 0.16); // 초기 빠른 감쇠
  g.gain.exponentialRampToValueAtTime(0.001, now + 2.2);     // 긴 감쇠

  o1.connect(lpf);
  o2.connect(lpf);
  lpf.connect(body);
  body.connect(g);
  g.connect(ctx.destination);
  o1.start(now); o1.stop(now + 2.3);
  o2.start(now); o2.stop(now + 2.3);
}

// ── 피아노 음색: 해머 어택 + 인하모닉 배음 + 배음별 개별 decay ────────
function makePianoTone(f, now, vol) {
  var B = 0.00008;
  var harmonics = [
    { n: 1, amp: 1.00,  decay: 2.2 },
    { n: 2, amp: 0.50,  decay: 1.4 },
    { n: 3, amp: 0.22,  decay: 0.9 },
    { n: 4, amp: 0.12,  decay: 0.6 },
    { n: 5, amp: 0.06,  decay: 0.4 },
    { n: 6, amp: 0.025, decay: 0.3 },
  ];

  harmonics.forEach(function(h) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = f * h.n * Math.sqrt(1 + B * h.n * h.n);

    var v = vol * 0.10 * h.amp;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(v, now + 0.002);
    g.gain.exponentialRampToValueAtTime(v * 0.6, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + h.decay);

    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + h.decay + 0.05);
  });

  // 해머 타격 노이즈 (아주 짧은 퍼쿠시브 어택)
  var bufSize = Math.floor(ctx.sampleRate * 0.015);
  var nBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  var nd = nBuf.getChannelData(0);
  for (var k = 0; k < bufSize; k++) nd[k] = (Math.random() * 2 - 1) * (1 - k / bufSize);
  var ns = ctx.createBufferSource();
  ns.buffer = nBuf;
  var hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = 1000;
  var ng = ctx.createGain();
  ng.gain.setValueAtTime(vol * 0.04, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
  ns.connect(hpf);
  hpf.connect(ng);
  ng.connect(ctx.destination);
  ns.start(now);
  ns.stop(now + 0.02);
}

// ── 코드 스케줄 ─────────────────────────────────────────────────
function scheduleChord(note, variant, quality, vol, instr, arpBeatMs) {
  var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
  var ivs = VAR_IV[vk] || [0, 4, 7];

  var freqs = voiceChord(note, ivs);
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
      if (isPiano) {
        makePianoTone(f, t, vol);
      } else {
        makeGuitarTone(f, t, vol * (isArp ? 1.1 : 1));
      }
    });
  });
}

function handleMsg(raw) {
  try {
    var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (m.type === 'playChord') {
      scheduleChord(m.note, m.variant || '', m.quality, m.vol || 0.5, m.instr || 'guitar', m.arpBeatMs);
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
    playChord: (note, variant, quality, vol = 0.5, instr = 'guitar', arpBeatMs) => {
      if (!wvRef.current) return;
      const msg = JSON.stringify({ type: 'playChord', note, variant: variant || '', quality, vol, instr, arpBeatMs });
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
