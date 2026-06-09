import React, { createContext, useContext, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AudioEngine from '../components/AudioEngine';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const audioRef = useRef(null);

  // Key / mode
  const [selKey,  setSelKey]  = useState('C');
  const [selMode, setSelMode] = useState('major');

  // Navigator state
  const [transKey,   setTransKey]   = useState(null);
  const [curChord,   setCurChord]   = useState(null);
  const [curVar,     setCurVar]     = useState('');
  const [progression,setProgression]= useState([]);
  const [selScale,   setSelScale]   = useState(null);
  const [curInstr,   setCurInstr]   = useState('guitar');
  const [strumMode,  setStrumMode]  = useState('strum'); // 'strum' | 'arp'
  const [selGenre,   setSelGenre]   = useState('pop');
  const [selLevel,   setSelLevel]   = useState('mid');
  const [vol,        setVol]        = useState(0.5);
  const [bpm,        setBpm]        = useState(80);
  const [maxProg,    setMaxProg]    = useState(64);
  const [measureBreaks, setMeasureBreaks] = useState([0]); // 각 마디 시작 인덱스
  const [timeSig,    setTimeSig]    = useState('4/4'); // 박자표: '4/4' | '3/4'
  const [apiKey,     setApiKeyState]= useState('');
  const [saved,      setSaved]      = useState([]);

  const activeKey = transKey ?? selKey;

  async function loadSaved() {
    try {
      const raw = await AsyncStorage.getItem('cnav_v3');
      if (raw) setSaved(JSON.parse(raw));
    } catch (_) {}
  }

  async function saveProg() {
    if (!progression.length) return false;
    const entry = {
      key:    activeKey,
      mode:   selMode,
      chords: progression.map(p => p.name),
      date:   new Date().toLocaleDateString('ko-KR'),
    };
    const next = [entry, ...saved].slice(0, 20);
    setSaved(next);
    await AsyncStorage.setItem('cnav_v3', JSON.stringify(next));
    return true;
  }

  async function deleteSaved(i) {
    const next = saved.filter((_, idx) => idx !== i);
    setSaved(next);
    await AsyncStorage.setItem('cnav_v3', JSON.stringify(next));
  }

  async function setApiKey(key) {
    setApiKeyState(key);
    await AsyncStorage.setItem('cnav_apikey', key);
  }

  async function loadApiKey() {
    const k = await AsyncStorage.getItem('cnav_apikey');
    if (k) setApiKeyState(k);
  }

  function playChord(note, variant, quality, arpBeatMs, bass) {
    let instr = curInstr;
    if (strumMode === 'arp') instr = curInstr === 'guitar' ? 'guitar-arp' : 'piano-arp';
    audioRef.current?.playChord(note, variant, quality, vol, instr, arpBeatMs, bass);
  }

  // 화면에 표시된 운지(기타 프렛/피아노 건반)에서 계산한 MIDI를 그대로 발음 → 소리=그림
  function playVoicing(midis, arpBeatMs) {
    let instr = curInstr;
    if (strumMode === 'arp') instr = curInstr === 'guitar' ? 'guitar-arp' : 'piano-arp';
    audioRef.current?.playVoicing(midis, vol, instr, arpBeatMs);
  }

  function resetNavigator() {
    setTransKey(null);
    setCurChord(null);
    setCurVar('');
    setProgression([]);
    setSelScale(null);
    setMeasureBreaks([0]);
  }

  return (
    <AppContext.Provider value={{
      selKey, setSelKey, selMode, setSelMode,
      transKey, setTransKey, activeKey,
      curChord, setCurChord, curVar, setCurVar,
      progression, setProgression,
      selScale, setSelScale,
      curInstr, setCurInstr, strumMode, setStrumMode,
      selGenre, setSelGenre,
      selLevel, setSelLevel,
      vol, setVol, bpm, setBpm, maxProg, setMaxProg,
      measureBreaks, setMeasureBreaks,
      timeSig, setTimeSig,
      apiKey, setApiKey, loadApiKey,
      saved, loadSaved, saveProg, deleteSaved,
      playChord, playVoicing, resetNavigator,
    }}>
      <AudioEngine ref={audioRef} />
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
