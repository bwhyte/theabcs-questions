import { DurableObject } from "cloudflare:workers";

const MAX_LENGTH = 300;

// Questions used to live in this Durable Object. They are now in Supabase.
// The empty class stays so the earlier data is kept until it is removed on purpose.
export class QuestionBoard extends DurableObject {}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Calls the Supabase REST API for the public.questions table.
const supabase = (env, key, query, init = {}) =>
  fetch(`${env.SUPABASE_URL}/rest/v1/questions${query}`, {
    ...init,
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      ...init.headers,
    },
  });

// Moderation (delete and clear) needs a HOST_KEY secret, supplied by the host page,
// plus a SUPABASE_SECRET_KEY secret because the publishable key cannot delete rows.
const isHost = (request, env) => {
  const key = request.headers.get("x-host-key");
  return Boolean(env.HOST_KEY && env.SUPABASE_SECRET_KEY) && key === env.HOST_KEY;
};

const unavailable = () => json({ error: "Something went wrong. Please try again." }, 502);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/questions") {
      if (request.method === "GET") {
        const response = await supabase(
          env,
          env.SUPABASE_PUBLISHABLE_KEY,
          "?select=id,text,created_at&order=id.desc&limit=1000"
        );
        if (!response.ok) return unavailable();
        return json({ questions: await response.json(), canModerate: isHost(request, env) });
      }

      if (request.method === "POST") {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid request." }, 400);
        }
        const text = typeof body?.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
        if (!text) return json({ error: "Please write a question first." }, 400);
        if (text.length > MAX_LENGTH) {
          return json({ error: `Please keep it under ${MAX_LENGTH} characters.` }, 400);
        }
        const response = await supabase(env, env.SUPABASE_PUBLISHABLE_KEY, "", {
          method: "POST",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) return unavailable();
        return json({ ok: true }, 201);
      }

      if (request.method === "DELETE") {
        if (!isHost(request, env)) return json({ error: "Not allowed." }, 403);
        const response = await supabase(env, env.SUPABASE_SECRET_KEY, "?id=gt.0", { method: "DELETE" });
        return response.ok ? json({ ok: true }) : unavailable();
      }
    }

    const match = url.pathname.match(/^\/api\/questions\/(\d+)$/);
    if (match && request.method === "DELETE") {
      if (!isHost(request, env)) return json({ error: "Not allowed." }, 403);
      const response = await supabase(env, env.SUPABASE_SECRET_KEY, `?id=eq.${match[1]}`, { method: "DELETE" });
      return response.ok ? json({ ok: true }) : unavailable();
    }

    return json({ error: "Not found." }, 404);
  },
};
