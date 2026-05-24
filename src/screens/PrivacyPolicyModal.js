import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, SafeAreaView, StyleSheet,
} from 'react-native';
import { COLORS } from '../data/musicData';

const SECTIONS = [
  {
    title: '수집하는 정보',
    body: 'ChordNavigator는 개인 식별 정보를 수집하지 않습니다. 기기에 저장되는 코드 진행·설정 데이터는 오직 로컬에만 보관됩니다.',
  },
  {
    title: 'AI 분석 기능',
    body: 'AI 분석(Claude) 사용 시, 입력한 코드 진행 데이터가 Anthropic API로 전송됩니다. 사용자 개인 정보는 포함되지 않으며, 전송된 데이터는 분석 목적으로만 사용됩니다.',
  },
  {
    title: '인앱 결제',
    body: '구독·결제는 RevenueCat 및 Apple App Store를 통해 처리됩니다. 결제 정보는 Apple이 관리하며, 앱은 결제 세부 정보에 접근하지 않습니다.',
  },
  {
    title: '제3자 서비스',
    body: '• Anthropic (Claude AI) — AI 분석\n• RevenueCat — 구독 관리\n• Apple App Store — 결제 처리\n\n각 서비스의 개인정보처리방침을 참고하세요.',
  },
  {
    title: '데이터 보안',
    body: '앱은 별도의 서버를 운영하지 않으며 사용자 데이터를 수집·저장·판매하지 않습니다.',
  },
  {
    title: '문의',
    body: '개인정보처리방침에 관한 문의:\nsymptomers@naver.com',
  },
];

export default function PrivacyPolicyModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>개인정보처리방침</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.updated}>최종 업데이트: 2026년 5월 24일</Text>

          {SECTIONS.map((sec, i) => (
            <View key={i} style={s.section}>
              <Text style={s.sectionTitle}>{sec.title}</Text>
              <Text style={s.sectionBody}>{sec.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: COLORS.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title:        { flex: 1, fontSize: 18, fontWeight: '700', color: COLORS.text },
  closeBtn:     { padding: 6 },
  closeTxt:     { fontSize: 18, color: COLORS.text2 },

  content:      { padding: 20, paddingBottom: 40 },
  updated:      { fontSize: 12, color: COLORS.text2, marginBottom: 24 },

  section:      { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accent, marginBottom: 8 },
  sectionBody:  { fontSize: 14, color: COLORS.text2, lineHeight: 22 },
});
