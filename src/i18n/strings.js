// ── 번역 테이블 (키 기준: { key: { ko, en, ja, zh, es, fr, de, pt, ru, it } }) ──
// 언어: 한국어 영어 일본어 중국어 스페인어 프랑스어 독일어 포르투갈어 러시아어 이탈리아어
export const STRINGS = {
  // ── 탭 / 화면 ──
  tabChords:   { ko: '코드', en: 'Chords', ja: 'コード', zh: '和弦', es: 'Acordes', fr: 'Accords', de: 'Akkorde', pt: 'Acordes', ru: 'Аккорды', it: 'Accordi' },
  tabAnalyze:  { ko: '분석·스케일', en: 'Analyze & Scales', ja: '分析・スケール', zh: '分析·音阶', es: 'Análisis y escalas', fr: 'Analyse et gammes', de: 'Analyse & Skalen', pt: 'Análise e escalas', ru: 'Анализ и гаммы', it: 'Analisi e scale' },

  // ── 홈 화면 ──
  appSubtitle: { ko: '코드 진행 탐색기', en: 'Chord Progression Explorer', ja: 'コード進行エクスプローラー', zh: '和弦进行浏览器', es: 'Explorador de progresiones', fr: 'Explorateur de progressions', de: 'Akkordfolgen-Explorer', pt: 'Explorador de progressões', ru: 'Обозреватель аккордов', it: 'Esploratore di progressioni' },
  selectKey:   { ko: '키 선택', en: 'Select Key', ja: 'キー選択', zh: '选择调', es: 'Elegir tonalidad', fr: 'Choisir la tonalité', de: 'Tonart wählen', pt: 'Selecionar tom', ru: 'Выбор тональности', it: 'Scegli tonalità' },
  majorMinor:  { ko: '장조 / 단조', en: 'Major / Minor', ja: 'メジャー / マイナー', zh: '大调 / 小调', es: 'Mayor / Menor', fr: 'Majeur / Mineur', de: 'Dur / Moll', pt: 'Maior / Menor', ru: 'Мажор / Минор', it: 'Maggiore / Minore' },
  major:       { ko: '장조', en: 'Major', ja: 'メジャー', zh: '大调', es: 'Mayor', fr: 'Majeur', de: 'Dur', pt: 'Maior', ru: 'Мажор', it: 'Maggiore' },
  minor:       { ko: '단조', en: 'Minor', ja: 'マイナー', zh: '小调', es: 'Menor', fr: 'Mineur', de: 'Moll', pt: 'Menor', ru: 'Минор', it: 'Minore' },
  level:       { ko: '레벨', en: 'Level', ja: 'レベル', zh: '级别', es: 'Nivel', fr: 'Niveau', de: 'Niveau', pt: 'Nível', ru: 'Уровень', it: 'Livello' },
  levelBeginner: { ko: '입문', en: 'Beginner', ja: '入門', zh: '入门', es: 'Principiante', fr: 'Débutant', de: 'Anfänger', pt: 'Iniciante', ru: 'Начальный', it: 'Principiante' },
  levelMid:    { ko: '중급', en: 'Intermediate', ja: '中級', zh: '中级', es: 'Intermedio', fr: 'Intermédiaire', de: 'Mittel', pt: 'Intermediário', ru: 'Средний', it: 'Intermedio' },
  levelJazz:   { ko: '재즈', en: 'Jazz', ja: 'ジャズ', zh: '爵士', es: 'Jazz', fr: 'Jazz', de: 'Jazz', pt: 'Jazz', ru: 'Джаз', it: 'Jazz' },
  jazzLocked:  { ko: '🔒 재즈', en: '🔒 Jazz', ja: '🔒 ジャズ', zh: '🔒 爵士', es: '🔒 Jazz', fr: '🔒 Jazz', de: '🔒 Jazz', pt: '🔒 Jazz', ru: '🔒 Джаз', it: '🔒 Jazz' },
  selectedKeyLabel: { ko: '선택된 키', en: 'Selected Key', ja: '選択したキー', zh: '所选调', es: 'Tonalidad elegida', fr: 'Tonalité choisie', de: 'Gewählte Tonart', pt: 'Tom escolhido', ru: 'Выбранная тональность', it: 'Tonalità scelta' },
  startExplore: { ko: '▶ 탐색 시작', en: '▶ Start', ja: '▶ スタート', zh: '▶ 开始探索', es: '▶ Empezar', fr: '▶ Démarrer', de: '▶ Start', pt: '▶ Iniciar', ru: '▶ Начать', it: '▶ Inizia' },
  premiumActive: { ko: '✦ 프리미엄 이용 중', en: '✦ Premium Active', ja: '✦ プレミアム利用中', zh: '✦ 高级版使用中', es: '✦ Premium activo', fr: '✦ Premium activé', de: '✦ Premium aktiv', pt: '✦ Premium ativo', ru: '✦ Премиум активен', it: '✦ Premium attivo' },
  premiumUnlock: { ko: '✦ 프리미엄 잠금 해제', en: '✦ Unlock Premium', ja: '✦ プレミアムを解除', zh: '✦ 解锁高级版', es: '✦ Desbloquear Premium', fr: '✦ Débloquer Premium', de: '✦ Premium freischalten', pt: '✦ Desbloquear Premium', ru: '✦ Открыть Премиум', it: '✦ Sblocca Premium' },

  // ── 공통 컨트롤 ──
  play:   { ko: '재생', en: 'Play', ja: '再生', zh: '播放', es: 'Reproducir', fr: 'Lecture', de: 'Wiedergabe', pt: 'Reproduzir', ru: 'Играть', it: 'Riproduci' },
  stop:   { ko: '정지', en: 'Stop', ja: '停止', zh: '停止', es: 'Detener', fr: 'Arrêt', de: 'Stopp', pt: 'Parar', ru: 'Стоп', it: 'Ferma' },
  save:   { ko: '저장', en: 'Save', ja: '保存', zh: '保存', es: 'Guardar', fr: 'Enregistrer', de: 'Speichern', pt: 'Salvar', ru: 'Сохранить', it: 'Salva' },
  load:   { ko: '불러오기', en: 'Load', ja: '読み込み', zh: '载入', es: 'Cargar', fr: 'Charger', de: 'Laden', pt: 'Carregar', ru: 'Загрузить', it: 'Carica' },
  reset:  { ko: '초기화', en: 'Reset', ja: 'リセット', zh: '重置', es: 'Reiniciar', fr: 'Réinitialiser', de: 'Zurücksetzen', pt: 'Redefinir', ru: 'Сброс', it: 'Reimposta' },
  bars:   { ko: '마디', en: 'Bars', ja: '小節', zh: '小节', es: 'Compases', fr: 'Mesures', de: 'Takte', pt: 'Compassos', ru: 'Такты', it: 'Battute' },
  done:   { ko: '완료', en: 'Done', ja: '完了', zh: '完成', es: 'Listo', fr: 'Terminé', de: 'Fertig', pt: 'Concluído', ru: 'Готово', it: 'Fatto' },
  cancel: { ko: '취소', en: 'Cancel', ja: 'キャンセル', zh: '取消', es: 'Cancelar', fr: 'Annuler', de: 'Abbrechen', pt: 'Cancelar', ru: 'Отмена', it: 'Annulla' },
  guitar: { ko: '기타', en: 'Guitar', ja: 'ギター', zh: '吉他', es: 'Guitarra', fr: 'Guitare', de: 'Gitarre', pt: 'Violão', ru: 'Гитара', it: 'Chitarra' },
  piano:  { ko: '피아노', en: 'Piano', ja: 'ピアノ', zh: '钢琴', es: 'Piano', fr: 'Piano', de: 'Klavier', pt: 'Piano', ru: 'Пианино', it: 'Piano' },
  strum:  { ko: '스트럼', en: 'Strum', ja: 'ストラム', zh: '扫弦', es: 'Rasgueo', fr: 'Gratté', de: 'Anschlag', pt: 'Batida', ru: 'Бой', it: 'Strimpellata' },
  arpeggio: { ko: '아르페지오', en: 'Arpeggio', ja: 'アルペジオ', zh: '琶音', es: 'Arpegio', fr: 'Arpège', de: 'Arpeggio', pt: 'Arpejo', ru: 'Арпеджио', it: 'Arpeggio' },
};
