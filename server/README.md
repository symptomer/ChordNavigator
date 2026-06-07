# ChordNavigator AI 분석 백엔드 (Cloudflare Worker)

앱이 직접 Anthropic API를 부르지 않고 이 Worker를 통해 부릅니다.
- **Anthropic API 키는 Worker 시크릿에만** 존재 (앱엔 없음)
- 호출 전 **RevenueCat로 프리미엄 구독자 검증** (클라이언트 신뢰 X)
- **1일 호출 제한**(KV)으로 비용 폭탄 방지

흐름: `앱 → Worker → Anthropic` / `Worker → RevenueCat(검증)`

---

## 배포 (한 번만)

```bash
cd server
npm install
npm i -g wrangler            # 이미 있으면 생략
wrangler login               # Cloudflare 계정 로그인 (브라우저)

# 1) KV 네임스페이스 생성 → 출력된 id를 wrangler.toml의 <RUN...> 자리에 붙여넣기
wrangler kv namespace create RATE_LIMIT

# 2) 시크릿 등록 (값은 화면에 안 남음)
wrangler secret put ANTHROPIC_API_KEY      # console.anthropic.com 의 API 키
wrangler secret put REVENUECAT_API_KEY     # RevenueCat 공개 SDK 키(appl_...) 또는 v1 secret 키

# 3) 배포
npm run deploy
# → https://chordnavigator-ai.<your-subdomain>.workers.dev 발급됨. 이 URL을 앱에 넣는다.
```

> `REVENUECAT_API_KEY`: RevenueCat의 **공개 SDK 키(appl_...)** 로 `GET /v1/subscribers`가 동작합니다(읽기 전용이라 노출돼도 위험 낮음). 더 엄격히 하려면 v1 secret 키 사용. 어느 쪽이든 **앱이 아니라 Worker 시크릿**에만 둡니다.

## 로컬 테스트

```bash
wrangler dev
# 다른 터미널에서:
curl -X POST http://localhost:8787 -H "content-type: application/json" -d '{
  "appUserId": "<RevenueCat appUserID>",
  "progression": "C Am F G",
  "genre": "팝", "level": "중급", "key": "C", "mode": "major"
}'
```

응답(성공):
```json
{
  "analysis": "...",
  "genre_version": { "chords": "Cmaj7 Am7 Fmaj7 G7", "desc": "..." },
  "level_version": { "chords": "...", "desc": "..." },
  "substitute_version": { "chords": "...", "desc": "..." }
}
```

에러: `403 {"error":"not_premium"}`, `429 {"error":"rate_limited"}`, `400/502 ...`

---

## 앱 쪽 연결 (다음 단계)

`src/tabs/AnalyzeTab.js`에서:
1. **Claude API 키 입력 UI 제거** (더 이상 필요 없음)
2. `api.anthropic.com` 직접 호출 → **이 Worker URL** 호출로 교체
3. body에 `appUserId` 포함 — RevenueCat에서 가져옴:
   ```js
   import Purchases from 'react-native-purchases';
   const appUserId = await Purchases.getAppUserID();
   const res = await fetch('https://chordnavigator-ai.<subdomain>.workers.dev', {
     method: 'POST',
     headers: { 'content-type': 'application/json' },
     body: JSON.stringify({ appUserId, progression: progInput, genre: selGenre, level: selLevel, key: activeKey, mode: selMode }),
   });
   const data = await res.json();
   if (data.error === 'not_premium') { showPaywall(); return; }
   if (data.error === 'rate_limited') { Alert.alert('오늘 사용량을 초과했어요'); return; }
   // data = 분석 결과 JSON
   ```

## 비용/한도 조절
- 모델: `src/index.ts`의 `MODEL` ("claude-sonnet-4-6" → "claude-opus-4-8"로 올리면 더 똑똑·더 비쌈)
- 1일 한도: `wrangler.toml`의 `DAILY_LIMIT`
- 1회 ≈ $0.01 안팎 (Sonnet 기준)
