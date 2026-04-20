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
<!-- 무음 오디오 요소 — iOS 오디오 세션 활성화용 -->
<audio id="sil" autoplay loop muted playsinline
  src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAA">
</audio>
<script>
var ctx = null;
var pending = [];  // 컨텍스트 준비 전 대기 중인 재생 함수들

var NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var VAR_IV = {
  '':    [0,4,7],
  'maj7':[0,4,7,11],
  '7':   [0,4,7,10],
  'add9':[0,4,7,2],
  'sus4':[0,5,7],
  'sus2':[0,2,7],
  '6':   [0,4,7,9],
  'm':   [0,3,7],
  'm7':  [0,3,7,10],
  'm9':  [0,3,7,10,2],
  'm11': [0,3,7,10,5],
  'm6':  [0,3,7,9],
  '9':   [0,4,7,10,2],
  '13':  [0,4,7,10,9],
  'maj9':[0,4,7,11,2],
  '\u00b0':  [0,3,6],
  '\u00b07': [0,3,6,9],
  '\u00f87': [0,3,6,10]
};

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
  toRun.forEach(function(fn) {
    try { fn(); } catch(e) {}
  });
}

function unlock() {
  var c = getCtx();
  // 오디오 요소로 iOS 오디오 세션 활성화 시도
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
    // resume 시도 — iOS allowsInlineMediaPlayback+!mediaPlaybackRequiresUserAction 시 작동
    c.resume().then(flushPending).catch(function(){});
  }
}

function n2f(note, oct) {
  var s = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  return 440 * Math.pow(2, (s[note] + (oct - 4) * 12 - 9) / 12);
}

function scheduleChord(note, variant, quality, vol) {
  var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
  var ivs = VAR_IV[vk] || [0, 4, 7];
  var r = NOTES.indexOf(note);
  if (r < 0) return;

  playWhenReady(function() {
    var now = ctx.currentTime;
    ivs.slice(0, 5).forEach(function(iv, i) {
      var diff = (iv % 12 - r % 12 + 12) % 12;
      var ni   = (r + diff) % 12;
      var f    = n2f(NOTES[ni], 4);
      var delay = i * 0.05;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      var v = (vol || 0.5) * 0.2;
      g.gain.setValueAtTime(0.001, now + delay);
      g.gain.linearRampToValueAtTime(v, now + delay + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + delay + 1.4);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + delay);
      o.stop(now + delay + 1.5);
    });
  });
}

function handleMsg(raw) {
  try {
    var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (m.type === 'playChord') {
      scheduleChord(m.note, m.variant || '', m.quality, m.vol || 0.5);
    } else if (m.type === 'unlock') {
      unlock();
    }
  } catch(e) {}
}

window.addEventListener('message', function(e) { handleMsg(e.data); });
document.addEventListener('message', function(e) { handleMsg(e.data); });

// 페이지 로드 후 즉시 unlock 시도
window.addEventListener('load', unlock);
document.addEventListener('DOMContentLoaded', unlock);
<\/script>
</body>
</html>`;

const AudioEngine = forwardRef((props, ref) => {
  const wvRef = useRef(null);

  useImperativeHandle(ref, () => ({
    playChord: (note, variant, quality, vol = 0.5) => {
      if (!wvRef.current) return;
      const msg = JSON.stringify({ type: 'playChord', note, variant: variant || '', quality, vol });
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
