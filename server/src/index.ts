/**
 * ChordNavigator AI 분석 프록시 (Cloudflare Worker) — Google Gemini 버전
 *
 * 앱 → 이 Worker → Gemini API
 *   - Gemini API 키는 Worker 시크릿(GEMINI_API_KEY)에만 존재. 앱엔 없음.
 *   - 호출 전 RevenueCat REST API로 "프리미엄 구독자인지" 서버에서 검증.
 *   - 사용자당 1일 호출 횟수 제한(KV) — 악용 방지.
 *
 * Gemini 무료 등급(분당 15회·하루 1500회)으로 결제 없이 동작. 추후 유료 전환도 한국 카드 OK.
 */

export interface Env {
  GEMINI_API_KEY: string;          // wrangler secret put GEMINI_API_KEY  (aistudio.google.com 무료 키)
  REVENUECAT_API_KEY: string;      // wrangler secret put REVENUECAT_API_KEY  (RevenueCat 공개 SDK 키 appl_...)
  RATE_LIMIT: KVNamespace;         // wrangler.toml의 kv_namespaces 바인딩
  ENTITLEMENT_ID?: string;         // 기본 "ChordNavigator Pro"
  DAILY_LIMIT?: string;            // 기본 "50"
  GEMINI_MODEL?: string;           // 기본 "gemini-2.0-flash"
}

const DEFAULT_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `너는 음악 코드 진행 분석 전문가야. 주어진 코드 진행을 분석하고 3가지 버전을 제안해.
- analysis: 원본 진행 분석 (2문장, 한국어)
- genre_version: 입력 장르 특성을 살린 재해석 버전
- level_version: 입력 레벨(난이도)에 맞춘 버전
- substitute_version: 대리코드를 활용한 버전
각 *_version의 chords는 "코드1 코드2 코드3 ..." 형식의 공백 구분 문자열, desc는 한국어 한 줄 설명.`;

// Gemini responseSchema (OpenAPI 서브셋, type은 대문자 enum)
const VERSION_SCHEMA = {
  type: "OBJECT",
  properties: { chords: { type: "STRING" }, desc: { type: "STRING" } },
  required: ["chords", "desc"],
} as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    analysis: { type: "STRING" },
    genre_version: VERSION_SCHEMA,
    level_version: VERSION_SCHEMA,
    substitute_version: VERSION_SCHEMA,
  },
  required: ["analysis", "genre_version", "level_version", "substitute_version"],
} as const;

// ── GPS(다음 코드 루트 추천) 태스크 ─────────────────────────────────
const GPS_SYSTEM_PROMPT = `너는 음악가를 위한 코드 진행 GPS야. 현재 진행과 코드를 보고, 이어서 갈 수 있는 자연스러운 루트 3가지를 제시해.
- 각 루트는 서로 다른 분위기/장르 방향.
- chords: 현재 코드 다음에 이어질 3~4개 코드(배열). 도수 흐름의 자연스러움과 레벨(입문=기본코드, 중급=7th, 재즈=텐션)을 지켜.
- genre/mood: 짧은 한국어. tip: 한 줄 한국어 팁.`;

const ROUTES_SCHEMA = {
  type: "OBJECT",
  properties: {
    routes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          genre: { type: "STRING" },
          mood: { type: "STRING" },
          chords: { type: "ARRAY", items: { type: "STRING" } },
          tip: { type: "STRING" },
        },
        required: ["genre", "mood", "chords", "tip"],
      },
    },
  },
  required: ["routes"],
} as const;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** RevenueCat에서 이 사용자가 프리미엄 entitlement 보유 중인지 서버 검증 */
async function isPremium(appUserId: string, env: Env): Promise<boolean> {
  const entId = env.ENTITLEMENT_ID || "ChordNavigator Pro";
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${env.REVENUECAT_API_KEY}` } },
  );
  if (!res.ok) return false;
  const data: any = await res.json();
  const ent = data?.subscriber?.entitlements?.[entId];
  if (!ent) return false;
  if (!ent.expires_date) return true; // 평생(비소모품)은 만료 없음
  return new Date(ent.expires_date).getTime() > Date.now();
}

/** 사용자당 1일 호출 제한 (KV 일일 카운터) */
async function withinRateLimit(appUserId: string, env: Env): Promise<boolean> {
  const limit = parseInt(env.DAILY_LIMIT || "50", 10);
  const day = new Date().toISOString().slice(0, 10);
  const key = `rl:${appUserId}:${day}`;
  const cur = parseInt((await env.RATE_LIMIT.get(key)) || "0", 10);
  if (cur >= limit) return false;
  await env.RATE_LIMIT.put(key, String(cur + 1), { expirationTtl: 60 * 60 * 48 });
  return true;
}

/** Gemini 호출 → 구조화 JSON 문자열 반환 */
async function callGemini(
  userMsg: string,
  env: Env,
  systemPrompt: string = SYSTEM_PROMPT,
  schema: unknown = RESPONSE_SCHEMA,
  maxTokens: number = 1500,
): Promise<string> {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: schema,
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`gemini ${res.status}: ${errText.slice(0, 300)}`);
  }
  const data: any = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini: empty response");
  return text; // response_mime_type=json 이라 유효한 JSON 문자열
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad_json" }, 400);
    }

    const { appUserId, progression, genre, level, key, mode, task,
            curChord, progDeg, detectedGenre } = body ?? {};
    if (!appUserId) return json({ error: "missing_app_user_id" }, 400);

    const isGps = task === "gps";
    if (isGps) {
      if (!curChord || !String(curChord).trim())
        return json({ error: "missing_cur_chord" }, 400);
    } else if (!progression || !String(progression).trim()) {
      return json({ error: "missing_progression" }, 400);
    }

    // 1) 프리미엄 검증 (클라이언트 신뢰 X)
    if (!(await isPremium(String(appUserId), env)))
      return json({ error: "not_premium" }, 403);

    // 2) 레이트 리밋
    if (!(await withinRateLimit(String(appUserId), env)))
      return json({ error: "rate_limited" }, 429);

    // 3) Gemini 호출 — task에 따라 프롬프트/스키마 분기
    const keyStr = `${key ?? "C"} ${mode === "minor" ? "단조" : "장조"}`;
    try {
      let text: string;
      if (isGps) {
        const userMsg =
          `키: ${keyStr}\n` +
          `레벨: ${level ?? "중급"}\n` +
          `선호 장르: ${genre ?? "팝"}${detectedGenre ? ` (진행 분석: ${detectedGenre} 감지)` : ""}\n` +
          `지금까지 진행: ${progression ?? "(시작)"}\n` +
          `도수 패턴: ${progDeg ?? "(시작)"}\n` +
          `현재 코드: ${curChord}\n\n` +
          `"${curChord}" 다음에 이어갈 루트 3가지를 제시해.`;
        text = await callGemini(userMsg, env, GPS_SYSTEM_PROMPT, ROUTES_SCHEMA, 700);
      } else {
        const userMsg =
          `코드 진행: ${progression}\n` +
          `장르: ${genre ?? "팝"}\n` +
          `레벨: ${level ?? "중급"}\n` +
          `기준 키: ${keyStr}`;
        text = await callGemini(userMsg, env);
      }
      return new Response(text, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (e: any) {
      return json({ error: "ai_failed", message: String(e?.message ?? e) }, 502);
    }
  },
};
