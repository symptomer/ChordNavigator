// asc/metadata.json → App Store Connect 업로드 (버전 1.0.3)
//   node asc/push-metadata.js            ← dry-run (아무것도 안 바꿈, 계획만 출력)
//   node asc/push-metadata.js --apply    ← 실제 반영
//
// 하는 일
//  1) 버전 1.0.3이 없으면 생성 (편집 가능 상태여야 로컬라이제이션이 붙는다)
//  2) 버전별 문안(설명·키워드·프로모션·변경사항) 10개 언어 생성/수정
//  3) 앱 이름·부제(appInfoLocalizations) 10개 언어 생성/수정
// ⚠️ 심사 제출은 하지 않는다. 제출 버튼은 사람이 누른다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_ID = '4625N6447U';
const ISSUER = '6e48e6c7-afd0-4509-bbd8-0da831b29972';
const KEY_PATH = `${process.env.HOME}/Downloads/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6772862881';
const VERSION = '1.0.3';

const APPLY = process.argv.includes('--apply');
const META = JSON.parse(fs.readFileSync(path.join(__dirname, 'metadata.json'), 'utf8')).locales;

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' }));
  const s = crypto.createSign('SHA256');
  s.update(`${h}.${p}`);
  // ASC는 JOSE(r||s) 서명을 요구 — dsaEncoding을 key 객체 안에 넣어야 한다(DER로 나가면 401)
  return `${h}.${p}.${b64u(s.sign({ key: fs.readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' }))}`;
}
async function asc(method, p, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  if (res.status >= 400) {
    const detail = json?.errors?.map(e => `${e.title}: ${e.detail}`).join(' | ') || txt.slice(0, 300);
    throw new Error(`${method} ${p} → ${res.status}  ${detail}`);
  }
  return json;
}
const log = (...a) => console.log(...a);

(async () => {
  log(APPLY ? '=== 실제 반영 모드 (--apply) ===' : '=== dry-run — 아무것도 바꾸지 않음 ===\n');

  // 1) 버전 확보
  const vers = await asc('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
  let version = vers.data.find(v => v.attributes.versionString === VERSION);
  if (version) {
    log(`버전 ${VERSION} 이미 있음 (${version.attributes.appStoreState}) id=${version.id}`);
  } else {
    log(`버전 ${VERSION} 없음 → 생성 필요`);
    if (APPLY) {
      const created = await asc('POST', '/v1/appStoreVersions', {
        data: {
          type: 'appStoreVersions',
          attributes: { platform: 'IOS', versionString: VERSION },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      });
      version = created.data;
      log(`  → 생성됨 id=${version.id}`);
    }
  }

  // 2) 버전별 문안
  if (version) {
    const existing = await asc('GET', `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);
    const byLocale = Object.fromEntries(existing.data.map(l => [l.attributes.locale, l]));
    log(`\n[버전 문안] 기존 언어: ${Object.keys(byLocale).join(', ') || '(없음)'}`);
    for (const [locale, m] of Object.entries(META)) {
      const attrs = {
        description: m.description,
        keywords: m.keywords,
        promotionalText: m.promotionalText,
        whatsNew: m.whatsNew,
        supportUrl: 'https://symptomer.github.io/ChordNavigator/privacy-policy',
      };
      const cur = byLocale[locale];
      log(`  ${locale.padEnd(8)} ${cur ? '수정(PATCH)' : '생성(POST)'}`);
      if (!APPLY) continue;
      if (cur) {
        await asc('PATCH', `/v1/appStoreVersionLocalizations/${cur.id}`,
          { data: { type: 'appStoreVersionLocalizations', id: cur.id, attributes: attrs } });
      } else {
        await asc('POST', '/v1/appStoreVersionLocalizations', {
          data: {
            type: 'appStoreVersionLocalizations',
            attributes: { locale, ...attrs },
            relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } } },
          },
        });
      }
    }
  } else {
    log('\n[버전 문안] 버전이 없어 건너뜀 (dry-run이라 생성 안 함)');
  }

  // 3) 앱 이름·부제 — 편집 가능한 appInfo에만 붙는다
  const infos = await asc('GET', `/v1/apps/${APP_ID}/appInfos`);
  const editable = infos.data.find(i => i.attributes.appStoreState !== 'READY_FOR_SALE');
  if (!editable) {
    log('\n[이름·부제] 편집 가능한 appInfo 없음 — 버전 1.0.3을 먼저 만들어야 생긴다');
  } else {
    const locs = await asc('GET', `/v1/appInfos/${editable.id}/appInfoLocalizations?limit=50`);
    const byLocale = Object.fromEntries(locs.data.map(l => [l.attributes.locale, l]));
    log(`\n[이름·부제] appInfo ${editable.id} (${editable.attributes.appStoreState}) 기존: ${Object.keys(byLocale).join(', ')}`);
    for (const [locale, m] of Object.entries(META)) {
      const attrs = { name: m.name, subtitle: m.subtitle };
      const cur = byLocale[locale];
      log(`  ${locale.padEnd(8)} ${cur ? '수정(PATCH)' : '생성(POST)'}  "${m.subtitle}"`);
      if (!APPLY) continue;
      if (cur) {
        await asc('PATCH', `/v1/appInfoLocalizations/${cur.id}`,
          { data: { type: 'appInfoLocalizations', id: cur.id, attributes: attrs } });
      } else {
        await asc('POST', '/v1/appInfoLocalizations', {
          data: {
            type: 'appInfoLocalizations',
            attributes: { locale, ...attrs },
            relationships: { appInfo: { data: { type: 'appInfos', id: editable.id } } },
          },
        });
      }
    }
  }

  log(APPLY ? '\n✅ 반영 완료 — ASC에서 확인 후 사람이 제출' : '\n(실제 반영하려면 --apply)');
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
