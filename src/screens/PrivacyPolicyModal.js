import React from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  ScrollView, SafeAreaView, StyleSheet,
} from 'react-native';
import { COLORS } from '../data/musicData';
import { t } from '../i18n';

// 제3자 서비스: 실제 구성(Cloudflare Worker → Google Gemini, RevenueCat, Apple)과 일치해야 함.
// ⚠️ 이 목록을 바꾸면 웹 privacy-policy.html·ASC 개인정보 답변도 같이 고칠 것.
const THIRD_PARTIES = () => [
  `• Google (Gemini AI) — ${t('ppAiService')}`,
  `• Cloudflare (Workers) — ${t('ppAiRelay')}`,
  `• RevenueCat — ${t('ppSubMgmt')}`,
  `• Apple App Store — ${t('ppPayProc')}`,
].join('\n') + `\n\n${t('ppSeeEach')}`;

const SECTIONS = () => [
  { title: t('pp1Title'), body: t('pp1Body') },
  { title: t('pp2Title'), body: t('pp2Body') },
  { title: t('pp3Title'), body: t('pp3Body') },
  { title: t('pp4Title'), body: THIRD_PARTIES() },
  { title: t('pp5Title'), body: t('pp5Body') },
  { title: t('pp6Title'), body: t('pp6Body') },
];

export default function PrivacyPolicyModal({ visible, onClose }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>{t('pwPrivacy')}</Text>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.updated}>{t('ppUpdated')}</Text>

          {SECTIONS().map((sec, i) => (
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
