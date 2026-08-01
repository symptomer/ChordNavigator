// App Store Connect 현재 상태 조회 (읽기 전용)
//   node asc/status.js
// 버전·심사 상태·연결된 빌드·언어·최근 빌드 목록을 한 번에 보여준다.
const fs = require('fs');
const crypto = require('crypto');

const KEY_ID = '4625N6447U';
const ISSUER = '6e48e6c7-afd0-4509-bbd8-0da831b29972';
const KEY_PATH = `${process.env.HOME}/Downloads/AuthKey_${KEY_ID}.p8`;
const APP_ID = '6772862881';

const b64u = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function token() {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }));
  const p = b64u(JSON.stringify({ iss: ISSUER, iat: now, exp: now + 20 * 60, aud: 'appstoreconnect-v1' }));
  const s = crypto.createSign('SHA256');
  s.update(`${h}.${p}`);
  // ⚠️ dsaEncoding은 key 객체 안에 — DER로 나가면 401
  return `${h}.${p}.${b64u(s.sign({ key: fs.readFileSync(KEY_PATH), dsaEncoding: 'ieee-p1363' }))}`;
}
async function asc(method, path, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
module.exports = { asc, APP_ID };

if (require.main === module) {
  (async () => {
    const v = await asc('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=5`);
    console.log('버전:');
    for (const x of v.json.data || []) {
      const b = await asc('GET', `/v1/appStoreVersions/${x.id}/build`);
      const bn = b.json.data?.attributes?.version;
      console.log(`  ${x.attributes.versionString.padEnd(7)}${x.attributes.appStoreState.padEnd(24)}빌드 ${bn ?? '-'}  출시방식 ${x.attributes.releaseType}`);
    }
    const rs = await asc('GET', `/v1/apps/${APP_ID}/reviewSubmissions?limit=5`);
    const live = (rs.json.data || []).filter(x => x.attributes.state !== 'COMPLETE');
    console.log('\n진행 중 심사 제출:', live.length
      ? live.map(x => `${x.attributes.state} (제출 ${x.attributes.submittedDate})`).join(', ')
      : '없음');

    const bs = await asc('GET', `/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`);
    console.log('\n최근 업로드 빌드:');
    (bs.json.data || []).forEach(x =>
      console.log(`  빌드 ${String(x.attributes.version).padEnd(4)}${x.attributes.processingState.padEnd(12)}${x.attributes.uploadedDate}`));
  })();
}
