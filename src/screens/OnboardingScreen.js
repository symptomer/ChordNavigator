import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Dimensions, SafeAreaView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../data/musicData';

const { width: SW } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '🎵',
    title: '키와 장조를 선택해요',
    desc: '화면 상단에서 키(C, D, E…)와 장조·단조를 고르면\n그에 맞는 다이아토닉 코드 7개가 자동으로 나타나요.',
    tip: '← 키  ·  C 장조  ·  키 →',
    tipLabel: '상단 바에서 키 변경',
  },
  {
    icon: '🎸',
    title: '코드를 탭해서 진행을 쌓아요',
    desc: '코드 버튼을 누르면 소리가 나고 아래 진행에 쌓여요.\n변형 코드 (maj7, 9, sus4…)도 골라볼 수 있어요.',
    tip: 'Cmaj9  →  Am9  →  Fmaj9  →  G13',
    tipLabel: '이렇게 진행이 만들어져요',
  },
  {
    icon: '💡',
    title: '기법을 자동으로 추천해줘요',
    desc: '코드를 선택하면 클리셰, 페달 포인트 등\n재즈·팝에서 쓰는 기법을 자동으로 제안해요.\n▶ 버튼으로 미리 들어볼 수 있어요.',
    tip: '클리셰  ·  페달 포인트  ·  트라이톤 대리',
    tipLabel: '기법 제안 섹션',
  },
  {
    icon: '🎹',
    title: '운지와 분석도 확인해요',
    desc: '기타·피아노 운지 다이어그램을 바로 확인하고,\n분석·스케일 탭에서 어울리는 스케일을 찾아보세요.\n진행은 저장해서 언제든 불러올 수 있어요.',
    tip: '코드  ·  분석·스케일',
    tipLabel: '하단 탭 바',
  },
];

export default function OnboardingScreen({ navigation }) {
  const scrollRef = useRef(null);
  const [page, setPage] = useState(0);

  function goNext() {
    if (page < SLIDES.length - 1) {
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

  const slide = SLIDES[page];
  const isLast = page === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      {/* 건너뛰기 */}
      <TouchableOpacity style={styles.skipBtn} onPress={finish}>
        <Text style={styles.skipTxt}>건너뛰기</Text>
      </TouchableOpacity>

      {/* 슬라이드 */}
      <ScrollView
        ref={scrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => (
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
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={[styles.nextBtn, isLast && styles.nextBtnLast]} onPress={goNext}>
          <Text style={[styles.nextBtnTxt, isLast && styles.nextBtnTxtLast]}>
            {isLast ? '시작하기 →' : '다음 →'}
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
