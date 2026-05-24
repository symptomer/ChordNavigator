import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Dimensions,
} from 'react-native';
import { COLORS } from '../data/musicData';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const { width: SW } = Dimensions.get('window');

// ─── 섹션 데이터 ─────────────────────────────────────────
const SECTIONS = [
  {
    icon: '♩',
    title: '시작 전에',
    color: COLORS.accent,
    items: [
      {
        type: 'intro',
        text: 'ChordNavigator는 코드 진행을 탐색하고, 소리를 들어보고, 운지를 확인하고, AI로 분석까지 할 수 있는 도구예요.',
      },
      {
        type: 'step',
        steps: [
          { num: '1', label: '키 선택', desc: '홈에서 연주할 키(C, G, Am…)와 장/단조 선택' },
          { num: '2', label: '탐색 시작', desc: '▶ 버튼으로 Navigator 진입' },
          { num: '3', label: '코드 탭', desc: '코드 카드를 탭 → 소리 재생 + 진행에 추가' },
          { num: '4', label: '진행 저장', desc: '☆ 버튼으로 이름 붙여 저장, 언제든 불러오기' },
          { num: '5', label: '분석·스케일', desc: '하단 탭으로 이동해 AI 분석 또는 스케일 탐색' },
        ],
      },
    ],
  },
  {
    icon: '♪',
    title: '코드 탭',
    color: COLORS.purple,
    items: [
      {
        type: 'section', label: '코드 카드 한 번 탭',
        desc: '소리 재생 + 하단 진행 바에 추가. 길게 누르면 삭제.',
      },
      {
        type: 'section', label: '변형 버튼 (maj7, sus4…)',
        desc: '선택된 코드 아래에 표시. 탭하면 해당 변형음으로 교체.',
      },
      {
        type: 'section', label: '▶ 재생 버튼',
        desc: '진행 바의 코드를 1.5초 간격으로 순서대로 재생.',
      },
      {
        type: 'section', label: 'GPS 추천',
        desc: '현재 진행 맥락을 분석해 다음 코드를 자동 추천. AI(프리미엄) 또는 규칙 기반으로 작동.',
      },
      {
        type: 'section', label: '마디 ([ ])',
        desc: '진행을 마디 단위로 구분. 편집 시 원하는 마디를 탭해 활성화 후 코드 추가.',
      },
      {
        type: 'tip',
        text: '코드 카드 위의 ♩ 아이콘을 탭하면 기타·피아노 운지 다이어그램을 볼 수 있어요.',
      },
    ],
  },
  {
    icon: '⊞',
    title: '운지 다이어그램',
    color: COLORS.blue,
    items: [
      {
        type: 'section', label: '기타 다이어그램',
        desc: '프렛 번호 + 손가락 위치를 점으로 표시. X는 뮤트, O는 개방현.',
      },
      {
        type: 'section', label: '피아노 다이어그램',
        desc: '구성음을 건반 위에 하이라이트. 루트 음은 강조 색으로 표시.',
      },
      {
        type: 'section', label: '기타 지판 (스케일 탭)',
        desc: '선택한 스케일의 모든 음 위치를 전체 지판에 시각화.',
      },
      {
        type: 'tip',
        text: '운지 데이터 없음이 뜨면 해당 코드 변형이 아직 등록되지 않은 거예요. 기본 코드(maj/min)는 항상 표시됩니다.',
      },
    ],
  },
  {
    icon: '⟳',
    title: '전조 & 저장',
    color: COLORS.green,
    items: [
      {
        type: 'section', label: '전조 (Transpose)',
        desc: '코드 탭 상단 ↑↓ 버튼으로 반음 단위 전조. 모든 코드가 동시에 이동.',
      },
      {
        type: 'section', label: '전조 해제',
        desc: '원래 키로 돌아가려면 가운데 키 이름을 탭.',
      },
      {
        type: 'section', label: '진행 저장 (☆)',
        desc: '이름을 입력해 저장. 곡 이름이나 장르를 써두면 편리해요.',
      },
      {
        type: 'section', label: '불러오기',
        desc: '저장 목록에서 탭 → 해당 진행이 즉시 복원. 길게 누르면 삭제.',
      },
      {
        type: 'tip',
        text: '저장·마디 개수 모두 무제한 무료!',
      },
    ],
  },
  {
    icon: '⬡',
    title: '스케일 탭',
    color: COLORS.purple,
    items: [
      {
        type: 'section', label: '스케일 추천',
        desc: '진행 바에 코드가 2개 이상 있으면 자동으로 잘 맞는 스케일 추천. 탭하면 바로 적용.',
      },
      {
        type: 'section', label: '스케일 모드 선택',
        desc: 'Ionian(장조), Dorian, Phrygian 등 7가지 모드 + Pentatonic, Blues 지원.',
      },
      {
        type: 'section', label: '구성음 & 다이어그램',
        desc: '선택 후 기타 지판/피아노 건반으로 스케일 시각화.',
      },
      {
        type: 'section', label: '다이아토닉 코드',
        desc: '이 스케일에서 나오는 코드 7개 표시. 탭하면 소리 재생, [전체 진행 추가]로 한번에 추가.',
      },
      {
        type: 'tip',
        text: '추천 스케일을 탭하면 키가 자동으로 바뀌어요. 진행이 Am이면 A Aeolian이 높은 점수로 뜰 거예요.',
      },
    ],
  },
  {
    icon: '✦',
    title: '분석 탭 (AI)',
    color: COLORS.accent2,
    items: [
      {
        type: 'section', label: '규칙 기반 분석 (무료)',
        desc: '원본 → 중급(7th) → 대리코드 → 트리톤 대리 4가지 버전을 자동 생성. API 불필요.',
      },
      {
        type: 'section', label: 'AI 분석 (프리미엄)',
        desc: 'Claude API로 장르·레벨에 맞는 코드 추천 + 상세 해설. 본인의 Claude API 키 필요.',
      },
      {
        type: 'section', label: 'API 키 입력',
        desc: 'Anthropic Console(console.anthropic.com)에서 발급. 분석 탭 상단에 입력 후 저장.',
      },
      {
        type: 'section', label: '▶ 버튼',
        desc: '분석 결과 카드의 재생 버튼으로 해당 코드 진행을 미리 들어볼 수 있어요.',
      },
      {
        type: 'tip',
        text: 'AI 분석은 프리미엄 기능이에요. 규칙 기반 분석은 누구나 무료로 사용 가능!',
      },
    ],
  },
  {
    icon: '◈',
    title: '실전 활용',
    color: COLORS.pink,
    items: [
      {
        type: 'scenario',
        label: '팝 발라드 만들기',
        steps: ['키 C 장조 선택 → 탐색 시작', 'I(C) → VI(Am) → IV(F) → V(G) 탭', 'GPS로 다음 코드 추천 받기', '분석 탭 → 중급 버전으로 7th 추가'],
      },
      {
        type: 'scenario',
        label: '커버곡 코드 분석',
        steps: ['분석 탭 → 코드 직접 입력 (예: Am F C G)', '규칙 기반 분석 실행', '대리코드 버전으로 편곡 아이디어 얻기', '마음에 드는 버전 ▶로 미리 듣기'],
      },
      {
        type: 'scenario',
        label: '스케일로 즉흥 연주',
        steps: ['키 A 단조 → 탐색 시작', '코드 탭에서 Am - Dm - E7 추가', '스케일 탭 → A Aeolian 추천 확인', '기타 지판에서 포지션 확인 후 연주'],
      },
    ],
  },
  {
    icon: '✦',
    title: '프리미엄',
    color: COLORS.accent,
    items: [
      {
        type: 'compare',
        free: [
          '키 / 장단조 / 레벨 선택',
          '다이아토닉 코드 (입문·중급)',
          '코드 소리 재생',
          '기타·피아노 운지',
          '규칙 기반 GPS·분석',
          '진행·마디 무제한 저장',
        ],
        premium: [
          '재즈 레벨 코드 (텐션·대리)',
          'AI GPS 코드 추천',
          'AI 진행 분석·추천',
          '직접 코드 입력 AI 분석',
          'MIDI 내보내기',
        ],
      },
      {
        type: 'price',
        items: [
          { label: '월간', price: '₩1,900', note: '/ 월' },
          { label: '평생 ✦', price: '₩8,800', note: '1회 결제', best: true },
        ],
      },
    ],
  },
];

// ─── 아이템 렌더러 ────────────────────────────────────────
function renderItem(item, idx, sectionColor) {
  if (item.type === 'intro') {
    return (
      <View key={idx} style={ci.introBox}>
        <Text style={ci.introText}>{item.text}</Text>
      </View>
    );
  }
  if (item.type === 'step') {
    return (
      <View key={idx} style={ci.stepList}>
        {item.steps.map((s, i) => (
          <View key={i} style={ci.stepRow}>
            <View style={[ci.stepNum, { backgroundColor: sectionColor }]}>
              <Text style={ci.stepNumText}>{s.num}</Text>
            </View>
            <View style={ci.stepBody}>
              <Text style={[ci.stepLabel, { color: sectionColor }]}>{s.label}</Text>
              <Text style={ci.stepDesc}>{s.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  }
  if (item.type === 'section') {
    return (
      <View key={idx} style={ci.sectionRow}>
        <View style={[ci.sectionDot, { backgroundColor: sectionColor }]} />
        <View style={ci.sectionBody}>
          <Text style={[ci.sectionLabel, { color: sectionColor }]}>{item.label}</Text>
          <Text style={ci.sectionDesc}>{item.desc}</Text>
        </View>
      </View>
    );
  }
  if (item.type === 'tip') {
    return (
      <View key={idx} style={ci.tipBox}>
        <Text style={ci.tipIcon}>💡</Text>
        <Text style={ci.tipText}>{item.text}</Text>
      </View>
    );
  }
  if (item.type === 'scenario') {
    return (
      <View key={idx} style={ci.scenarioBox}>
        <Text style={[ci.scenarioLabel, { color: sectionColor }]}>▸ {item.label}</Text>
        {item.steps.map((s, i) => (
          <Text key={i} style={ci.scenarioStep}>{i + 1}. {s}</Text>
        ))}
      </View>
    );
  }
  if (item.type === 'compare') {
    return (
      <View key={idx} style={ci.compareRow}>
        <View style={ci.compareCol}>
          <Text style={ci.compareTitle}>무료</Text>
          {item.free.map((f, i) => (
            <Text key={i} style={ci.compareItem}>· {f}</Text>
          ))}
        </View>
        <View style={[ci.compareCol, ci.premiumCol]}>
          <Text style={[ci.compareTitle, { color: COLORS.accent }]}>프리미엄 ✦</Text>
          {item.premium.map((f, i) => (
            <Text key={i} style={[ci.compareItem, { color: COLORS.text }]}>✓ {f}</Text>
          ))}
        </View>
      </View>
    );
  }
  if (item.type === 'price') {
    return (
      <View key={idx} style={ci.priceRow}>
        {item.items.map((p, i) => (
          <View key={i} style={[ci.priceCard, p.best && ci.priceCardBest]}>
            {p.best && <Text style={ci.bestBadge}>베스트</Text>}
            <Text style={[ci.priceLabel, p.best && { color: COLORS.bg }]}>{p.label}</Text>
            <Text style={[ci.priceAmount, p.best && { color: COLORS.bg }]}>{p.price}</Text>
            <Text style={[ci.priceNote, p.best && { color: COLORS.bg, opacity: 0.7 }]}>{p.note}</Text>
          </View>
        ))}
      </View>
    );
  }
  return null;
}

// ─── 메인 컴포넌트 ────────────────────────────────────────
export default function ManualModal({ visible, onClose }) {
  const [page, setPage] = useState(0);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const scrollRef = useRef(null);
  const total = SECTIONS.length;
  const sec = SECTIONS[page];

  function goTo(p) {
    setPage(p);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.safe}>
        <PrivacyPolicyModal visible={privacyVisible} onClose={() => setPrivacyVisible(false)} />

        {/* 헤더 */}
        <View style={s.header}>
          <View style={[s.headerIcon, { backgroundColor: sec.color + '22', borderColor: sec.color + '55' }]}>
            <Text style={[s.headerIconText, { color: sec.color }]}>{sec.icon}</Text>
          </View>
          <View style={s.headerTitles}>
            <Text style={s.headerMeta}>사용설명서 {page + 1} / {total}</Text>
            <Text style={[s.headerTitle, { color: sec.color }]}>{sec.title}</Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 진행 바 */}
        <View style={s.progressBar}>
          <View style={[s.progressFill, { width: `${((page + 1) / total) * 100}%`, backgroundColor: sec.color }]} />
        </View>

        {/* 컨텐츠 */}
        <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {sec.items.map((item, i) => renderItem(item, i, sec.color))}
        </ScrollView>

        {/* Privacy Policy 링크 (마지막 페이지에만) */}
        {page === total - 1 && (
          <TouchableOpacity style={s.privacyLink} onPress={() => setPrivacyVisible(true)}>
            <Text style={s.privacyLinkTxt}>개인정보처리방침</Text>
          </TouchableOpacity>
        )}

        {/* 하단 네비 */}
        <View style={s.nav}>
          <TouchableOpacity
            style={[s.navBtn, page === 0 && s.navBtnDisabled]}
            onPress={() => goTo(page - 1)}
            disabled={page === 0}>
            <Text style={[s.navBtnText, page === 0 && s.navBtnTextDisabled]}>← 이전</Text>
          </TouchableOpacity>

          {/* 페이지 닷 */}
          <View style={s.dots}>
            {SECTIONS.map((sec2, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)}>
                <View style={[
                  s.dot,
                  i === page && { backgroundColor: sec.color, width: 20 },
                ]} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.navBtn, s.navBtnRight, { borderColor: sec.color }]}
            onPress={page === total - 1 ? onClose : () => goTo(page + 1)}>
            <Text style={[s.navBtnText, { color: sec.color }]}>
              {page === total - 1 ? '닫기 ✓' : '다음 →'}
            </Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── 스타일: 카드 아이템 ──────────────────────────────────
const ci = StyleSheet.create({
  introBox:       { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 16, marginBottom: 16 },
  introText:      { fontSize: 15, color: COLORS.text, lineHeight: 24 },

  stepList:       { gap: 10, marginBottom: 4 },
  stepRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNum:        { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  stepNumText:    { fontSize: 13, color: '#111', fontWeight: '800' },
  stepBody:       { flex: 1 },
  stepLabel:      { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  stepDesc:       { fontSize: 13, color: COLORS.text2, lineHeight: 19 },

  sectionRow:     { flexDirection: 'row', gap: 12, marginBottom: 14, alignItems: 'flex-start' },
  sectionDot:     { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  sectionBody:    { flex: 1 },
  sectionLabel:   { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  sectionDesc:    { fontSize: 13, color: COLORS.text2, lineHeight: 19 },

  tipBox:         { flexDirection: 'row', gap: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 12, marginTop: 4 },
  tipIcon:        { fontSize: 16 },
  tipText:        { flex: 1, fontSize: 13, color: COLORS.text2, lineHeight: 19 },

  scenarioBox:    { borderLeftWidth: 2, borderLeftColor: COLORS.border, paddingLeft: 12, marginBottom: 16 },
  scenarioLabel:  { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  scenarioStep:   { fontSize: 13, color: COLORS.text2, lineHeight: 20 },

  compareRow:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  compareCol:     { flex: 1, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, gap: 5 },
  premiumCol:     { borderColor: COLORS.accent, backgroundColor: '#1c1a10' },
  compareTitle:   { fontSize: 13, fontWeight: '700', color: COLORS.text2, marginBottom: 4 },
  compareItem:    { fontSize: 12, color: COLORS.text2, lineHeight: 20 },

  priceRow:       { flexDirection: 'row', gap: 8 },
  priceCard:      { flex: 1, backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  priceCardBest:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  bestBadge:      { position: 'absolute', top: -10, backgroundColor: COLORS.pink, color: '#fff', fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: 'hidden' },
  priceLabel:     { fontSize: 13, color: COLORS.text2, marginTop: 4 },
  priceAmount:    { fontSize: 22, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  priceNote:      { fontSize: 11, color: COLORS.text2, marginTop: 2 },
});

// ─── 스타일: 레이아웃 ─────────────────────────────────────
const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },

  header:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  headerIcon:      { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerIconText:  { fontSize: 22 },
  headerTitles:    { flex: 1 },
  headerMeta:      { fontSize: 10, color: COLORS.text2, letterSpacing: 1.5 },
  headerTitle:     { fontSize: 18, fontWeight: '700', marginTop: 2 },
  closeBtn:        { padding: 6 },
  closeTxt:        { color: COLORS.text2, fontSize: 18 },

  progressBar:     { height: 3, backgroundColor: COLORS.border, marginHorizontal: 16, borderRadius: 2 },
  progressFill:    { height: 3, borderRadius: 2 },

  scroll:          { flex: 1 },
  scrollContent:   { padding: 20, paddingBottom: 8 },

  nav:             { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  navBtn:          { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  navBtnRight:     { borderWidth: 1.5 },
  navBtnDisabled:  { opacity: 0.2 },
  navBtnText:      { fontSize: 14, color: COLORS.text2, fontWeight: '600' },
  navBtnTextDisabled: { color: COLORS.text2 },

  dots:            { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot:             { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },

  privacyLink:     { alignItems: 'center', paddingVertical: 8 },
  privacyLinkTxt:  { fontSize: 12, color: COLORS.text2, textDecorationLine: 'underline', opacity: 0.6 },
});
