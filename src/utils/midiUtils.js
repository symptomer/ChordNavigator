import { VAR_IV } from '../data/musicData';
import { ki, getVariantKey } from './musicUtils';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const NOTE_MAP = {
  C:60,'C#':61,D:62,'D#':63,E:64,F:65,'F#':66,G:67,'G#':68,A:69,'A#':70,B:71
};

function vle(v) {
  if (v < 128) return [v];
  const r = [];
  while (v > 0) { r.unshift(v & 0x7F); v >>= 7; }
  for (let i = 0; i < r.length - 1; i++) r[i] |= 0x80;
  return r;
}

export async function exportMIDI(progression, bpm) {
  const tpb    = 480;
  const tempo  = Math.round(60000000 / bpm);
  const evts   = [[0, 0xFF, 0x51, 0x03,
    (tempo >> 16) & 0xFF, (tempo >> 8) & 0xFF, tempo & 0xFF]];

  progression.forEach(p => {
    const rn  = NOTE_MAP[p.note] || 60;
    // variant가 손실된 경우(저장 후 불러오기 등) name에서 재추출
    const suffix = p.name ? p.name.replace(p.note, '') : '';
    const vk  = (suffix && VAR_IV[suffix] !== undefined)
      ? suffix
      : getVariantKey(p.variant, p.quality);
    const ivs = VAR_IV[vk] || [0, 4, 7];
    // 인터벌 정규화: 14(9th), 17(11th), 21(13th) 등 12 초과값을 루트 기준 1옥타브 이내로
    const ns  = ivs.map(iv => {
      const diff = (iv % 12 - rn % 12 + 12) % 12;
      return rn + diff;
    });
    ns.forEach(n => evts.push([0, 0x90, n, 80]));
    const dur = tpb * 4;
    ns.forEach((n, i) => evts.push([i === 0 ? dur : 0, 0x80, n, 0]));
  });
  evts.push([0, 0xFF, 0x2F, 0x00]);

  const flat = [];
  evts.forEach(e => {
    const [dt, ...rest] = e;
    vle(dt).forEach(b => flat.push(b));
    rest.forEach(b => flat.push(b));
  });
  const tl = flat.length;
  const midi = [
    0x4D,0x54,0x68,0x64, 0,0,0,6, 0,0, 0,1,
    (tpb >> 8) & 0xFF, tpb & 0xFF,
    0x4D,0x54,0x72,0x6B,
    (tl >> 24) & 0xFF, (tl >> 16) & 0xFF, (tl >> 8) & 0xFF, tl & 0xFF,
    ...flat,
  ];

  // reduce로 btoa 처리 — spread(...) 방식은 큰 배열에서 스택 오버플로우 위험
  const base64 = btoa(midi.reduce((s, b) => s + String.fromCharCode(b), ''));
  const path   = FileSystem.cacheDirectory + 'chords.mid';
  await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(path, { mimeType: 'audio/midi', dialogTitle: 'MIDI 내보내기' });
}
