// react-native-purchases 안전 래퍼
// RevenueCat는 네이티브 모듈이라 Expo Go에는 없다. 신아키텍처(newArch)에서는
// import 시점에 TurboModule을 찾다가 크래시할 수 있으므로, require를 try/catch로
// 감싸 Expo Go에서도 앱이 뜨게 한다. 실제 빌드(개발/프로덕션)에서는 모듈이
// 정상 존재하므로 평소와 동일하게 동작한다 (동작 변경 없음).
let Purchases = null;
let LOG_LEVEL = {};

try {
  const m = require('react-native-purchases');
  Purchases = m.default || m;
  LOG_LEVEL = m.LOG_LEVEL || {};
} catch (e) {
  // Expo Go 등 네이티브 모듈이 없는 환경 — 결제 기능 비활성, 무료 상태로 동작
  console.warn('[Purchases] 네이티브 모듈 없음 (Expo Go 추정). 결제 비활성화.');
}

// 결제 모듈 사용 가능 여부 (호출부에서 가드용)
export const purchasesAvailable = !!Purchases;
export { LOG_LEVEL };
export default Purchases;
