import { Dimensions } from 'react-native';

// 다이어그램(기타 운지·피아노 건반·스케일 지판)은 300~340pt 고정 크기라
// 아이패드에서도 아이폰과 같은 크기로 작게 보인다. 태블릿에서만 키운다.
//
// ⚠️ 판정은 반드시 '짧은 변' 기준. 폰을 가로로 눕히면 width가 900을 넘어서
//    width만 보면 폰을 태블릿으로 오인한다. 아이패드는 세로 폭이 768~834라
//    짧은 변이 768 이상이면 태블릿이다.
const { width, height } = Dimensions.get('window');
export const IS_TABLET = Math.min(width, height) >= 768;

// viewBox는 그대로 두고 렌더 크기만 곱한다 → 내부 좌표 계산은 손대지 않는다.
export const DIAGRAM_SCALE = IS_TABLET ? 1.5 : 1;
