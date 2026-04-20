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
var unlocked = false;

var NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
var VAR_IV = {
  '':    [0,4,7],
  'maj7':[0,4,7,11],
  '7':   [0,4,7,10],
  'add9':[0,4,7,14],
  'sus4':[0,5,7],
  'sus2':[0,2,7],
  '6':   [0,4,7,9],
  'm':   [0,3,7],
  'm7':  [0,3,7,10],
  'm9':  [0,3,7,10,14],
  'm6':  [0,3,7,9],
  '\u00b0':  [0,3,6],
  '\u00b07': [0,3,6,9],
  '\u00f87': [0,3,6,10]
};

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function n2f(note, oct) {
  var s = {C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11};
  return 440 * Math.pow(2, (s[note] + (oct - 4) * 12 - 9) / 12);
}

function playChord(note, variant, quality, vol) {
  try {
    var c = getCtx();
    c.resume().then(function() {
      var now = c.currentTime;
      var vk = variant || (quality === 'min' ? 'm' : quality === 'dim' ? '\u00b0' : '');
      var ivs = VAR_IV[vk] || [0, 4, 7];
      var r = NOTES.indexOf(note);
      if (r < 0) return;
      ivs.forEach(function(iv, i) {
        var ni = (r + iv) % 12;
        var oct = 3 + ((r + iv) >= 12 ? 1 : 0);
        var f = n2f(NOTES[ni], oct);
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        var v = (vol || 0.5) * 0.22;
        g.gain.setValueAtTime(0, now + i * 0.04);
        g.gain.linearRampToValueAtTime(v, now + i * 0.04 + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 1.2);
        o.connect(g);
        g.connect(c.destination);
        o.start(now + i * 0.04);
        o.stop(now + i * 0.04 + 1.3);
      });
    });
  } catch(e) {
    console.log('Audio error: ' + e.message);
  }
}

function handleMsg(raw) {
  try {
    var m = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (m.type === 'playChord') {
      playChord(m.note, m.variant || '', m.quality, m.vol || 0.5);
    }
  } catch(e) {
    console.log('Parse error: ' + e.message);
  }
}

// Both message event styles for iOS/Android WebView
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
      // Use postMessage for reliability on iOS
      wvRef.current.injectJavaScript(
        `handleMsg(${JSON.stringify(JSON.stringify({ type:'playChord', note, variant: variant||'', quality, vol }))});true;`
      );
    },
  }));

  return (
    <View style={{ position:'absolute', width:1, height:1, opacity:0 }}>
      <WebView
        ref={wvRef}
        source={{ html: AUDIO_HTML }}
        javaScriptEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        onError={e => console.log('WebView error:', e)}
      />
    </View>
  );
});

export default AudioEngine;
