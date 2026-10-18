# Deployment

The app is a single Node.js process that serves the frontend and the API. It needs one secret: `ANTHROPIC_API_KEY`. Never commit the key; `.env` is git-ignored.

## Option A – Render (free tier, recommended)

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, select the `algebra-tutor-ai` repository (`https://github.com/Reetika-k/algebra-tutor-ai`). Render reads `render.yaml` at the repository root.
3. When prompted, enter `ANTHROPIC_API_KEY` (the blueprint marks it `sync: false`, so it is typed into the dashboard, not stored in git).
4. Deploy. The health check path is `/api/health`; the service is ready when it returns `{"ok":true,"provider":"claude",...}`.
5. Run the post-deployment smoke test from your machine:

   ```bash
   BASE_URL=https://<your-service>.onrender.com npm run test:remote
   ```

Notes: free Render services sleep after inactivity; the first request after sleep takes ~30–60 s. Open the URL once before a demo.

## Option B – Railway / Fly / any Node host

Set the environment variables `ANTHROPIC_API_KEY`, `LLM_PROVIDER=claude` and (optionally) `CLAUDE_MODEL`, use `npm ci` to build and `npm start` to run. The server listens on `PORT` (defaults to 3000).

## Option C – Docker

```bash
docker build -t algebra-tutor-ai .
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... algebra-tutor-ai
```

## Post-deployment checklist

- [ ] `GET /api/health` returns `ok: true` with `provider: claude`
- [ ] `npm run test:remote` passes against the public URL
- [ ] Open the URL in two browsers (e.g. Chrome and Safari) and complete the demo flow in `docs/DEMO_SCRIPT.md`
- [ ] Confirm the key is not visible anywhere in the page source or network responses (the browser only ever talks to `/api/*`)
- [ ] Open `<public URL>/reports/dashboard.html`: the quality dashboard is served from the repository's `reports/` folder (rebuild it with `npm run dashboard` before deploying so it matches the code)

## Cost note

Default model is `claude-opus-5`. A typical demo session (about 30 requests) costs well under one US dollar at current pricing; `CLAUDE_MODEL=claude-sonnet-5` roughly halves that. Change the model only via the environment variable; no code change is needed.
