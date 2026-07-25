import React, { useState, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Dimensions,
} from 'react-native';
import { COLORS } from '../data/musicData';
import PrivacyPolicyModal from './PrivacyPolicyModal';
import { t } from '../i18n';
import { usePurchase } from '../context/PurchaseContext';

const { width: SW } = Dimensions.get('window');

// ─── 섹션 데이터 ─────────────────────────────────────────
// 가격은 하드코딩하지 않는다 — 스토어에서 받은 현지 통화 가격(usePurchase)을 넣는다.
const SECTIONS = ({ monthlyPrice, lifetimePrice }) => [
  {
    icon: '♩',
    title: t('mTitle1'),
    color: COLORS.accent,
    items: [
      { type: 'intro', text: t('mIntro') },
      {
        type: 'step',
        steps: [
          { num: '1', label: t('mStep1Label'), desc: t('mStep1Desc') },
          { num: '2', label: t('mStep2Label'), desc: t('mStep2Desc') },
          { num: '3', label: t('mStep3Label'), desc: t('mStep3Desc') },
          { num: '4', label: t('mStep4Label'), desc: t('mStep4Desc') },
          { num: '5', label: t('mStep5Label'), desc: t('mStep5Desc') },
        ],
      },
    ],
  },
  {
    icon: '♪',
    title: t('mTitle2'),
    color: COLORS.purple,
    items: [
      { type: 'section', label: t('m2s1Label'), desc: t('m2s1Desc') },
      { type: 'section', label: t('m2s2Label'), desc: t('m2s2Desc') },
      { type: 'section', label: t('m2s3Label'), desc: t('m2s3Desc') },
      { type: 'section', label: t('m2s4Label'), desc: t('m2s4Desc') },
      { type: 'section', label: t('m2s5Label'), desc: t('m2s5Desc') },
      { type: 'tip', text: t('m2Tip') },
    ],
  },
  {
    icon: '⊞',
    title: t('mTitle3'),
    color: COLORS.blue,
    items: [
      { type: 'section', label: t('m3s1Label'), desc: t('m3s1Desc') },
      { type: 'section', label: t('m3s2Label'), desc: t('m3s2Desc') },
      { type: 'section', label: t('m3s3Label'), desc: t('m3s3Desc') },
      { type: 'tip', text: t('m3Tip') },
    ],
  },
  {
    icon: '⟳',
    title: t('mTitle4'),
    color: COLORS.green,
    items: [
      { type: 'section', label: t('m4s1Label'), desc: t('m4s1Desc') },
      { type: 'section', label: t('m4s2Label'), desc: t('m4s2Desc') },
      { type: 'section', label: t('m4s3Label'), desc: t('m4s3Desc') },
      { type: 'section', label: t('m4s4Label'), desc: t('m4s4Desc') },
      { type: 'tip', text: t('m4Tip') },
    ],
  },
  {
    icon: '⬡',
    title: t('mTitle5'),
    color: COLORS.purple,
    items: [
      { type: 'section', label: t('m5s1Label'), desc: t('m5s1Desc') },
      { type: 'section', label: t('m5s2Label'), desc: t('m5s2Desc') },
      { type: 'section', label: t('m5s3Label'), desc: t('m5s3Desc') },
      { type: 'section', label: t('m5s4Label'), desc: t('m5s4Desc') },
      { type: 'tip', text: t('m5Tip') },
    ],
  },
  {
    icon: '✦',
    title: t('mTitle6'),
    color: COLORS.accent2,
    items: [
      { type: 'section', label: t('m6s1Label'), desc: t('m6s1Desc') },
      { type: 'section', label: t('m6s2Label'), desc: t('m6s2Desc') },
      { type: 'section', label: t('m6s3Label'), desc: t('m6s3Desc') },
      { type: 'section', label: t('m6s4Label'), desc: t('m6s4Desc') },
      { type: 'tip', text: t('m6Tip') },
    ],
  },
  {
    icon: '◈',
    title: t('mTitle7'),
    color: COLORS.pink,
    items: [
      { type: 'scenario', label: t('m7aLabel'), steps: [t('m7a1'), t('m7a2'), t('m7a3'), t('m7a4')] },
      { type: 'scenario', label: t('m7bLabel'), steps: [t('m7b1'), t('m7b2'), t('m7b3'), t('m7b4')] },
      { type: 'scenario', label: t('m7cLabel'), steps: [t('m7c1'), t('m7c2'), t('m7c3'), t('m7c4')] },
    ],
  },
  {
    icon: '✦',
    title: t('mTitle8'),
    color: COLORS.accent,
    items: [
      {
        type: 'compare',
        free: [
          t('pwKeyMode'),
          t('pwDiatonic7'),
          t('pwChordSound'),
          t('pwFingering'),
          t('pwRuleGps'),
          t('pwSaveUnlimited'),
        ],
        premium: [
          t('pwJazzLevel'),
          t('pwAiGps'),
          t('pwAiAnalysis'),
          t('pwCustomAi'),
          t('pwMidi'),
        ],
      },
      {
        type: 'price',
        items: [
          { label: t('pwMonthly'), price: monthlyPrice, note: t('mPerMonth') },
          { label: `${t('pwLifetime')} ✦`, price: lifetimePrice, note: t('pwOnce'), best: true },
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
          <Text style={ci.compareTitle}>{t('pwFreeCol')}</Text>
          {item.free.map((f, i) => (
            <Text key={i} style={ci.compareItem}>· {f}</Text>
          ))}
        </View>
        <View style={[ci.compareCol, ci.premiumCol]}>
          <Text style={[ci.compareTitle, { color: COLORS.accent }]}>{t('premiumWord')} ✦</Text>
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
            {p.best && <Text style={ci.bestBadge}>{t('pwBest')}</Text>}
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
  const { monthlyPrice, lifetimePrice } = usePurchase();
  const sections = SECTIONS({ monthlyPrice, lifetimePrice });
  const total = sections.length;
  const sec = sections[page];

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
            <Text style={s.headerMeta}>{t('mHeaderMeta', { cur: page + 1, total })}</Text>
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
            <Text style={s.privacyLinkTxt}>{t('pwPrivacy')}</Text>
          </TouchableOpacity>
        )}

        {/* 하단 네비 */}
        <View style={s.nav}>
          <TouchableOpacity
            style={[s.navBtn, page === 0 && s.navBtnDisabled]}
            onPress={() => goTo(page - 1)}
            disabled={page === 0}>
            <Text style={[s.navBtnText, page === 0 && s.navBtnTextDisabled]}>{t('mPrev')}</Text>
          </TouchableOpacity>

          {/* 페이지 닷 */}
          <View style={s.dots}>
            {sections.map((sec2, i) => (
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
              {page === total - 1 ? t('mClose') : t('mNext')}
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
