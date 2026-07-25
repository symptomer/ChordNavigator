import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Linking,
} from 'react-native';
import { usePurchase } from '../context/PurchaseContext';
import { COLORS } from '../data/musicData';
import { t } from '../i18n';

const EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://symptomer.github.io/ChordNavigator/privacy-policy.html';

const FREE_FEATURE_KEYS = [
  'pwKeyMode',
  'pwDiatonic7',
  'pwChordSound',
  'pwFingering',
  'pwRuleGps',
  'pwSaveUnlimited',
  'pwBarsUnlimited',
];

const PREMIUM_FEATURE_KEYS = [
  'pwAllFree',
  'pwJazzLevel',
  'pwAiGps',
  'pwAiAnalysis',
  'pwCustomAi',
  'pwMidi',
];

export default function PaywallScreen() {
  const { paywallVisible, hidePaywall, purchaseMonthly, purchaseLifetime, restorePurchases,
          lifetimePkg, monthlyPrice, lifetimePrice } = usePurchase();

  return (
    <Modal visible={paywallVisible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* 닫기 */}
          <TouchableOpacity style={styles.closeBtn} onPress={hidePaywall}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>

          {/* 헤더 */}
          <Text style={styles.crown}>♪</Text>
          <Text style={styles.title}>ChordNavigator{'\n'}{t('premiumWord')}</Text>
          <Text style={styles.sub}>{t('pwSub')}</Text>

          {/* 비교표 */}
          <View style={styles.compareRow}>
            <View style={[styles.compareCol, styles.freeCol]}>
              <Text style={styles.colTitle}>{t('pwFreeCol')}</Text>
              {FREE_FEATURE_KEYS.map(k => (
                <View key={k} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>·</Text>
                  <Text style={styles.featureTxt}>{t(k)}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.compareCol, styles.premiumCol]}>
              <Text style={[styles.colTitle, { color: COLORS.accent }]}>{t('premiumWord')} ✦</Text>
              {PREMIUM_FEATURE_KEYS.map(k => (
                <View key={k} style={styles.featureRow}>
                  <Text style={[styles.featureIcon, { color: COLORS.accent }]}>✓</Text>
                  <Text style={[styles.featureTxt, { color: COLORS.text }]}>{t(k)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 구매 버튼 */}
          {lifetimePkg && (
            <TouchableOpacity style={styles.lifetimeBtn} onPress={purchaseLifetime}>
              <Text style={styles.lifetimeBtnBadge}>{t('pwBest')}</Text>
              <Text style={styles.lifetimeBtnTitle}>{t('pwLifetime')}</Text>
              <Text style={styles.lifetimeBtnPrice}>{lifetimePrice}  <Text style={styles.lifetimeBtnOnce}>{t('pwOnce')}</Text></Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.monthlyBtn, !lifetimePkg && styles.monthlyBtnPrimary]} onPress={purchaseMonthly}>
            <Text style={styles.monthlyBtnTitle}>{t('pwMonthly')}</Text>
            <Text style={styles.monthlyBtnPrice}>{t('pwPerMonthFree', { price: monthlyPrice })}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.restoreBtn} onPress={restorePurchases}>
            <Text style={styles.restoreTxt}>{t('pwRestore')}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>{t('pwLegal')}</Text>

          {/* 이용약관 / 개인정보처리방침 링크 */}
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL(EULA_URL)}>
              <Text style={styles.legalLink}>{t('pwTerms')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalSep}> · </Text>
            <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
              <Text style={styles.legalLink}>{t('pwPrivacy')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, alignItems: 'center', paddingBottom: 40 },

  closeBtn: { alignSelf: 'flex-end', padding: 4, marginBottom: 8 },
  closeTxt: { color: COLORS.text2, fontSize: 20 },

  crown: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.text, textAlign: 'center', lineHeight: 34 },
  sub:   { fontSize: 14, color: COLORS.text2, marginTop: 8, marginBottom: 24, textAlign: 'center' },

  compareRow:   { flexDirection: 'row', gap: 10, width: '100%', marginBottom: 28 },
  compareCol:   { flex: 1, borderRadius: 12, padding: 14, gap: 6 },
  freeCol:      { backgroundColor: COLORS.bg3, borderWidth: 1, borderColor: COLORS.border },
  premiumCol:   { backgroundColor: '#1c1a10', borderWidth: 1.5, borderColor: COLORS.accent },
  colTitle:     { fontSize: 14, fontWeight: '700', color: COLORS.text2, marginBottom: 6 },
  featureRow:   { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
  featureIcon:  { color: COLORS.text2, fontSize: 13, lineHeight: 20 },
  featureTxt:   { color: COLORS.text2, fontSize: 12, lineHeight: 20, flex: 1 },

  lifetimeBtn: {
    width: '100%', backgroundColor: COLORS.accent, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginBottom: 10,
  },
  lifetimeBtnBadge: {
    position: 'absolute', top: -10, right: 14,
    backgroundColor: COLORS.pink, color: '#fff',
    fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8, overflow: 'hidden',
  },
  lifetimeBtnTitle: { fontSize: 18, fontWeight: '700', color: COLORS.bg },
  lifetimeBtnPrice: { fontSize: 14, color: COLORS.bg, marginTop: 2, opacity: 0.8 },
  lifetimeBtnOnce:  { fontSize: 12, opacity: 0.7 },

  monthlyBtn: {
    width: '100%', borderWidth: 1.5, borderColor: COLORS.accent,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 16,
  },
  monthlyBtnTitle: { fontSize: 16, fontWeight: '600', color: COLORS.accent },
  monthlyBtnPrice: { fontSize: 13, color: COLORS.text2, marginTop: 2 },

  restoreBtn: { marginBottom: 16 },
  restoreTxt: { color: COLORS.text2, fontSize: 13, textDecorationLine: 'underline' },

  legal: { color: COLORS.text2, fontSize: 11, textAlign: 'center', lineHeight: 16, opacity: 0.6, marginBottom: 8 },

  monthlyBtnPrimary: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },

  legalLinks: { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
  legalLink:  { color: COLORS.text2, fontSize: 11, textDecorationLine: 'underline', opacity: 0.7 },
  legalSep:   { color: COLORS.text2, fontSize: 11, opacity: 0.5 },
});
