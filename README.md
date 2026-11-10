# TheABCs.ai audience questions

A very small app for taking anonymous questions during a workshop.

- `/` is the attendee page: one box, one button, no name or email.
- `/host` is the page to project. It lists the questions, newest first, and refreshes every two seconds.

It runs as a single Cloudflare Worker. Questions are stored in a Durable Object (built-in SQLite), so there is no database to create.

## Deploy with Cloudflare

1. In the Cloudflare dashboard go to **Workers & Pages > Create > Import a repository** and pick this repo.
2. Keep the defaults (deploy command `npx wrangler deploy`) and deploy.
3. Open the Worker, then **Settings > Domains & Routes > Add > Custom domain** and enter `questions.theabcs.ai`. The `theabcs.ai` zone needs to be on the same Cloudflare account.

Or from a terminal:

```bash
npm install
```

```bash
npx wrangler deploy
```

## Removing questions (optional)

By default nobody can delete anything. To switch on moderation, add a secret called `HOST_KEY` (Worker **Settings > Variables and Secrets**, or `npx wrangler secret put HOST_KEY`) and open:

```
https://questions.theabcs.ai/host?key=YOUR_HOST_KEY
```

That view adds a **Remove** button per question and a **Clear all** button. Use it on your laptop to clear test questions before the session. Project the plain `/host` page so the key is never on screen.

## Run locally

```bash
npm install
```

```bash
npm run dev
```

For local moderation, create a `.dev.vars` file containing `HOST_KEY=anything`.

## Notes

- Questions are limited to 300 characters and the list to 1,000 questions.
- The QR code on the host page (`public/qr.svg`) points at `https://questions.theabcs.ai`. Regenerate it if the address changes.
