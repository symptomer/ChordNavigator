// ── 다국어(i18n) — 기기 언어 자동 감지 + t() 조회 ───────────────────
// 지원 언어: 한국어·영어·일본어·중국어·스페인어·프랑스어·독일어·포르투갈어·러시아어·이탈리아어
import { getLocales } from 'expo-localization';
import { STRINGS } from './strings';

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
 * t('play')  또는  t('addN', { n: 3 })  (문자열 안 {n} 치환)
 */
export function t(key, params) {
  const entry = STRINGS[key];
  let s = entry
    ? (entry[LANG] != null ? entry[LANG] : entry.en != null ? entry.en : key)
    : key;
  if (params) {
    Object.keys(params).forEach(k => { s = String(s).split('{' + k + '}').join(params[k]); });
  }
  return s;
}

// AI 응답 언어명 (Worker에 전달 → 해당 언어로 답)
export const LANG_NAME = {
  ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Chinese',
  es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  ru: 'Russian', it: 'Italian',
}[LANG] || 'English';
