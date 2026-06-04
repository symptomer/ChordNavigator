# ChordNavigator — 다음 세션 작업 계획

**프로젝트 경로:** `/Users/symptomer/Documents/ChordNavigator`
**최근 작업:** 2026-06-04 세션 (5차) — 4차 반려 원인 진단 + 코드 수정
**현재 브랜치:** main
**GitHub:** https://github.com/symptomer/ChordNavigator

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
