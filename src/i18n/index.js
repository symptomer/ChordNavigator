// ── 다국어(i18n) — 기기 언어 자동 감지 + t() 조회 ───────────────────
// 지원 언어: 한국어·영어·일본어·중국어·스페인어·프랑스어·독일어·포르투갈어·러시아어·이탈리아어
import { getLocales } from 'expo-localization';
import { STRINGS } from './strings';
import { MANUAL_STRINGS } from './strings_manual';

// UI 문자열 + 사용설명서 문자열을 한 테이블로 (키 이름이 겹치면 안 됨 — 설명서는 m 접두사)
const TABLE = { ...STRINGS, ...MANUAL_STRINGS };

export const SUPPORTED = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'it'];

function detectLang() {
  try {
    const locales = getLocales() || [];
    for (const l of locales) {
      const code = (l.languageCode || '').toLowerCase();
      if (SUPPORTED.includes(code)) return code;
    }
  } catch (e) {}
  return 'en'; // 미지원 언어는 영어로
}

// 앱 실행 시 한 번 결정 (기기 언어 기준). 인앱 전환 없음 = MetroEye와 동일 방식
export const LANG = detectLang();

/**
 * 번역 조회 (키 기준: STRINGS[key] = { ko, en, ja, ... }). 없으면 영어 → 키 폴백.
 * t('play')  또는  t('measureN', { n: 3 })  (문자열 안 {n} 치환)
 */
export function t(key, params) {
  const entry = TABLE[key];
  let s = entry
    ? (entry[LANG] != null ? entry[LANG] : entry.en != null ? entry.en : key)
    : key;
  if (params) {
    Object.keys(params).forEach(k => { s = String(s).split('{' + k + '}').join(params[k]); });
  }
  return s;
}

/**
 * 기타 포지션 라벨 번역.
 * musicData의 pos는 '오픈' / '7프렛' / 'A형 3프렛' 세 가지 형태뿐이라
 * 400개 문자열을 다 번역하지 않고 여기서 패턴으로 푼다.
 */
export function posLabel(pos) {
  if (!pos) return pos;
  if (pos === '오픈') return t('posOpen');
  const shaped = pos.match(/^([A-G])형\s*(\d+)프렛$/);
  if (shaped) return t('posShapeFret', { shape: shaped[1], fret: shaped[2] });
  const fret = pos.match(/^(\d+)프렛$/);
  if (fret) return t('posFret', { fret: fret[1] });
  return pos;
}

// AI 응답 언어명 (Worker에 전달 → 해당 언어로 답)
export const LANG_NAME = {
  ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese',
  es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  ru: 'Russian', it: 'Italian',
}[LANG] || 'English';
