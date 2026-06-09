# ChordNavigator — 다음 세션 작업 계획

**프로젝트 경로:** `/Users/symptomer/Documents/ChordNavigator`
**최근 작업:** 2026-06-08 (9차) — ✅✅✅ **1.0.1 (빌드 14) 심사 통과 = App Store 출시 완료!**
**현재 브랜치:** main · **GitHub:** https://github.com/symptomer/ChordNavigator
**ascAppId** `6772862881` · **로그인** appstoreconnect.apple.com (Apple ID: KANG DOSEONG / symptomers@naver.com)

## ✅ 현재 상태: 1.0.1 출시됨 (2026-06-08 심사 통과)
1.0.1 = 보이스리딩·소리/운지 정합성·음색 + AI 백엔드(Worker+Gemini, **사용자 API키 입력 제거**) + AnalyzeTab 진행 자동채움 + 홈 상시 프리미엄 버튼 + ASO 키워드 강화. **앱 정상 동작 확인 완료.**

---

# 🎯 다음 세션 할 일 — 1.0.2 수정사항

> **새 세션은 여기부터.** 아래는 다음 버전(1.0.2)에 넣을 수정/개선 목록.
> 작업 흐름: 코드 수정 → 커밋·푸시 → `eas build -p ios --profile production`(autoIncrement, build#15+) → `eas submit` → ASC 버전 1.0.2 생성·빌드연결·변경사항입력 → 제출.

### 🆕 사용자 요청 수정사항 (2026-06-09 접수 — 코드 수정은 대부분 완료, 빌드/배포만 남음)

**1. AI 분석 오류 (스크린샷: `gemini 429`)**
- **원인:** Worker는 정상. **Gemini 무료 등급 일일 할당량 초과**로 Gemini가 429 거절. 게다가 raw JSON 에러가 사용자에게 그대로 노출되는 버그도 있었음.
- ✅ **코드 수정 완료:**
  - `server/src/index.ts` — Gemini 429/503 → `upstream_busy`로 분류해 `{error:'ai_busy'}`(503) 반환, raw 원문은 로그에만. 기타 실패는 일반 메시지.
  - `src/tabs/AnalyzeTab.js` `runAI()` — `ai_busy` 및 예기치 못한 오류 시 **규칙 기반 분석으로 자동 폴백** + 친절한 안내(raw JSON 노출 제거).
- ⏳ **남은 결정(사용자):** AI 분석은 **유료(프리미엄) 기능**이라 무료 등급으론 계속 429가 남. **Gemini API 결제(pay-as-you-go) 활성화 필요** — `gemini-2.0-flash`는 진행 1건당 1원 미만, 한국 카드 OK. → aistudio.google.com / Google Cloud 콘솔에서 결제 연결. (안 하면 AI는 자동으로 규칙 기반 폴백만 됨.)
- ⏳ **배포:** `server/`에서 `npx wrangler deploy` 필요(앱 빌드와 별개로 Worker 즉시 반영).

**2. 기타 음색 더 어쿠스틱하게**
- ✅ **완료:** `AudioEngine.js` `makeGuitarTone` — 일반음 배음(광택) ↑, 로우패스 오픈 주파수 ↑(어쿠스틱 스틸 밝기), 피킹 어택 노이즈 ↑(또렷한 피킹감), 바디 공명 100/230Hz로 조정.

**3. 마디 복사 버튼**
- ✅ **완료(올바른 파일):** `ChordsTab.js` — 각 마디 헤더에 `⧉ 복사` 버튼(코드 있는 마디만). `copyMeasure(mIdx)` = 해당 마디 코드를 복제해 **바로 아래 새 마디로 삽입**(measureBreaks/maxProg 정합 처리). 보라색 테두리.
- ⚠️ **교훈:** 처음에 `ProgressionTab.js`에 넣었으나 **그 파일은 앱에서 import조차 안 되는 죽은 코드**였음(원복함). **실제 진행 빌더 화면 = `src/tabs/ChordsTab.js`** (NavigatorScreen이 ChordsTab만 사용). ProgressionTab.js는 정리 대상(아래 참고).

**5. 이전(실행취소) 버튼** — *2026-06-09 추가 요청*
- ✅ **완료:** `ChordsTab.js` 헤더의 **초기화 버튼 바로 앞**에 `↩ 이전` 버튼. 1단계 되돌리기. 진행/마디 모든 변경을 `useEffect` 자동 스냅샷 스택(`undoRef`)에 쌓고 `undoStep()`으로 복원. 되돌릴 게 있을 때(`canUndo`)만 표시.

**6. 재생 박자 버그 — 2코드 마디가 2+1박으로 일찍 넘어감** — *2026-06-09 추가 요청*
- **원인:** `getChordBeats`([ChordsTab.js](src/tabs/ChordsTab.js))에 코드별 `beats` 오버라이드가 있는데(기법 교체 `replaceWithTech`가 박음), 3코드 클리셰(2+1+1)에서 코드 하나를 지우면 남은 2코드 오버라이드가 [2,1]=**합 3박**이 되어 마디가 1박 모자라게 끝남.
- ✅ **완료:** `getChordBeats` 정규화 — 마디 안 코드들의 오버라이드가 **모두 있고 합이 정확히 4박일 때만** 그대로 사용, **그 외엔 코드 수 기준 기본 분배로 항상 4박 채움**. → 2코드 마디는 항상 2+2박. (의도적 ♩♩·♪ 박자는 합이 4면 보존.)
- ⚠️ **잔여(경미):** beat 표시 아이콘(♩♩=beats2, ♪=beats0.5)은 저장된 오버라이드를 그대로 읽어, 깨진 오버라이드가 있으면 **재생은 고쳐졌지만 아이콘은 옛 값**을 보일 수 있음. 거슬리면 삭제/교체 시 해당 마디 오버라이드를 비우는 추가 작업 필요.

**7. 5코드 이상 마디 박자 어정쩡** — *2026-06-09 추가 요청*
- **원인:** `getChordBeats`가 5코드↑를 `4/count`(=0.8박 등)로 분배 → 어정쩡.
- ✅ **완료:** `measurePattern(count, per)` 헬퍼 추가 — **1박·0.5박·필요시 0.25박** 깔끔한 음표값으로 항상 마디를 채움. (4/4 5코드=`1·1·1·0.5·0.5`, 8코드=`0.5×8`. 합 항상 4박.)

**8. 박자표 3/4·4/4 선택** — *2026-06-09 추가 요청 (사장님: 4/4+3/4 / 변경 시 마디 자동 재분할)*
- ✅ **완료:**
  - `AppContext.js` — `timeSig`('4/4'|'3/4') 상태 추가.
  - `ChordsTab.js` — 헤더 악기행 아래 **`박자표 4/4 · 3/4`** 선택 버튼. `beatsPerMeasure`(4/4=4,3/4=3)로 `getChordBeats`·`measurePattern`·자동마디분기(코드 N개 차면 새 마디)·addMeasure·deleteMeasure 모두 일반화. `changeTimeSig(ts)` = 기존 코드를 새 박자수만큼 **마디 자동 재분할** + 옛 beats 오버라이드 제거.
  - 실행취소(undo) 스냅샷에 `timeSig` 포함 → 박자표 변경도 되돌림.

**(MIDI) 내보내기 박자 무시 버그** — 점검 중 발견·수정
- **원인:** `midiUtils.js`가 코드당 무조건 4박(`tpb*4`) → 마디 박자·beats 완전 무시.
- ✅ **완료:** `exportMIDI(progression, bpm, beatsArr)`로 변경, `handleExportMIDI`가 `getChordBeats`로 박자 계산해 전달 → MIDI가 앱 재생과 일치(3/4·가변박자 포함).

**9. 운지 다이어그램 위치 → 재생 버튼 바로 아래 고정** — *2026-06-09 추가 요청*
- ✅ **완료:** `ChordsTab.js`에서 운지(diagSection) 블록을 마디들 아래 → **재생/BPM 행 바로 아래**로 이동. 순서: `재생·BPM → 운지 → (저장목록) → 마디들`. 재생 중 스크롤 없이 운지 보임, 멈춰도 그 자리 고정.

**10. 마이너 차용 코드 (C장조에서 Fm 등) → 장↔단 토글** — *2026-06-09 추가 요청 (사장님: 장↔단 토글 방식 선택)*
- **배경:** C장조 그리드엔 F가 Fmaj(IV)만 나옴. Fm은 평행단조 차용(iv). 사장님이 끝에서 마이너로 떨어지는 진행 자주 씀.
- ✅ **완료:** `ChordsTab.js` **변형 코드** 헤더에 `[장조][단조 m]` 토글 추가. `toggleMajMin()` = 선택/편집 중 코드를 같은 루트의 장3화음↔단3화음으로 뒤집음(quality·variant·name 정확히). 슬롯 칩 탭(editIdx)으로 편집 중이면 그 코드 자체 교체.
- 사용법: F 추가 → F 슬롯 탭 → `단조 m` → Fm. (확장은 토글 후 변형 코드 행에서 m7/m9 선택.) 토글 후 변형 행도 단조 변형으로 바뀜.

**11. 기타 소리 리얼화 — 합성 → 실제 어쿠스틱 기타 샘플** — *2026-06-10 추가 요청*
- **배경:** 오실레이터 합성이라 비현실적. 다른 앱처럼 실제 녹음 샘플(사운드폰트)로 교체.
- ✅ **완료:** `AudioEngine.js` — MusyngKite `acoustic_guitar_steel` 샘플(자연음 52개 중 앱 음역 36~90만 디코딩)을 **외부 라이브러리 없이** jsDelivr에서 **데이터만 fetch→디코딩**(원격 코드 실행 X = App Store 안전). 샤프음은 최대 1~2반음 피치시프트. 기타 재생을 `playGuitarSample`로, 실패/오프라인이면 기존 `makeGuitarTone` **자동 폴백**. 베이스는 게인 강조. `unlock()` 시 프리로드. WebView에 `baseUrl: https://chordnav.local/` 추가(fetch/CORS 신뢰성).
  - 관련 상수(빌드 후 청취 조정): `SF_GAIN`(현재 0.62), 베이스/상단 게인 1.15/0.82/0.66, `dur` 2.2s.
  - **피아노는 그대로(합성).** 기타 만족스러우면 같은 방식으로 `acoustic_grand_piano` 교체 가능.
- ⚠️ **유의:** ① 첫 로드 시 인터넷 필요(~1.9MB, 이후 HTTP 캐시). 오프라인 첫 사용 땐 합성음 폴백. ② 메모리 수십 MB(샘플 디코딩) — 최신 기기 OK. ③ **빌드해야 소리 확인** — gain/길이 이상하면 위 상수만 조정.

> ⚠️ **검증 상태:** 위 1·5·6·7·8·9·10·11·MIDI 모두 코드 수정+구문 검증 완료, **단 앱 빌드는 아직 안 함.** 소리/박자/UI는 다음 EAS 빌드 후 실기기 확인 필요. (환경상 소리 직접 못 들음 — 세기/박자 이상하면 숫자만 조정.)

**4. 기타 베이스 음 강조 (피아노만큼 베이스가 안 느껴짐)**
- ✅ **완료:** 피아노는 그대로 두고 **기타 최저음만** 강화 — `makeGuitarTone(isBass)`: 옥타브 아래 사인 서브 레이어, 저역 바디 공명 +9dB, 기본 음량·울림 길이 ↑. 스트럼 루프는 상단 음을 살짝 낮춰(0.92/0.82) 베이스가 상대적으로 또렷.

> ⚠️ **2·3·4번은 앱 빌드해야 들림/보임** — 환경상 소리를 직접 들어보지 못함. 빌드 후 들어보고 **너무 세거나 약하면 알려주세요**(AudioEngine.js의 `isBass` gain 0.115/서브 0.07/body 9, gtrEmph 0.92·0.82 숫자만 조정하면 됨).

### 🧹 기존에 발견된 정리 후보 (확인 후 진행)
1. **AI GPS 죽은 코드 → Worker 전환** — `ChordsTab.js` `fetchGPSRoutes`가 옛 직접-Anthropic 경로(`x-api-key`, `apiKey`). `apiKey`가 항상 빈값('')이라 **AI GPS가 절대 안 돎(항상 규칙 기반 fallback)**. AnalyzeTab처럼 `WORKER_URL`(`https://chordnavigator-ai.symptomer.workers.dev`)로 전환 필요. 설명서 'GPS 추천: AI(프리미엄)' 문구도 이와 정합.
2. **apiKey 죽은 인프라 정리** — AI가 서버로 옮겨져 불필요. `AppContext.js`의 `apiKey`/`setApiKey`/`loadApiKey`, `HomeScreen.js`의 `loadApiKey()` 호출 제거 검토.
3. **음색 추가 튜닝** — 사용자 완전 만족 아님. `AudioEngine.js` `makeGuitarTone`/`makePianoTone`/`bassEmph`(기타/피아노 밝기·감쇠·베이스강조량).
4. **(선택) 부제(subtitle) ASO 업데이트** — 현재 "기타 코드 진행 & 음악 이론" 유지 중. 다음 버전 메타데이터에서 `코드 진행 분석·기타 피아노 운지·작곡`(21자)로 변경 검토. (ASC 배포→버전→상단 부제)

### ⚠️ 작업 시 주의 (이번 세션 교훈)
- `eas submit`·프로덕션 빌드는 자동승인 분류기가 "제출/배포"로 막음 → **사용자 명시 승인** 받고 진행.
- ASC 메타데이터 입력칸은 **특수문자 거부**(♭, • 글머리표, · 가운뎃점 등) → 변경사항/설명엔 일반 문자(`-`)만.
- 라이브에 반영되려면 **새 빌드 필요**. 코드만 고치고 빌드 안 하면 스토어엔 안 바뀜(이번에 #12=옛 버전 혼동 겪음).

---

## 🗄️ 완료 기록 (참고용)
아래는 지난 작업 이력. 새 작업엔 위 "다음 세션 할 일"만 보면 됨.

### 1.0.1 출시 경위 (9차, 2026-06-08)
- 빌드 #13 만들었다가 UX 개선 추가로 **#14 재빌드**(`ac796f8f`) → ASC 업로드 → 버전 1.0.1 생성·빌드14 연결·ASO입력 → 제출(21:39) → **심사 통과·출시**. (#13 `008f07d4`는 불용.) 커밋 `06cc4be`까지 푸시.
- "구독/잠금 안 보임" 디버깅 결론: **버그 아님.** 개발자 본인 기기가 이미 프리미엄(테스트 결제 entitlement)이라 잠금/페이월 숨겨진 것(정상). 친구(신규유저)는 StoreKit 캐시 → **삭제·재시작·재설치로 해결**. 라이브 #12가 AI백엔드 전환 *이전* 빌드라 "API키 물어봄" 혼동 유발 → #14에서 해소.
- 서버·계약·상품·가격·RevenueCat offering 전수 점검 = 전부 정상. 공개스토어(apps.apple.com/kr/app/id6772862881)에 월₩1,900·평생₩8,800 노출 확인.

---

## 🚀 2026-06-07~08 (9차) — 푸시 + 빌드 + ASC 바이너리 업로드 (제출 직전까지)

### ✅ 완료
1. **GitHub 푸시 완료** — `2716952..c9f405b` (8차 커밋 4개 origin/main 반영).
2. **EAS 1.0.1 프로덕션 빌드 완료** — Build ID `008f07d4-99cd-44fe-b228-aad24cc7df07`, **version 1.0.1 / build number 13**, status finished (6/8 1:00 AM).
   - 로그: https://expo.dev/accounts/symptomer/projects/ChordNavigator/builds/008f07d4-99cd-44fe-b228-aad24cc7df07
3. **App Store Connect 바이너리 업로드 완료** (`eas submit`) — 빌드 #13을 ASC에 올림(심사 제출 아님). Apple 처리 5~10분 후 빌드 목록에 노출.
   - 제출 상세: https://expo.dev/accounts/symptomer/projects/ChordNavigator/submissions/fdfada43-cbba-4c40-81bf-4439bc2ba5a6
   - TestFlight: https://appstoreconnect.apple.com/apps/6772862881/testflight/ios
   - ASC App ID `6772862881`, EAS Submit API Key `FK5N5HYN96`.

### ⏭️ 내일 할 일 = App Store Connect 웹에서 (이게 "제출")
**appstoreconnect.apple.com → ChordNavigator → 좌측 "App Store" 탭**
1. **버전 1.0.1 생성** (없으면 "+ 버전 또는 플랫폼") — 이미 있으면 그 버전 사용.
2. **빌드 연결** — "빌드" 섹션에서 build **13** 선택 (처리 완료돼야 보임).
3. **ASO 입력** (아래 텍스트 그대로 붙여넣기):
   - **부제(30자):** `코드 진행 분석·기타 피아노 운지·작곡`
   - **키워드(100자):** `코드,코드진행,기타코드,피아노코드,코드분석,화성학,음악이론,작곡,스케일,운지,코드표,반주,재즈,통기타,건반,화음`
   - **설명문 차별점 문구(설명 상단 권장):** "남의 곡을 따라치는 앱이 아닙니다. 코드 진행을 직접 이해하고 작곡하는 한국어 화성학 도구 — 기타·피아노 운지를 동시에 보여주고, AI가 진행을 분석합니다."
   - **프로모션 텍스트:** 1.0(라이브)에 이미 적용됨 → 불필요.
4. **"이 버전에서 새로운 기능"(변경사항):** "기법 제안의 소리와 화면 운지를 일치시키고, 보이스리딩(자연스러운 운지 연결)을 추가했습니다. 기타·피아노 음색과 다이어그램을 개선했습니다. 음악 이론 표기 오류(자연단조 VII, 반감화음 m7♭5, 플랫 표기)를 수정했습니다."
5. **저장 → "심사에 추가/제출"** ← **이 버튼이 진짜 제출. 사용자가 직접 누름.**

⚠️ 로그인: appstoreconnect.apple.com (Apple ID: KANG DOSEONG / symptomers@naver.com).

### (선택) 음색 추가 튜닝 — `AudioEngine.js` `makeGuitarTone`/`makePianoTone`/`bassEmph` (사용자 음색 완전 만족 아님).

---

## 🔍 2026-06-08 (9차 연장) — "구독/잠금이 안 보인다" → ✅ 정상으로 결론(버그 아님)

**결론: 버그 아님. 개발자 본인 기기가 이미 프리미엄(테스트 결제 entitlement)이라 잠금/페이월이 숨겨진 것. 신규 유저는 정상.**
**확정 증거:** AnalyzeTab `runAI()`에서 AI 분석 누르면 `!isPremium`이면 페이월, 프리미엄이면 "코드를 입력하세요". 사용자가 눌렀을 때 **"코드 입력하세요"가 떴다 = isPremium=true 확정.**

**증상(사용자):** 다운받은 앱에서 구매 화면(페이월)·잠금(🔒) 표시가 전혀 없음. 설명서(ManualModal)에만 구매 설명 있음.

**전수 점검 결과 — 서버·라이브빌드 전부 정상:**
- 유료앱 계약/은행(Toss Bank)/세금(대한민국) = 전부 활성화됨 ✅
- 월간구독(`...monthly`) = 승인됨·전체국가 판매중·가격설정·한국어 현지화 승인 ✅
- 평생이용(`...lifetime`) = 승인됨 ✅
- RevenueCat offering(default) = 두 상품 정상 연결 (public key API로 확인) ✅
- **라이브 버전 = 1.0 / 빌드 #12 / "배포 준비됨"(=Ready for Distribution=라이브)**. ascAppId 6772862881.

**핵심 추론(코드 로직):** 잠금(🔒 재즈/AI/기법)·페이월은 모두 `f5a29fc`(6/4 22:58)에 추가됨. 빌드 #12는 그 직후 빌드 → **#12에 잠금/페이월 있음**. 그리고 코드상 `🔒`는 `!isPremium`일 때 **항상 렌더**되고, `isPremium=true`일 때만 사라짐. `isPremium` 기본값 false, RevenueCat이 활성 entitlement 줄 때만 true.
→ **따라서 #12에서 "잠금이 안 보임" = `isPremium=true` = 그 기기/Apple ID에 활성 entitlement가 있다는 뜻.** (RevenueCat 실패해도 isPremium=false라 잠금은 *보여야* 함.)
→ 거의 확실히 **6차 TestFlight 샌드박스 구매 테스트의 entitlement가 RevenueCat에 아직 active**로 남아, 개발자 본인 기기만 프리미엄 처리됨. **실사용자(미구매)는 정상적으로 잠금/페이월을 봄.**

**확인/조치 (다음):**
1. ✅ 확정됨 — AI 분석 누르니 "코드를 입력하세요"(페이월 아님) → isPremium=true.
2. RevenueCat 대시보드에서 본인 appUserID entitlement active 여부 확인, 필요시 테스트 구매 취소/환불.
3. 진짜 신규 유저 경험은 **구매 이력 없는 Apple ID/기기**로 테스트.

### ✅ 코드 개선 실행 (9차 연장, 미커밋·미빌드)
- **홈에 항상 보이는 프리미엄 진입 버튼 추가** (`HomeScreen.js`) — 비구매=`✦ 프리미엄 잠금 해제`, 구매=`✦ 프리미엄 이용 중`. 둘 다 탭하면 `showPaywall()`(구매자는 상태확인+구매복원 동선). → 프리미엄 유저는 잠금이 없어 페이월 진입로가 사라지던 문제 해소.
- **설명서 옛 API 키 설명 수정** (`ManualModal.js`) — "본인 Claude API 키 필요" / "API 키 입력(console.anthropic.com)" → 현재 동작(서버 백엔드, 키 불필요)에 맞게 "프리미엄이면 바로 사용 / 코드 진행만 입력" 으로 교체. (사용자가 'api 코드 입력' 으로 혼동했던 원인.)
- ⚠️ **사용자 혼동 메모:** AI 분석의 "코드를 입력하세요"는 **음악 코드 진행**(예: C Am F G) 입력 뜻. API 코드/키 아님.

### ✅ 빌드 결정: B (개선 포함 #14 새 빌드) — 빌드+업로드 완료
- 커밋 `06cc4be` (HomeScreen·ManualModal) → origin/main 푸시 완료.
- **EAS #14 빌드 완료** — Build ID `ac796f8f-4bce-4644-b26d-001e85ff9c13`, version 1.0.1 / **build 14**, finished 6/8 21:07.
- **ASC 업로드 완료** (`eas submit`) — Apple 처리 5~10분 후 빌드 목록 노출. 제출상세 `d4085a74-...`.
- **내일:** ASC 웹 버전 1.0.1에 **빌드 14** 연결 + ASO + 제출. ⚠️ #13(`008f07d4`)은 불용, **#14를 붙일 것**.

### 🔑 핵심 발견 — 라이브 빌드 #12 = AI 백엔드 전환 *이전* 옛 버전
- 사용자가 라이브 앱에서 "AI 분석 누르면 **Claude API 키 입력창**이 뜬다"고 함. 원인: **AI 백엔드(Worker+Gemini) 전환·API키 입력 제거는 `6713ad6`(2026-06-07)인데, 라이브 빌드 #12는 2026-06-04 빌드**라 그 *이전* 버전. → 라이브 앱은 "본인 Claude API 키 직접 입력" 옛 설계 그대로.
- 새 빌드(#13/#14)에서 해결됨: ① API 키 불필요(서버 처리, ✦AI분석 버튼만) ② AnalyzeTab이 progression 자동 채움(`setProgInput(progression.map...)`) → 코드탭서 만든 진행 그대로 분석.
- **공개 App Store 검증 완료:** apps.apple.com/kr/app/id6772862881 = 정식 출시, "앱내구입 사용가능", **월간 ₩1,900·평생 ₩8,800 공개 노출**. → 서버·상품·가격 100% 정상. 친구(신규유저) "구매 안뜸"은 기기측(전파지연때 StoreKit 빈결과 캐시 추정) → 삭제·재시작·재설치·KR계정 확인. (친구 재설치 테스트 중.)
- 💡 권장: #14 처리되면 **사용자·친구가 TestFlight로 #14 설치해 검증**(API키 없는 새 AI 흐름 + 구매 흐름) 후 심사 제출.

### (남은 코드 후보, 미실행)
- ChordsTab의 AI GPS(`fetchGPSRoutes`, `x-api-key`)는 옛 직접-Anthropic 경로 → `apiKey`가 항상 빈값이라 **사실상 죽은 코드**(항상 규칙 기반). 살리려면 AnalyzeTab처럼 Worker(`WORKER_URL`)로 전환 필요. 설명서 'GPS 추천: AI(프리미엄)' 문구도 이와 연동.

---

## 🎚️ 2026-06-07 (8차) — 기법 소리/운지 정합성 + 보이스리딩 + 음색 (커밋·푸시·빌드 완료)

### ✅ 완료 (커밋 `e71b2af`, 그 앞 7차 커밋 `6713ad6`·`f00a634` 포함, **9차에 GitHub 푸시 완료**)
실기기 테스트 피드백을 반복 반영해 "기법 제안" 전반을 수정:

1. **소리 = 화면 운지 일치** — 오디오가 이전엔 자체 보이싱(`voiceChord`)을 새로 계산해 다이어그램과 불일치했음. 이제 **표시된 운지(기타 프렛/피아노 건반)의 실제 음을 그대로 발음**.
   - AudioEngine: `scheduleVoicing`/`playVoicing`(명시 MIDI 배열 발음) 추가. AppContext `playVoicing` 추가.
   - ChordsTab `displayedVoicingMidis(chord, variant, instr, shapeIdx)` = 표시 운지 → MIDI. 기타 `GUITAR_BASE=[40,45,50,55,59,64]+fret`, 피아노 `pianoVoicingMidis`.
2. **라벨/품질/베이스 정확화** — `resolveTechItem`로 라벨 재파싱. 클리셰가 전부 같은 3화음으로 울리던 것, 페달 `Dm/A`가 `Am`로 울리던 것, 베이스하강 `Dm`이 `D`로 울리던 것 수정.
3. **보이스리딩 운지 엔진** (`musicUtils.js`) — 공통음 유지 + 변하는 음이 인접 위치로 "이어지는" 연주가능 운지.
   - `chordVoicings(pcs,bassPc,rootPc)` 후보 생성 + `voiceLeadSequence(specs)` DP 선택(이동량 최소).
   - `pianoVoiceLeadSequence(specs)` — 피아노 **오디오 전용**(베이스가 C 아래로 절대음정 하강). 베이스하강에만 `pShape`로 부착.
   - `getTechniques`에서 클리셰(maj/min)·베이스하강·페달 items에 `gShape`(+베이스하강은 `pShape`) 첨부 → progression/curChord에 흐름.
   - 검증: C클리셰 기타 하강성부 **G줄 5→4→3→2**(사용자 명시), 베이스하강 최저음 C→B→A→G, 12키 전수 연주가능.
4. **다이어그램 통합** — '재생중 운지'와 하단 '운지' 2개 → **진행 바로 아래 1개**로 통합. 재생 중엔 연주 코드 따라가고 **정지 시 마지막 코드 운지 유지**(`stopPlay`에서 `setCurChord`).
5. **피아노 다이어그램** — 슬래시 RH **풀 트라이어드**(노란건반 ≥3), `F/A≠Dm/A`, 베이스 **파란색 일관**(루트/코드톤 색 통합 → 범례 "왼손(베이스)=파랑 / 코드톤=노랑"). `getInversionKeys`/`getSlashBassKeys`/`placeAbove`를 PianoDiagram→musicUtils로 이동(단일 출처).
6. **베이스하강 라벨 슬래시** — `Cmaj7/B`·`Am7/G`로 바꿔 피아노가 베이스음 변화를 표시.
7. **음색** — 기타: **통기타(어쿠스틱)** triangle 기음+약배음+유니즌+피크노이즈+바디공명, **베이스음 약 1.5배 강조**. 피아노: **어쿠스틱 그랜드**(배음 8개·인하모닉시티·유니즌 디튠). → **이름 "피아노" 유지**. (사용자 평: 전보단 낫지만 완전 만족은 아님 → 추후 다듬을 여지)

**수정 파일:** `src/components/AudioEngine.js`, `src/components/PianoDiagram.js`, `src/components/GuitarDiagram.js`(이전), `src/context/AppContext.js`, `src/context/PurchaseContext.js`, `src/tabs/ChordsTab.js`, `src/tabs/AnalyzeTab.js`, `src/utils/musicUtils.js`, 신규 `src/utils/purchases.js`.

### ⏭️ 새 세션에서 할 일 (이 순서)
1. **(필요시) GitHub 푸시** — `git push origin main`. ⚠️ 이번 세션엔 자동승인 정책이 main 직접 푸시를 막음 → 사용자 명시 승인 또는 직접 푸시 필요. (EAS 빌드는 푸시 없이도 됨)
2. **EAS 1.0.1 프로덕션 빌드** — `eas build --platform ios --profile production --non-interactive --no-wait` (build #13, autoIncrement). ⚠️ 이번 세션엔 "프로덕션 배포"로 분류돼 자동승인이 막음 → **사용자 명시 승인 필요**. (app.json version 이미 `1.0.1`, eas.json appVersionSource remote)
3. **App Store Connect 재심사 제출** — 7차 계획대로: 버전 1.0.1 생성 → 새 빌드 연결 → ASO(부제·키워드·설명, 7차 섹션 참조) 입력 → 제출. ascAppId `6772862881`, appleId `symptomers@naver.com`.
4. **(선택) 음색 추가 튜닝** — 사용자가 음색 완전 만족은 아님. 기타/피아노 밝기·감쇠·베이스강조량 등 `AudioEngine.js` `makeGuitarTone`/`makePianoTone`/`bassEmph`에서 조정.

### 🧪 개발/테스트 메모 (새 세션 필수)
- **Expo Go 실행:** `EXPO_NO_TYPESCRIPT_SETUP=1 npx expo start` (⚠️ `server/` 폴더의 .ts 파일 때문에 일반 `expo start`는 TypeScript 의존성 요구하며 멈춤 → 이 env로 우회). LAN: `exp://<IP>:8081` (이번 IP `220.74.115.84`).
- **Expo Go 호환:** `react-native-purchases`는 Expo Go에서 브라우저 모드로 뜨고 configure는 실패(무해, try/catch). `src/utils/purchases.js` 가드로 import 크래시 방지. 결제는 Expo Go에서 비활성 — 실결제 테스트는 dev build 필요.
- **로직 검증 방법(소리 못 들으므로 핵심):** `@babel/plugin-transform-modules-commonjs`로 require 훅 걸어 실제 `musicUtils` 함수 로드 → `voiceLeadSequence`/`pianoVoiceLeadSequence`/`getSlashBassKeys`/`displayedVoicingMidis` 출력 단언. (이번 세션 /tmp 스크립트들은 휘발성 — 필요시 재작성. NODE_PATH=프로젝트 node_modules 로 실행.)

---

## 🚀 2026-06-06 (7차) — 출시 완료 + 1.0.1 준비 + AI 백엔드 전환

### ✅ 앱 출시됨!
- **App Store 정식 출시 완료** (5차 재심사 통과). 앱+IAP(월간 ₩1,900/평생 ₩8,800) 모두 "승인됨", 판매 중.
- 판매자명은 개인계정이라 **"DOSEONG KANG"** 으로 표시됨. 브랜드명("symptomer")으로 바꾸려면 조직(Organization) 계정 전환 필요(DUNS 번호 + Apple 지원 문의) — 급하지 않아 보류.

### ✅ 코드 수정 (전부 미커밋 — 다음 1.0.1 빌드에 반영 필요)
음악 이론/UX 버그를 영상·스크린샷 보고 수정함:
1. **자연단조 VII: Cmaj7 → C7** (도미넌트). `ChordsTab.js`의 `getLevelSuffix`/`getLevelSuffixStatic`에 `domIdx = mode==='minor'?6:4` 추가
2. **반감화음 ø7 → m7♭5 표시** ("E07"처럼 보이던 것). `musicUtils.js` `flatChordName`에서 `.replace('ø7','m7♭5')` (데이터 키는 ø7 유지)
3. **구성음 철자 A# → B♭** (플랫 키에서). `musicUtils.js`에 `flatNote(note,key,mode)` 추가 → ChordsTab·InstrumentTab·GuitarDiagram·PianoDiagram 표시에 적용 (논리비교는 원본 샤프 유지)
4. **반감화음 분류 버그**: `chordNameToQuality`가 'ø'를 'maj'로 분류하던 것 → 'dim'으로 (ø/° 먼저 판정)
5. **마디 코드 우측 정렬**: `ChordsTab.js` 스타일 `measuresRow` `row+wrap` → `column`(리드시트처럼 마디 세로 쌓기, 마디 안 코드는 가로). `measureBlockSep`도 좌측 보더 → 상단 보더
6. **AI 분석 백엔드 전환** (아래 별도 섹션) — `AnalyzeTab.js` 대폭 수정

### 🤖 AI 분석 = Cloudflare Worker + Google Gemini (완성·배포됨)
**왜:** 기존엔 앱이 사용자더러 Anthropic API 키를 직접 넣게 했음 → ① 결제 모순(구독했는데 또 키 필요) ② App Store 3.1.1 리스크 ③ 키 노출. **A안(백엔드 프록시)** 으로 전환.
**Anthropic 결제가 한국 카드로 계속 막혀서**(버튼 비활성, 카드 4장·브라우저 3개 다 실패 — Stripe 차단 추정) → **Google Gemini 무료 등급으로 우회**.

- **위치:** `server/` 폴더 (Cloudflare Worker, TypeScript, raw fetch)
- **배포됨:** `https://chordnavigator-ai.symptomer.workers.dev` (Cloudflare 계정 symptomers@naver.com)
- **동작:** 앱 → Worker → Gemini. Worker가 ① RevenueCat REST(`/v1/subscribers`)로 프리미엄 검증 ② KV 일일 50회 제한 ③ Gemini(`gemini-2.0-flash`) 구조화 JSON 호출
- **시크릿(Worker에만):** `GEMINI_API_KEY`(aistudio.google.com 무료키), `REVENUECAT_API_KEY`(공개키 `appl_DRgqJLXRysIFcMwTWEBCqaImUxh`)
- **KV id:** `4aad11ed0f3a4457afa6970e1507dc6e` (binding RATE_LIMIT)
- **검증 완료:** curl 테스트로 빈요청→400, 가짜유저→403 not_premium 확인. (Gemini 실호출은 실제 프리미엄 유저만 가능)
- **앱 쪽(`AnalyzeTab.js`):** API 키 입력 UI 제거, `Purchases.getAppUserID()`로 appUserId 보내서 `WORKER_URL` 호출. `not_premium`→페이월, `rate_limited`→안내. **프리미엄 유저는 "분석" 버튼만 누르면 됨.**
- 배포/운영 가이드: `server/README.md`. 모델/한도 변경은 `server/wrangler.toml`(`GEMINI_MODEL`,`DAILY_LIMIT`).

### ⏭️ 다음 세션 할 일 (이 순서로)
1. **커밋** — `server/` 폴더 + 위 앱 수정 전체 (main에 직접 커밋해온 패턴)
2. **ASO 개선 (1.0.1에 같이)** — 부제 `코드 진행 분석·기타 피아노 운지·작곡`, 키워드 100자 `코드,코드진행,기타코드,피아노코드,코드분석,화성학,음악이론,작곡,스케일,운지,코드표,반주,재즈,통기타,건반,화음`, 설명문(차별점 강조: "남의 곡 따라치기 아님, 코드 이해·작곡") — 출시판이라 잠김, **새 버전 빌드 때 적용**
   - 프로모션 텍스트는 이미 1.0(라이브)에 "첫 달 무료!..." 로 적용 완료 (심사 불필요 항목)
3. **EAS 1.0.1 빌드** — `eas build --platform ios --profile production --non-interactive --no-wait` (autoIncrement, appVersionSource remote)
4. **재심사 제출** — App Store Connect: 버전 1.0.1 생성 → 새 빌드 연결 → ASO/설명 입력 → 제출. (참고: 기능 변화 없는 빈 업데이트 아님 — 버그 수정 다수 + AI 백엔드)

### ℹ️ 경쟁/포지셔닝 (마케팅 메모)
- 비슷한 앱: Chord ai/Capo/Chordify(곡→코드 오디오 인식), Autochords/Tonaly(진행 생성). **차별점: 입력→이해·분석 중심 + 한국어 + 장르별 탐색 + 기타·피아노 동시.** "따라치기 아니라 이해/작곡" + "한국어 화성학"으로 포지셔닝.

### ⚠️ 메모
- **Anthropic API 결제는 끝내 안 됐음** — 지원팀(support@anthropic.com)에 문의 메일 보냄(결제 버튼 비활성). 답 오면 참고만. **현재 AI는 Gemini라 Anthropic 불필요.**
- Worker의 옛 `ANTHROPIC_API_KEY` 시크릿은 미사용(무해, 그냥 둠).
- 출시 직후 IAP 전파 지연으로 본인/친구 폰에서 구독 버튼이 잠깐 안 떴음 — 정상(몇 시간~24h). 시간 지나면 해결.

---

## 🟢 2026-06-04 (6차) — RevenueCat 정비 + 빌드

### ✅ 완료
1. **App Store 스토어에 monthly 상품 추가** — `com.symptomer.chordnavigator.monthly` (RC product id `prodaa3781cdfc`), entitlement `ChordNavigator Pro` 연결
2. **offering 패키지를 App Store 상품으로 교체** (RC REST API v2 사용, secret key로 detach/attach)
   - Monthly(`$rc_monthly`) → App Store `com.symptomer.chordnavigator.monthly` ✅
   - Lifetime(`$rc_lifetime`) → App Store `com.symptomer.chordnavigator.lifetime` (`prodc53571f0be`) ✅
   - Yearly(`$rc_annual`)는 여전히 Test Store(코드 미사용이라 무관)
   - **근본 원인(Test Store 상품이 offering에 물려 있던 것) 해소됨**
3. **코드 커밋** (f5a29fc) — entitlement 키 수정 + 누적 작업 전체 커밋
4. **EAS production 빌드 시작** — Build ID `b75fd58c-9f00-48c0-8a60-f33754671e25`, v1.0.0 / **build number 12**
   - 로그: https://expo.dev/accounts/symptomer/projects/ChordNavigator/builds/b75fd58c-9f00-48c0-8a60-f33754671e25

### ⚠️ 보안 메모
- RevenueCat secret API key(`claude-api`, `sk_...`)를 6차 작업에 사용함 → **사용 후 삭제 권장** (RevenueCat → API keys → claude-api 삭제)

### ✅ 추가 완료 (6차 연장)
5. **TestFlight 업로드** — build #12 처리 완료, 실기기 설치
6. **실기기 결제 검증** — 페이월에서 상품 표시 + 구매 → 프리미엄 잠금 해제 성공 (반려 원인 해결 입증). 가격은 한국 ₩1,900/₩8,800 = 미국 $0.99/$4.99 티어로 정상(샌드박스 미국 계정이라 USD 표시됐던 것)
7. **🔑 결정적 원인 추가 발견 + 수정**: 반려된 심사 제출 건(`9cb007a7...`)의 버전에 **옛 버그 빌드 #11이 연결돼 있었음** → **빌드 #12로 교체 + 저장** (이게 진짜 재반려 방지 핵심)
8. **심사 노트 작성** — 앱 심사 정보 메모에 IAP 수정 내용 + 샌드박스 테스트 방법 영문 기재
9. **✅ 재심사 제출 완료 (5차 심사)** — 2026-06-05, build 1.0.0 **(12)**, 상태 **"심사 대기 중"(Waiting for Review)**. Submission ID `9cb007a7-6088-4ab7-9902-50f2620ded71`

### ⏭️ 남은 일
- **Apple 심사 결과 대기** (보통 24~48시간, 이메일 통보)
- 통과 시: 자동 출시 설정돼 있음 → App Store 공개
- 만약 또 반려되면: 반려 메시지 확인 후 대응 (이번엔 빌드/IAP/entitlement 모두 정상이라 통과 가능성 높음)

---

## 📌 새 세션은 여기부터 읽으세요 (자기완결 요약)

**무엇을 하는 중인가:** ChordNavigator(iOS 음악 코드 앱)를 App Store에 출시하려는데, IAP(인앱구입) 문제로 **4차까지 심사 반려**됨. 현재 5차 제출을 준비 중.

**4차 반려 사유 (확정):** Apple Guideline 2.1(b) — "제출된 바이너리에서 인앱구입 상품(평생 이용 등)을 찾을 수 없음". 
→ **진짜 원인(5차에 규명 완료):** RevenueCat의 `default` offering에 들어간 3개 패키지(Monthly/Yearly/Lifetime)가 모두 **"Test Store"(개발 테스트용 가짜 스토어) 상품**에 연결돼 있었음. 실제 App Store 상품이 아니라서, 출시 빌드로 실기기 심사 시 페이월에 상품이 안 떠서 반려됨.

**결제 시스템 구성:** 앱은 RevenueCat(`react-native-purchases` 10.x, StoreKit2) 사용. 상품 가격/패키지는 코드에 하드코딩하지 않고 RevenueCat offering(`offerings.current`)에서 `$rc_monthly`·`$rc_lifetime` 패키지를 읽음.

**상품 2종 (App Store Connect 기준):**
- 평생 이용(비소모품): `com.symptomer.chordnavigator.lifetime` (₩8,800)
- 월간 구독: `com.symptomer.chordnavigator.monthly` (₩1,900, 첫 달 무료)

**RevenueCat 핵심 식별자:**
- project ID `cf5a01cc`, App Store app `appfb5771e34a`
- entitlement identifier = `ChordNavigator Pro` (코드도 이 값으로 수정 완료)
- App Store Connect API 키 = `4625N6447U` (앱 관리 권한), Issuer ID `6e48e6c7-afd0-4509-bbd8-0da831b29972`, Vendor number `94372056`
- 로그인: appstoreconnect.apple.com (Apple ID: KANG DOSEONG), app.revenuecat.com 둘 다 사용자 브라우저에 로그인돼 있음

**⚠️ 환경 주의:** RevenueCat 웹은 claude-in-chrome 자동화로 스크린샷이 자주 실패함(document_idle 안 잡힘). 사용자에게 화면 캡처를 요청하거나 computer-use(read)로 우회할 것.

**➡️ 지금 당장 할 일:** 아래 "다음 세션 할 일" 1번 = **RevenueCat App Store 스토어에 monthly 구독 상품 추가**부터 시작. (상세는 아래 5차 섹션 참조)

---

## 🔴 2026-06-04 (5차) — 4차 심사 반려 / 원인 진단 완료

**4차 반려 (심사일 2026-06-03, iPad Air 11" M3)**
- Guideline 2.1(b) Performance - App Completeness
- "In-app purchase products (예: 평생 이용) could not be found in the submitted binary"
- 첨부: Screenshot-0604-075542.png
- 제출 ID: 9cb007a7-6088-4ab7-9902-50f2620ded71

### 진단 결과 (RevenueCat 콘솔 직접 확인)
RevenueCat project: ChordNavigator (`cf5a01cc`)

| # | 문제 | 비고 |
|---|------|------|
| A1 | App Store 스토어에 RC product가 **Lifetime 1개만** 등록됨 | **monthly가 App Store에 없음** |
| A2 | Lifetime product가 **default offering에 미연결** | Associated Offerings 비어 있음 |
| A3 | Lifetime **Store Status "Could not check"** | App Store Connect 연동/Shared Secret 미완성 |
| A4 | monthly/yearly는 **"Test Store"(샌드박스)에만** 존재 | 실제 결제 무관 |
| B1 | 코드 entitlement 키 `'premium'` ≠ RC identifier `'ChordNavigator Pro'` | 구매해도 isPremium 영원히 false |

- default offering 패키지: Monthly(`$rc_monthly`), Yearly(`$rc_annual`), Lifetime(`$rc_lifetime`)
- entitlement: identifier=`ChordNavigator Pro`, 4 products 연결
- App Store product ID: `com.symptomer.chordnavigator.lifetime` (lifetime), monthly는 `com.symptomer.chordnavigator.monthly`(코드 기준 추정 — App Store Connect엔 등록됨)

### ✅ 이번 세션(5차) 완료
- **B1 코드 수정**: `PurchaseContext.js` entitlement 키 4곳을 `ENTITLEMENT_ID = 'ChordNavigator Pro'` 상수로 교체 (line 10 정의, 30·55·66·76 사용)
- **A3 해결**: RevenueCat App Store Connect API 키 권한 문제 해결
  - 기존 키 `MP57F52G9Z`(권한=**재무**) → "Credentials need attention" 실패
  - **앱 관리(App Manager) 권한**으로 새 키 `4625N6447U` 발급(`~/Downloads/AuthKey_4625N6447U.p8`) → 교체 → **Valid credentials** ✅
  - Issuer ID `6e48e6c7-afd0-4509-bbd8-0da831b29972`, Vendor number `94372056`
- **근본 원인 확정 (사용자 통찰로 검증)**: RevenueCat **default offering의 3개 패키지(Monthly/Yearly/Lifetime)가 모두 "Test Store"(가짜 테스트 스토어) 상품에 연결**돼 있음 (소문자 monthly/yearly/lifetime). 실제 App Store 상품 아님.
  - → 출시 빌드(production 키)로 실기기 심사 시 IAP 로드 실패 = 4차 반려 "binary에서 IAP 못 찾음"의 직접 원인
  - App Store 스토어에 등록된 RC 상품은 Lifetime(`com.symptomer.chordnavigator.lifetime`) 1개뿐, 상태 "Developer Action Needed"(반려 후 재제출 대기)
  - monthly 구독은 App Store 스토어에 RC 상품으로 미등록

### ⏭️ 다음 세션 할 일 (이 순서로)
1. **[먼저] App Store 스토어에 monthly 상품 추가**
   - RevenueCat → Product catalog → Products → "ChordNavigator (App Store)" 줄의 `+ New`
   - App Store Connect의 월간 구독(`com.symptomer.chordnavigator.monthly`) import + entitlement "ChordNavigator Pro" 연결
   - ⚠️ 주의: 좌상단 전역 `+`(새 프로젝트 생성)와 혼동 금지 — 반드시 "ChordNavigator (App Store)" 섹션 안의 `+ New`
2. **offering 패키지를 App Store 상품으로 교체 연결** (Test Store → App Store)
   - Offerings → default → Packages → 각 패키지 편집
   - Monthly 패키지(`$rc_monthly`) → App Store monthly
   - Lifetime 패키지(`$rc_lifetime`) → App Store Lifetime
   - (Yearly는 코드 미사용 = 선택)
3. **평생 이용 IAP** "심사를 위해 제출" 상태 확인 (App Store Connect, 메타데이터는 이미 완비)
4. **새 빌드(EAS)** 생성 — entitlement 코드 수정 반영
5. **샌드박스 테스트**: 실기기에서 페이월 상품 표시 + 구매 성공 확인
6. **앱+IAP 재심사 제출** + App Review Notes에 **실기기 화면 녹화** 첨부 (홈→핵심기능→샌드박스 구매 성공 시연)

### 작업 환경 메모
- RevenueCat project ID: `cf5a01cc`, App Store app: `appfb5771e34a`
- RevenueCat 페이지는 자동화 브라우저(claude-in-chrome)에서 document_idle을 안 잡아 스크린샷이 자주 실패함 → 사용자 화면 직접 확인(computer-use read)으로 우회
- In-app purchase key(StoreKit2)는 `67C2ZSJ8JL` 정상(Valid), 건드리지 말 것

---

## 🟢 앱스토어 제출 완료 (2026-05-25)

| 항목 | 상태 |
|------|------|
| 앱 제출 | ✅ 1.0 심사 대기 중 (최대 48시간) |
| 개인정보 수집 선언 | ✅ 기기 ID + 구입 내역 게시 완료 |
| 월간 구독 무료 체험 | ✅ 첫 달 무료 (2026-05-25 ~ 2026-07-31, 175개국) |
| 월간 구독 가격 | ✅ ₩1,900/월 (175개국) |
| 현지화 | ✅ 한국어 (표시 이름: 월간 구독) |
| 구독 그룹 | ✅ 버전 1.0에 포함됨 |

**메타데이터 누락됨** 상태 → 첫 심사 전 정상. Apple 심사 후 자동 해결됨.

---

## 이번 세션(2차)에서 완료한 것

| 작업 | 내용 |
|------|------|
| 개인정보 선언 | 기기 ID, 구입 내역 설정 및 게시 |
| iPad 13" 스크린샷 | Python Pillow로 2064×2752px 4장 생성 후 수동 업로드 |
| 앱 가격 설정 | Free (175개국) |
| 앱 제출 | 1.0 심사 제출 완료 |
| 월간 구독 무료 체험 | 첫 달 무료 2026-05-25~07-31 확인 |

---

## 이전 세션(1차)에서 완료한 것

| 작업 | 내용 | 파일 |
|------|------|------|
| 슬래시 코드 기타 운지 수정 | 오픈 포지션(bassFret<5)에서 바레 제약 버그 수정 | musicUtils.js |
| 6th 코드 5음 누락 수정 | F6, C6, B6, C#6 운지에서 퀸트(5음) 빠지던 것 수정 | musicData.js |
| 스플래시/아이콘 | 앱 아이콘 스타일로 재생성 | assets/ |
| 개인정보처리방침 | 앱 내 모달 + 웹 HTML 생성 + GitHub Pages 배포 | src/screens/PrivacyPolicyModal.js |
| GitHub 저장소 | public 저장소 생성 및 push 완료 | — |

---

## 현재 파일 구조

```
src/
  context/
    AppContext.js
    PurchaseContext.js     — RevenueCat 연동 (테스트 키 → 실제 키로 교체 필요)
  data/
    musicData.js           — NOTES, CHORD_POSITIONS, COLORS 등
    songPatterns.js
  utils/
    musicUtils.js          — getChords, getGuitarShapes, getSlashGuitarShapes 등
    midiUtils.js
  components/
    AudioEngine.js
    GuitarDiagram.js       — 가로 방향 SVG 기타 다이어그램
    PianoDiagram.js
    ScaleFretboard.js
  screens/
    HomeScreen.js
    NavigatorScreen.js
    PaywallScreen.js       — 결제 화면 (무료↔프리미엄 비교)
    ManualModal.js         — 사용설명서 (마지막 페이지에 Privacy Policy 링크)
    PrivacyPolicyModal.js  — 개인정보처리방침 모달
  tabs/
    ChordsTab.js
    AnalyzeTab.js
    ScaleTab.js
assets/
  icon.png                 — 앱 아이콘 (가로 기타 다이어그램)
  adaptive-icon.png
  splash-icon.png
privacy-policy.html        — 웹 배포용 (GitHub Pages)
```

---

## 심사 통과 후 할 것

1. **RevenueCat 실제 연결 확인** — 앱 출시 후 실구매 테스트
   - https://app.revenuecat.com에서 구독 상태 모니터링
   - `PurchaseContext.js` API 키: `appl_DRgqJLXRysIFcMwTWEBCqaImUxh` (현재 키 유지)

2. **평생 이용권 추가** (선택)
   - `com.symptomer.chordnavigator.lifetime` / ₩8,800 Non-Consumable
   - 현재 PurchaseContext.js에 코드 준비되어 있음

---

## 🟡 앱스토어 제출 이후 고도화 아이디어

1. **곡 참조 기능** — 진행 패턴 → "Let It Be" 같은 곡 이름 표시
2. **텐션/해소 시각화** — 도수별 텐션 막대그래프
3. **전조 감지** — 피벗 코드 표시
4. **장르 자동 인식** — II-V-I → "재즈 가능성" 등
5. **코드 다이어그램 공유** — 이미지로 저장/공유
6. **메트로놈** — BPM 클릭 소리

---

## 다음 세션 시작 메시지

> `/Users/symptomer/Documents/ChordNavigator/NEXT_SESSION.md` 읽고 이어서 진행해줘.
