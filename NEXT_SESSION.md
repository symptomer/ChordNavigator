# ChordNavigator — 다음 세션 작업 계획

**프로젝트 경로:** `/Users/symptomer/Documents/ChordNavigator`
**최근 작업:** 2026-05-25 세션
**현재 브랜치:** main
**GitHub:** https://github.com/symptomer/ChordNavigator

---

## 이번 세션에서 완료한 것

| 작업 | 내용 | 파일 |
|------|------|------|
| 슬래시 코드 기타 운지 수정 | 오픈 포지션(bassFret<5)에서 바레 제약 버그 수정. Am/C, E/C, G/B 등 정상 표시 | musicUtils.js |
| 6th 코드 5음 누락 수정 | F6, C6, B6, C#6 운지에서 퀸트(5음) 빠지던 것 수정 | musicData.js |
| 스플래시 스크린 | 흰 원 플레이스홀더 → 앱 아이콘으로 교체, 배경색 #101018 | assets/splash-icon.png, app.json |
| 앱 아이콘 | 앱 내 GuitarDiagram 스타일과 동일하게 재생성 (가로 기타 운지 + CHORD NAVIGATOR 텍스트) | assets/icon.png, adaptive-icon.png |
| 개인정보처리방침 | 앱 내 모달(PrivacyPolicyModal.js) + 웹 HTML(privacy-policy.html) 생성 | src/screens/PrivacyPolicyModal.js, privacy-policy.html |
| ManualModal 링크 | 사용설명서 마지막 페이지 하단에 개인정보처리방침 링크 추가 | src/screens/ManualModal.js |
| GitHub 저장소 | public 저장소 생성 및 push 완료 | — |
| GitHub Pages | Privacy Policy 웹 배포 완료 | — |

---

## 🔴 Apple Developer 계정 활성화 대기 중

- 신분증 심사 중 (2026-05-22 제출)
- 결제 완료 (2026-05-21)
- 승인 메일 오면 아래 순서로 진행:

```bash
cd ~/Documents/ChordNavigator
eas device:create        # 1) 기기 등록
eas build --platform ios --profile preview --non-interactive  # 2) 실기기 빌드
```

---

## 🔴 Apple Developer 활성화 후 할 것

### 1. 기기 등록 & 실기기 빌드
```bash
eas device:create
eas build --platform ios --profile preview
```
→ 빌드 완료 링크를 **iPhone Safari**에서 열어 설치

### 2. App Store Connect 앱 등록
- https://appstoreconnect.apple.com
- 새 앱 생성: bundle ID `com.symptomer.chordnavigator`
- 인앱 구매 상품 2개 생성:
  - 월간 구독: `com.symptomer.chordnavigator.monthly` / ₩1,900/월
  - 평생 이용: `com.symptomer.chordnavigator.lifetime` / ₩8,800 (Non-Consumable)

### 3. RevenueCat 실제 연결
- https://app.revenuecat.com → Configurations → iOS App Store 앱 추가
  - Bundle ID: `com.symptomer.chordnavigator`
  - App Store Connect API 연결
- 상품 RevenueCat에 등록
- 진짜 `appl_` API 키 발급 후 PurchaseContext.js 7번 줄 교체:
```js
// 현재 (테스트):
const RC_API_KEY_IOS = 'test_zBjwoHHMmNeEuiAHUwVJMumYgIm';
// 변경:
const RC_API_KEY_IOS = 'appl_실제키';
```

### 4. 앱스토어 제출
- Privacy Policy URL: `https://symptomer.github.io/ChordNavigator/privacy-policy`
- 스크린샷 (6.9인치 / 6.5인치 / 5.5인치 필요)
- 앱 설명, 키워드 작성

---

## 현재 빌드 상태

| 빌드 ID | 포함 내용 | 설치 가능 여부 |
|---------|----------|--------------|
| 2aee3788 (최신) | Em7, 슬래시 코드, 6th 코드 수정 포함 | 시뮬레이터 전용 |

→ Apple Developer 계정 활성화 후 **preview 프로필**로 재빌드 필요

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
