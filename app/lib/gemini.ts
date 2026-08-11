// ---------------------------------------------------------------------------
// Google Gemini provider adapter for weekly quests.
// Isolated so another compatible provider could replace it via env vars.
// Uses generateContent with strict JSON structured output (responseSchema).
// ---------------------------------------------------------------------------

export type GeminiOutcome =
  | { ok: true; data: unknown; model: string }
  | { ok: false; failureCode: GeminiFailure };

// Normalized, non-sensitive failure categories (never raw provider output).
export type GeminiFailure =
  | 'provider_not_configured'
  | 'provider_auth_failed'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'invalid_model_output';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

function model(): string {
  return process.env.WEEKLY_QUEST_MODEL || 'gemini-flash-latest';
}
function timeoutMs(): number {
  const n = Number(process.env.WEEKLY_QUEST_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 15000;
}

async function callOnce(
  system: string,
  user: string,
  schema: object,
  apiKey: string,
): Promise<{ status: number; json: unknown } | { status: 'timeout' }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const res = await fetch(`${ENDPOINT}/${model()}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          // Roomy cap: a truncated response is invalid JSON and forces a
          // needless deterministic fallback, so give the model space to finish.
          temperature: 0.5,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
    });
    let json: unknown = null;
    try { json = await res.json(); } catch { json = null; }
    return { status: res.status, json };
  } catch {
    return { status: 'timeout' };
  } finally {
    clearTimeout(t);
  }
}

function extractJson(providerJson: unknown): unknown | null {
  const j = providerJson as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Generate structured JSON. One automatic retry for transient 429/5xx.
// No retry for auth (401/403) or schema/parse errors.
export async function generateQuestJson(
  system: string,
  user: string,
  schema: object,
): Promise<GeminiOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, failureCode: 'provider_not_configured' };

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callOnce(system, user, schema, apiKey);

    if (r.status === 'timeout') {
      if (attempt === 0) { await sleep(400); continue; }
      return { ok: false, failureCode: 'provider_timeout' };
    }
    if (r.status === 401 || r.status === 403) return { ok: false, failureCode: 'provider_auth_failed' };
    if (r.status === 429) {
      if (attempt === 0) { await sleep(700); continue; }
      return { ok: false, failureCode: 'provider_rate_limited' };
    }
    if (r.status >= 500) {
      if (attempt === 0) { await sleep(600); continue; }
      return { ok: false, failureCode: 'provider_unavailable' };
    }
    if (r.status !== 200) return { ok: false, failureCode: 'provider_unavailable' };

    const data = extractJson(r.json);
    if (data == null) return { ok: false, failureCode: 'invalid_model_output' };
    return { ok: true, data, model: model() };
  }
  return { ok: false, failureCode: 'provider_unavailable' };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
