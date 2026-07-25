// ── 다국어(i18n) 검증 하네스 ────────────────────────────────────
// 실행:  node src/i18n/check.js      (프로젝트 루트에서)
// 검사 6종
//  1) src 전 파일 babel 파싱(문법)
//  2) 두 번역 테이블 로드 + 키 충돌
//  3) 키마다 10개 언어 다 있는지 / 빈 값·미지원 언어코드
//  4) 코드가 쓰는 t('키')가 테이블에 있는지, 안 쓰이는 키
//  5) 자리표시자({n} 등)가 언어끼리 같은지 + 호출부가 그 값을 넘기는지
//  6) 지역변수·파라미터 t 가 i18n t()를 가리는지 (실제로 터졌던 버그)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const { parse } = require(path.join(ROOT, 'node_modules/@babel/parser'));

const LANGS = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'pt', 'ru', 'it'];

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(path.join(ROOT, 'src'));
let errors = 0;

// 1) 문법
for (const f of files) {
  try {
    parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    console.log(`✗ 문법오류 ${path.relative(ROOT, f)}: ${e.message}`);
    errors++;
  }
}
console.log(`문법: ${files.length}개 파일 검사, 오류 ${errors}`);

// 2) 테이블 로드 (import 없는 순수 객체라 잘라내서 eval)
function loadTable(file, exportName) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const objSrc = src
    .replace(new RegExp('^[\\s\\S]*?export const ' + exportName + ' = '), '')
    .replace(/;\s*$/, '');
  return eval('(' + objSrc + ')');
}
const CORE   = loadTable('src/i18n/strings.js', 'STRINGS');
const MANUAL = loadTable('src/i18n/strings_manual.js', 'MANUAL_STRINGS');
const dupes  = Object.keys(MANUAL).filter(k => CORE[k]);
if (dupes.length) { console.log(`✗ 키 충돌(두 테이블에 같은 키): ${dupes.join(', ')}`); errors++; }
const STRINGS = { ...CORE, ...MANUAL };
const keys = Object.keys(STRINGS);
console.log(`키: ${keys.length}개 (UI ${Object.keys(CORE).length} + 설명서 ${Object.keys(MANUAL).length})`);

// 3) 언어 누락 / 빈 값 / 미지원 코드
for (const k of keys) {
  const miss = LANGS.filter(l => STRINGS[k][l] == null || String(STRINGS[k][l]).trim() === '');
  if (miss.length) { console.log(`✗ 언어누락 ${k}: ${miss.join(',')}`); errors++; }
  const extra = Object.keys(STRINGS[k]).filter(l => !LANGS.includes(l));
  if (extra.length) { console.log(`✗ 미지원 언어코드 ${k}: ${extra.join(',')}`); errors++; }
}

// 4) 사용/미사용 키
// 번역 테이블 자체만 제외 — i18n/index.js의 posLabel()처럼 헬퍼 안에서 쓰는 t()도 사용으로 잡아야 함
const srcFiles = files.filter(f => !/strings(_manual)?\.js$|check\.js$/.test(f));
const used = new Set();
for (const f of srcFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/\bt\(\s*'([^']+)'/g)) {
    used.add(m[1]);
    if (!STRINGS[m[1]]) { console.log(`✗ 없는 키 사용: '${m[1]}' (${path.relative(ROOT, f)})`); errors++; }
  }
}
// t(mood) · t(role.key) · t(tab.labelKey)처럼 동적으로 도는 키는 접두사로 인정
const DYNAMIC = /^(role|genre|mood|tip|tab)[A-Z]/;
// 키 이름을 배열에 담아 t(k)로 도는 경우(FREE_FEATURE_KEYS 등)도 사용으로 인정
const allSrc = srcFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const unused = keys.filter(k => !used.has(k) && !DYNAMIC.test(k) && !allSrc.includes(`'${k}'`));
console.log(`정적 사용 키: ${used.size}개 / 미사용: ${unused.length}개${unused.length ? ' → ' + unused.join(', ') : ''}`);

// 5) 자리표시자 일치
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// t('key', { a: f(x, y), b }) 의 프로퍼티 이름만 뽑는다.
// 중첩 호출의 쉼표에서 쪼개지면 안 되므로 괄호 깊이 0인 쉼표에서만 자른다. 축약({ b })도 인식.
function splitProps(body) {
  if (!body) return [];
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of body) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  parts.push(cur);
  return parts
    .map(p => (p.includes(':') ? p.slice(0, p.indexOf(':')) : p).trim())
    .filter(Boolean);
}
for (const k of keys) {
  const base = ph(STRINGS[k].en);
  for (const l of LANGS) {
    if (ph(STRINGS[k][l]) !== base) {
      console.log(`✗ 자리표시자 불일치 ${k}.${l}: [${ph(STRINGS[k][l])}] ≠ en[${base}]`);
      errors++;
    }
  }
}
for (const f of srcFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/\bt\(\s*'([^']+)'\s*(?:,\s*\{([^{}]*)\})?\s*\)/g)) {
    const key = m[1];
    if (!STRINGS[key]) continue;
    const need = ph(STRINGS[key].en);
    const got = splitProps(m[2]).sort().join(',');
    if (need !== got) {
      console.log(`✗ 파라미터 불일치 ${path.relative(ROOT, f)} t('${key}'): 필요[${need}] 전달[${got}]`);
      errors++;
    }
  }
}

// 6) t() 가림 — 실제로 ChordsTab(클리셰)·NavigatorScreen(탭바)에서 났던 버그
for (const f of srcFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  if (!/from '\.\.?\/i18n'/.test(txt)) continue;
  txt.split('\n').forEach((ln, i) => {
    if (/\b(const|let|var)\s+t\s*=/.test(ln) || /\(\s*t\s*[,)]/.test(ln)) {
      console.log(`✗ t() 가림 의심 ${path.relative(ROOT, f)}:${i + 1}: ${ln.trim().slice(0, 90)}`);
      errors++;
    }
  });
}

console.log(errors === 0 ? '\n✅ 전부 통과' : `\n❌ 문제 ${errors}건`);
process.exit(errors ? 1 : 0);
