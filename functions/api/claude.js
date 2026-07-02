/**
 * Anthropic API proxy — runs as a Cloudflare Pages Function on the edge.
 *
 * Route mapping: file path `functions/api/claude.js` → `/api/claude`.
 *
 * Why a proxy? The browser must never see the Anthropic API key. The
 * frontend POSTs to this same-origin endpoint; this function reads the
 * key from the encrypted `ANTHROPIC_API_KEY` environment variable and
 * forwards the request body verbatim to Anthropic's /v1/messages.
 *
 * Request/response bodies are passed through as text, so whatever the
 * frontend sends (model, messages, system, max_tokens, etc.) is what
 * Anthropic receives, and whatever Anthropic returns is what the
 * frontend sees — including upstream error bodies, which helps debug.
 */

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.ANTHROPIC_API_KEY) {
    return json(
      {
        error:
          "ANTHROPIC_API_KEY not configured on server. " +
          "Local dev: add it to .dev.vars. " +
          "Production: Cloudflare dashboard → Pages → your project → " +
          "Settings → Environment variables (encrypted).",
      },
      500
    );
  }

  let bodyText;
  try {
    bodyText = await request.text();
  } catch (e) {
    return json({ error: `Invalid request body: ${e.message}` }, 400);
  }

  if (!bodyText) {
    return json({ error: "Empty request body" }, 400);
  }

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: bodyText,
    });
  } catch (e) {
    return json({ error: `Upstream fetch failed: ${e.message}` }, 502);
  }

  const upstreamBody = await upstream.text();
  return new Response(upstreamBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest({ request }) {
  return json(
    {
      error: `Method ${request.method} not allowed. This endpoint accepts POST only.`,
    },
    405
  );
}
