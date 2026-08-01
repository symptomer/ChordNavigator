// 업로드한 빌드가 Apple 처리(VALID)를 마치면 지정한 버전에 연결한다.
//   node asc/attach-build.js <빌드번호> <버전>      예: node asc/attach-build.js 25 1.0.4
// 심사 제출은 하지 않는다 (제출은 일반탭/사람 몫).
const { asc, APP_ID } = require('./status.js');

const WANT = process.argv[2];
const VERSION = process.argv[3];
if (!WANT || !VERSION) { console.error('사용법: node asc/attach-build.js <빌드번호> <버전>'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  for (let i = 0; i < 40; i++) {                 // 최대 ~40분
    const b = await asc('GET', `/v1/builds?filter[app]=${APP_ID}&limit=10&sort=-uploadedDate`);
    const build = (b.json.data || []).find(x => String(x.attributes.version) === WANT);
    if (!build) {
      console.log(`[${i}] 빌드 ${WANT} 아직 안 보임 (Apple 수신 대기)`);
    } else if (build.attributes.processingState !== 'VALID') {
      console.log(`[${i}] 빌드 ${WANT} ${build.attributes.processingState}`);
    } else {
      const vers = await asc('GET', `/v1/apps/${APP_ID}/appStoreVersions?limit=10`);
      const v = (vers.json.data || []).find(x => x.attributes.versionString === VERSION);
      if (!v) { console.log(`❌ 버전 ${VERSION}을 못 찾음`); process.exit(1); }
      const res = await asc('PATCH', `/v1/appStoreVersions/${v.id}/relationships/build`,
        { data: { type: 'builds', id: build.id } });
      console.log(res.status < 300
        ? `✅ 버전 ${VERSION}에 빌드 ${WANT} 연결 완료 — 심사 제출은 사람이`
        : `❌ 연결 실패 ${res.status} ${JSON.stringify(res.json).slice(0, 200)}`);
      process.exit(res.status < 300 ? 0 : 1);
    }
    await sleep(60000);
  }
  console.log('⏱ 40분 초과 — ASC에서 직접 확인 필요');
})();
