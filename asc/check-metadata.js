// ASC 메타데이터 글자수·형식 검사 — 업로드 전에 반드시 통과시킬 것
// 실행: node asc/check-metadata.js
const fs = require('fs');
const path = require('path');

const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'metadata.json'), 'utf8'));

// App Store Connect 제한
const LIMIT = { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000, whatsNew: 4000 };
const REQUIRED = Object.keys(LIMIT);

let errors = 0, warns = 0;
const rows = [];

for (const [locale, m] of Object.entries(META.locales)) {
  for (const f of REQUIRED) {
    if (!m[f] || !String(m[f]).trim()) { console.log(`✗ ${locale}.${f} 비어 있음`); errors++; continue; }
    const len = [...String(m[f])].length;           // 유니코드 코드포인트 기준
    if (len > LIMIT[f]) { console.log(`✗ ${locale}.${f} ${len}자 > 제한 ${LIMIT[f]}`); errors++; }
    else if (len > LIMIT[f] * 0.95 && LIMIT[f] <= 170) { console.log(`⚠ ${locale}.${f} ${len}/${LIMIT[f]} — 여유 없음`); warns++; }
  }
  // 키워드: 쉼표 뒤 공백은 글자수 낭비, 중복도 낭비
  const kws = String(m.keywords || '').split(',');
  if (kws.some(k => k !== k.trim())) { console.log(`✗ ${locale}.keywords 쉼표 주변 공백`); errors++; }
  const dup = kws.filter((k, i) => kws.indexOf(k) !== i);
  if (dup.length) { console.log(`✗ ${locale}.keywords 중복: ${dup.join(', ')}`); errors++; }
  // 변경사항은 과거 ASC가 특수문자를 거부한 적 있음 → 불릿/가운뎃점 금지
  const bad = String(m.whatsNew).match(/[•·♭♯—]/g);
  if (bad) { console.log(`✗ ${locale}.whatsNew 특수문자 ${[...new Set(bad)].join(' ')} — '-'만 쓸 것`); errors++; }

  rows.push([locale, ...REQUIRED.map(f => `${[...String(m[f] || '')].length}/${LIMIT[f]}`)]);
}

console.log('\nlocale     ' + REQUIRED.map(f => f.slice(0, 9).padEnd(10)).join(''));
rows.forEach(r => console.log(r[0].padEnd(11) + r.slice(1).map(c => c.padEnd(10)).join('')));

console.log(errors === 0 ? `\n✅ ${Object.keys(META.locales).length}개 언어 전부 통과${warns ? ` (경고 ${warns})` : ''}`
                         : `\n❌ 오류 ${errors}건`);
process.exit(errors ? 1 : 0);
