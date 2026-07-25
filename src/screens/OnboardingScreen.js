import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../data/musicData';
import { t } from '../i18n';

const { width: SW } = Dimensions.get('window');

// tip은 화면 예시라 이미 번역된 UI 라벨을 그대로 조립한다 (탭 이름·기법 이름이 실제와 일치해야 함)
const SLIDES = () => [
  {
    icon: '🎵',
    title: t('ob1Title'),
    desc: t('ob1Desc'),
    tip: `← ${t('backKey')}  ·  C ${t('major')}  ·  ${t('backKey')} →`,
    tipLabel: t('ob1TipLabel'),
  },
  {
    icon: '🎸',
    title: t('ob2Title'),
    desc: t('ob2Desc'),
    tip: 'Cmaj9  →  Am9  →  Fmaj9  →  G13',
    tipLabel: t('ob2TipLabel'),
  },
  {
    icon: '💡',
    title: t('ob3Title'),
    desc: t('ob3Desc'),
    tip: `${t('techCliche')}  ·  ${t('techPedal')}  ·  ${t('techTritone')}`,
    tipLabel: t('ob3TipLabel'),
  },
  {
    icon: '🎹',
    title: t('ob4Title'),
    desc: t('ob4Desc'),
    tip: `${t('tabChords')}  ·  ${t('tabAnalyze')}`,
    tipLabel: t('ob4TipLabel'),
  },
];

export default function OnboardingScreen({ navigation }) {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);
  const slides = SLIDES();

  function goNext() {
    if (page < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: SW * (page + 1), animated: true });
      setPage(page + 1);
    } else {
      finish();
    }
  }

  async function finish() {
    await AsyncStorage.setItem('cnav_onboarded', '1');
    navigation.replace('Home');
  }

  function onScroll(e) {
    const p = Math.round(e.nativeEvent.contentOffset.x / SW);
    setPage(p);
  }

  const isLast = page === slides.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 건너뛰기 */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipTxt}>{t('obSkip')}</Text>
      </TouchableOpacity>

      {/* 슬라이드 */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {slides.map((s, i) => (
          <View key={i} style={styles.slide}>
            <Text style={styles.slideIcon}>{s.icon}</Text>
            <Text style={styles.slideTitle}>{s.title}</Text>
            <Text style={styles.slideDesc}>{s.desc}</Text>

            {/* 모형 UI 카드 */}
            <View style={styles.mockCard}>
              <Text style={styles.mockLabel}>{s.tipLabel}</Text>
              <Text style={styles.mockTip}>{s.tip}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* 하단 */}
      <View style={styles.bottom}>
        {/* 페이지 도트 */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={[styles.nextBtn, isLast && styles.nextBtnLast]} onPress={goNext}>
          <Text style={[styles.nextBtnTxt, isLast && styles.nextBtnTxtLast]}>
            {isLast ? t('obStart') : t('obNext')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.bg },

  skipBtn: { alignSelf: 'flex-end', padding: 16 },
  skipTxt: { color: COLORS.text2, fontSize: 14 },

  slide: {
    width: SW, flex: 1, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 32,
  },
  slideIcon:  { fontSize: 64, marginBottom: 20 },
  slideTitle: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  slideDesc:  { fontSize: 15, color: COLORS.text2, textAlign: 'center', lineHeight: 24 },

  mockCard: {
    marginTop: 32, backgroundColor: COLORS.bg3, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
    paddingVertical: 18, paddingHorizontal: 24, alignItems: 'center', width: '100%',
  },
  mockLabel: { fontSize: 11, color: COLORS.text2, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  mockTip:   { fontSize: 16, color: COLORS.accent, fontWeight: '600', textAlign: 'center' },

  bottom: { paddingHorizontal: 24, paddingBottom: 32, alignItems: 'center', gap: 20 },

  dots:      { flexDirection: 'row', gap: 6 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { width: 20, backgroundColor: COLORS.accent },

  nextBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 14,
    borderWidth: 1.5, borderColor: COLORS.accent, alignItems: 'center',
  },
  nextBtnLast:    { backgroundColor: COLORS.accent },
  nextBtnTxt:     { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  nextBtnTxtLast: { color: COLORS.bg },
});
