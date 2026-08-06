// 릴리스노트(whatsNew)만 ASC에 쓴다.
//   node asc/push-release-notes.js 1.0.5            ← dry-run
//   node asc/push-release-notes.js 1.0.5 --apply    ← 실제 반영
//
// 🔴 whatsNew 하나만 PATCH 한다. 설명·키워드·부제·프로모션은 절대 건드리지 않는다
//    (일반탭이 ASC에서 직접 입력한 내용이라 덮어쓰면 사고. `eas metadata:push`가
//     금지된 이유와 같다.)
// 심사 제출은 하지 않는다.
const fs = require('fs');
const path = require('path');
const { asc, APP_ID } = require('./status.js');

const VERSION = process.argv[2];
const APPLY = process.argv.includes('--apply');
if (!VERSION) { console.error('사용법: node asc/push-release-notes.js <버전> [--apply]'); process.exit(1); }

const file = path.join(__dirname, `release-notes-${VERSION}.json`);
if (!fs.existsSync(file)) { console.error(`파일 없음: ${file}`); process.exit(1); }
const NOTES = JSON.parse(fs.readFileSync(file, 'utf8')).notes;

// ASC가 거부한 전력이 있는 특수문자 사전 차단
const BAD = /[•·♭♯]/;

(async () => {
  console.log(APPLY ? '=== 실제 반영 (--apply) ===\n' : '=== dry-run — 아무것도 바꾸지 않음 ===\n');

  let bad = 0;
  for (const [loc, text] of Object.entries(NOTES)) {
    const len = [...text].length;
    if (len > 4000) { console.log(`✗ ${loc} ${len}자 > 4000`); bad++; }
    const m = text.match(BAD);
    if (m) { console.log(`✗ ${loc} 특수문자 ${m[0]} — ASC가 거부한 전력 있음`); bad++; }
  }
  if (bad) { console.log('\n❌ 먼저 고치세요'); process.exit(1); }

  const vers = await asc('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  const v = (vers.json.data || []).find(x => x.attributes.versionString === VERSION);
  if (!v) { console.log(`❌ 버전 ${VERSION} 없음`); process.exit(1); }
  if (v.attributes.appStoreState !== 'PREPARE_FOR_SUBMISSION') {
    console.log(`❌ ${VERSION} 상태가 ${v.attributes.appStoreState} — 편집 가능한 상태가 아님`);
    process.exit(1);
  }

  const locs = await asc('GET', `/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  const byLocale = Object.fromEntries((locs.json.data || []).map(l => [l.attributes.locale, l]));

  for (const [loc, text] of Object.entries(NOTES)) {
    const cur = byLocale[loc];
    if (!cur) { console.log(`⚠ ${loc} — 이 버전에 없는 언어, 건너뜀`); continue; }
    const had = cur.attributes.whatsNew ? '덮어씀' : '새로 씀';
    console.log(`  ${loc.padEnd(9)}${had}  ${[...text].length}자`);
    if (!APPLY) continue;
    const res = await asc('PATCH', `/v1/appStoreVersionLocalizations/${cur.id}`,
      { data: { type: 'appStoreVersionLocalizations', id: cur.id, attributes: { whatsNew: text } } });
    if (res.status >= 400) { console.log(`   ❌ 실패 ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`); process.exit(1); }
  }

  console.log(APPLY ? '\n✅ 릴리스노트 반영 완료 — 심사 제출은 사람이' : '\n(실제 반영하려면 --apply)');
})();
