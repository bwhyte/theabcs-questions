import { DurableObject } from "cloudflare:workers";

const MAX_LENGTH = 300;
const MAX_QUESTIONS = 1000;

// One Durable Object holds every question for the session in its own SQLite database.
export class QuestionBoard extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS questions (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         text TEXT NOT NULL,
         created_at INTEGER NOT NULL
       )`
    );
  }

  list() {
    return this.sql.exec("SELECT id, text, created_at FROM questions ORDER BY id DESC").toArray();
  }

  add(text) {
    const { n } = this.sql.exec("SELECT COUNT(*) AS n FROM questions").one();
    if (n >= MAX_QUESTIONS) return false;
    this.sql.exec("INSERT INTO questions (text, created_at) VALUES (?, ?)", text, Date.now());
    return true;
  }

  remove(id) {
    this.sql.exec("DELETE FROM questions WHERE id = ?", id);
  }

  clear() {
    this.sql.exec("DELETE FROM questions");
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Moderation (delete and clear) only works when a HOST_KEY secret is set and supplied.
const isHost = (request, env) => {
  const key = request.headers.get("x-host-key");
  return Boolean(env.HOST_KEY) && key === env.HOST_KEY;
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const board = env.BOARD.get(env.BOARD.idFromName("main"));

    if (url.pathname === "/api/questions") {
      if (request.method === "GET") {
        return json({ questions: await board.list(), canModerate: isHost(request, env) });
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
        if (!(await board.add(text))) return json({ error: "The question list is full." }, 429);
        return json({ ok: true }, 201);
      }

      if (request.method === "DELETE") {
        if (!isHost(request, env)) return json({ error: "Not allowed." }, 403);
        await board.clear();
        return json({ ok: true });
      }
    }

    const match = url.pathname.match(/^\/api\/questions\/(\d+)$/);
    if (match && request.method === "DELETE") {
      if (!isHost(request, env)) return json({ error: "Not allowed." }, 403);
      await board.remove(Number(match[1]));
      return json({ ok: true });
    }

    return json({ error: "Not found." }, 404);
  },
};
