/**
 * 도수 패턴 → 곡 참조 DB
 * pattern: 도수 인덱스 배열 (0=I, 1=II, 2=III, 3=IV, 4=V, 5=VI, 6=VII)
 * songs: 대표곡 이름 (한국/영어 혼합, 최대 4개)
 */
export const SONG_PATTERNS = [
  // ── 팝 황금 진행 I-V-vi-IV ──────────────────────────────
  {
    pattern: [0, 4, 5, 3],
    songs: ['Let It Be', 'Someone Like You', '비와 당신의 이야기', 'No Woman No Cry'],
  },
  // ── vi-IV-I-V (감성 팝) ──────────────────────────────────
  {
    pattern: [5, 3, 0, 4],
    songs: ['거짓말 (빅뱅)', "Don't Stop Believin'", '오래된 노래', 'Zombie'],
  },
  // ── I-vi-IV-V (클래식 팝) ────────────────────────────────
  {
    pattern: [0, 5, 3, 4],
    songs: ['Stand By Me', '보고 싶다', 'Heart and Soul', 'Blue Moon'],
  },
  // ── I-IV-V (기본 록/블루스) ──────────────────────────────
  {
    pattern: [0, 3, 4],
    songs: ['La Bamba', 'Wild Thing', 'Twist and Shout', '아리랑 변주'],
  },
  // ── ii-V-I (재즈 기본) ───────────────────────────────────
  {
    pattern: [1, 4, 0],
    songs: ['Autumn Leaves', 'Fly Me to the Moon', 'All of Me', 'The Days of Wine and Roses'],
  },
  // ── I-vi-ii-V (재즈 터나라운드) ─────────────────────────
  {
    pattern: [0, 5, 1, 4],
    songs: ['I Got Rhythm', 'Rhythm Changes', 'Rhythm of the Rain', 'All the Things You Are'],
  },
  // ── I-V-iii-vi (캐논 진행) ───────────────────────────────
  {
    pattern: [0, 4, 2, 5],
    songs: ['캐논 변주 (파헬벨)', 'Graduation (Vitamin C)', 'With or Without You', '사랑하기 때문에'],
  },
  // ── vi-V-I-IV (한국 발라드) ──────────────────────────────
  {
    pattern: [5, 4, 0, 3],
    songs: ['그리움만 쌓이고', '사랑의 미로', '잊혀진 계절', '가을 안에서'],
  },
  // ── I-IV-vi-V ────────────────────────────────────────────
  {
    pattern: [0, 3, 5, 4],
    songs: ['Happier', 'Budapest', '너에게 난 나에게 넌', 'She Drives Me Crazy'],
  },
  // ── vi-IV-V-I ────────────────────────────────────────────
  {
    pattern: [5, 3, 4, 0],
    songs: ['Grenade', '좋아', 'Better Now', '사랑을 했다 (iKON)'],
  },
  // ── I-V-IV-I (블루스 느낌) ───────────────────────────────
  {
    pattern: [0, 4, 3, 0],
    songs: ['Sweet Home Chicago', 'Rock Around the Clock', 'Johnny B. Goode'],
  },
  // ── I-IV-I-V (잔잔한 팝) ────────────────────────────────
  {
    pattern: [0, 3, 0, 4],
    songs: ['오 마이 걸', 'Home (Michael Bublé)', '어디에도', 'Simple Man'],
  },
  // ── ii-V-I-VI (재즈 순환) ───────────────────────────────
  {
    pattern: [1, 4, 0, 5],
    songs: ['Misty', 'My Funny Valentine', 'Autumn Leaves (재즈)', 'Georgia on My Mind'],
  },
  // ── I-III-IV-V ───────────────────────────────────────────
  {
    pattern: [0, 2, 3, 4],
    songs: ['La Grange (ZZ Top)', 'Sweet Child O\' Mine (인트로)', 'Something (Beatles)'],
  },
  // ── vi-ii-V-I ────────────────────────────────────────────
  {
    pattern: [5, 1, 4, 0],
    songs: ['Summertime', 'Fly Me to the Moon (재즈)', 'Yesterday (코드)', 'The Girl from Ipanema'],
  },
  // ── I-II-IV-I (팝 변형) ──────────────────────────────────
  {
    pattern: [0, 1, 3, 0],
    songs: ['아이유 - 좋은 날', '이적 - 다행이다'],
  },
  // ── IV-I-V-vi ────────────────────────────────────────────
  {
    pattern: [3, 0, 4, 5],
    songs: ['Despacito', '빨간맛 (Red Velvet)', 'Sugar', 'Dynamite (BTS)'],
  },
  // ── I-V-vi-III-IV (캐논 확장) ───────────────────────────
  {
    pattern: [0, 4, 5, 2, 3],
    songs: ['캐논 in D', 'Graduation (확장)', 'Turn Around'],
  },
  // ── vi-IV-I-III ──────────────────────────────────────────
  {
    pattern: [5, 3, 0, 2],
    songs: ['Human (Rag\'n\'Bone Man)', '오늘도 맑음', 'Treat You Better'],
  },
  // ── I-IV-II-V ────────────────────────────────────────────
  {
    pattern: [0, 3, 1, 4],
    songs: ['봄날 (BTS)', 'Spring Day', '겨울잠'],
  },
];
