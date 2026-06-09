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
async function callGemini(userMsg: string, env: Env): Promise<string> {
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${env.GEMINI_API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userMsg }] }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: RESPONSE_SCHEMA,
        maxOutputTokens: 1500,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.log(`gemini ${res.status}: ${errText.slice(0, 300)}`); // 원문은 로그에만
    // 429(할당량/레이트), 503(과부하)는 "잠시 혼잡" 케이스로 분류 → 앱에서 친절히 안내
    if (res.status === 429 || res.status === 503) throw new Error("upstream_busy");
    throw new Error("upstream_error");
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

    const { appUserId, progression, genre, level, key, mode } = body ?? {};
    if (!appUserId) return json({ error: "missing_app_user_id" }, 400);
    if (!progression || !String(progression).trim())
      return json({ error: "missing_progression" }, 400);

    // 1) 프리미엄 검증 (클라이언트 신뢰 X)
    if (!(await isPremium(String(appUserId), env)))
      return json({ error: "not_premium" }, 403);

    // 2) 레이트 리밋
    if (!(await withinRateLimit(String(appUserId), env)))
      return json({ error: "rate_limited" }, 429);

    // 3) Gemini 호출
    const userMsg =
      `코드 진행: ${progression}\n` +
      `장르: ${genre ?? "팝"}\n` +
      `레벨: ${level ?? "중급"}\n` +
      `기준 키: ${key ?? "C"} ${mode === "minor" ? "단조" : "장조"}`;

    try {
      const text = await callGemini(userMsg, env);
      return new Response(text, {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // Gemini 혼잡(429/503): 앱이 규칙 기반 분석으로 자동 폴백하도록 신호
      if (msg === "upstream_busy")
        return json({ error: "ai_busy", message: "AI 서버가 잠시 혼잡합니다" }, 503);
      return json({ error: "ai_failed", message: "AI 분석에 실패했습니다" }, 502);
    }
  },
};
