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
<script>
var ctx = null;

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

function unlock() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') {
      // iOS unlock: play 1-sample silent buffer
      var buf = ctx.createBuffer(1, 1, ctx.sampleRate);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      ctx.resume();
    }
  } catch(e) {}
}

// Try to unlock as soon as the page loads
document.addEventListener('DOMContentLoaded', unlock);
window.addEventListener('load', unlock);

function n2f(note, oct) {
  var s = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  return 440 * Math.pow(2, (s[note] + (oct - 4) * 12 - 9) / 12);
}

function scheduleChord(note, variant, quality, vol) {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  // Resume synchronously then schedule — works on modern iOS WKWebView
  ctx.resume();
  var now = ctx.currentTime;
  var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
  var ivs = VAR_IV[vk] || [0, 4, 7];
  var r = NOTES.indexOf(note);
  if (r < 0) return;
  ivs.slice(0, 5).forEach(function(iv, i) {
    var pc = iv % 12;
    var rootPc = r % 12;
    var diff = (pc - rootPc + 12) % 12;
    var ni = (r + diff) % 12;
    var oct = 4;
    var f = n2f(NOTES[ni], oct);
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
          // trigger unlock after WebView finishes loading
          wvRef.current?.injectJavaScript(`unlock();true;`);
        }}
        onError={e => console.log('WebView error:', e.nativeEvent)}
      />
    </View>
  );
});

export default AudioEngine;
