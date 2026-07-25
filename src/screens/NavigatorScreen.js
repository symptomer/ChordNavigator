import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Modal,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { COLORS, NOTES } from '../data/musicData';
import ChordsTab  from '../tabs/ChordsTab';
import AnalyzeTab from '../tabs/AnalyzeTab';
import ScaleTab   from '../tabs/ScaleTab';
import { t } from '../i18n';

const TABS = [
  { key: 'chords',  icon: '♪', labelKey: 'tabChords' },
  { key: 'analyze', icon: '✦', labelKey: 'tabAnalyze' },
];

export default function NavigatorScreen({ navigation }) {
  const {
    selMode, activeKey, transKey, setTransKey,
  } = useApp();

  const [curTab,        setCurTab]        = useState('chords');
  const [analyzeSubTab, setAnalyzeSubTab] = useState('analyze'); // 'analyze' | 'scale'
  const [transposeVis,  setTransposeVis]  = useState(false);

  function goHome() { navigation.goBack(); }

  function doTranspose(k) {
    setTransKey(k === activeKey && transKey ? null : k);
    setTransposeVis(false);
  }

  function renderTab() {
    switch (curTab) {
      case 'chords':
        return <ChordsTab onTranspose={() => setTransposeVis(true)} />;
      case 'analyze':
        return (
          <View style={{ flex: 1 }}>
            {/* 분석·스케일 서브탭 */}
            <View style={styles.subTabBar}>
              <TouchableOpacity
                style={[styles.subTabBtn, analyzeSubTab === 'analyze' && styles.subTabBtnSel]}
                onPress={() => setAnalyzeSubTab('analyze')}>
                <Text style={[styles.subTabText, analyzeSubTab === 'analyze' && styles.subTabTextSel]}>
                  ✦ {t('analyzeShort')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTabBtn, analyzeSubTab === 'scale' && styles.subTabBtnSel]}
                onPress={() => setAnalyzeSubTab('scale')}>
                <Text style={[styles.subTabText, analyzeSubTab === 'scale' && styles.subTabTextSel]}>
                  ≋ {t('scalesShort')}
                </Text>
              </TouchableOpacity>
            </View>
            {analyzeSubTab === 'analyze' ? <AnalyzeTab /> : <ScaleTab />}
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={goHome} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('backKey')}</Text>
        </TouchableOpacity>
        <Text style={styles.keyBadge}>
          {activeKey} {selMode === 'major' ? t('major') : t('minor')}{transKey ? ' ▸' : ''}
        </Text>
      </View>

      {/* Tab content */}
      <View style={styles.content}>{renderTab()}</View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setCurTab(tab.key)}>
            <Text style={[styles.tabLabel, curTab === tab.key && styles.tabActive]}>{t(tab.labelKey)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transpose modal */}
      <Modal visible={transposeVis} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('transposeModalTitle')}</Text>
            <View style={styles.keyGrid}>
              {NOTES.map(k => (
                <TouchableOpacity
                  key={k}
                  style={[styles.kbtn, activeKey === k && styles.kbtnSel]}
                  onPress={() => doTranspose(k)}>
                  <Text style={[styles.kbtnText, activeKey === k && styles.kbtnTextSel]}>{k}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTransposeVis(false)}>
              <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: COLORS.bg },
  topBar:          { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.bg2, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn:         { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  backBtnText:     { color: COLORS.text, fontSize: 11 },
  keyBadge:        { flex: 1, fontSize: 13, color: COLORS.accent, fontWeight: '700', letterSpacing: 1 },
  content:         { flex: 1, paddingHorizontal: 14, paddingTop: 10 },

  // 서브탭 (분석·스케일 내부)
  subTabBar:       { flexDirection: 'row', gap: 6, marginBottom: 10 },
  subTabBtn:       { flex: 1, paddingVertical: 7, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center' },
  subTabBtnSel:    { borderColor: COLORS.accent, backgroundColor: 'rgba(232,196,106,0.12)' },
  subTabText:      { fontSize: 12, color: COLORS.text2, fontWeight: '600' },
  subTabTextSel:   { color: COLORS.accent },

  // 하단 탭바
  tabBar:          { flexDirection: 'row', backgroundColor: COLORS.bg2, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 4 },
  tabItem:         { flex: 1, alignItems: 'center', paddingVertical: 10 },
  tabLabel:        { fontSize: 12, color: COLORS.text2, fontWeight: '600' },
  tabActive:       { color: COLORS.accent },

  // Transpose modal
  modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: COLORS.bg2, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle:      { fontSize: 13, color: COLORS.text2, letterSpacing: 2, marginBottom: 14, textAlign: 'center' },
  keyGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  kbtn:            { width: '14%', paddingVertical: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.card, alignItems: 'center' },
  kbtnSel:         { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  kbtnText:        { fontSize: 13, color: COLORS.text },
  kbtnTextSel:     { color: '#111', fontWeight: '700' },
  cancelBtn:       { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  cancelBtnText:   { color: COLORS.text2, fontSize: 13 },
});
