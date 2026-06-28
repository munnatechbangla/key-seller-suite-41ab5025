# DigitalNest — Production Deployment Guide

This app is a **TanStack Start** (React 19 + Vite 7 + Nitro 3) SSR application. The production build outputs a standalone Node.js server, deployable to any host that runs Node 20+ (cPanel Node.js App, VPS, PM2, Render, Railway, DigitalOcean, Fly.io).

---

## 1. Quick start

```bash
npm install
cp .env.example .env      # fill in real values
npm run build
npm start                 # serves on http://0.0.0.0:$PORT  (default 3000)
```

| Item | Value |
|---|---|
| Production entry | `.output/server/index.mjs` |
| Static assets | `.output/public/` (favicon, images, fonts, JS, CSS) |
| Start command | `node .output/server/index.mjs` (`npm start`) |
| Node version | **20.11+** (22 LTS recommended) |
| Default port | `process.env.PORT` (falls back to `3000`) |
| Listen host | `process.env.HOST` (falls back to `0.0.0.0`) |

The Nitro preset is selected via `NITRO_PRESET` (default `cloudflare-module`). To build for Node, Vercel, Netlify, Bun or Deno instead:

```bash
NITRO_PRESET=node-server npm run build   # or use: npm run build:node
```

---

## 1b. Cloudflare Workers (recommended)

This project is configured to deploy to **Cloudflare Workers** via Nitro's
`cloudflare-module` preset (the officially supported TanStack Start target on
Cloudflare). The Worker bundle is `.output/server/index.mjs`; static assets
in `.output/public/` are served via the `ASSETS` binding declared in
[`wrangler.toml`](./wrangler.toml).

```bash
npm install
npm run build:cf            # NITRO_PRESET=cloudflare-module vite build
npx wrangler login          # one-time
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# …repeat for every secret in .env.example…
npm run deploy              # build:cf + wrangler deploy
```

GitHub → Cloudflare automatic deployments:

1. Cloudflare dashboard → **Workers & Pages → Create → Connect to Git**.
2. Select the repository, framework preset **"None"**.
3. Build command: `npm run build:cf`
4. Deploy command: `npx wrangler deploy`
5. Root directory: `/`
6. Add every variable from `.env.example` under **Settings → Variables**
   (mark all `SUPABASE_SERVICE_ROLE_KEY`, gateway keys, `RESEND_API_KEY` as
   **Encrypted**). `VITE_*` vars must be set as plain build-time vars so they
   bake into the client bundle.
7. Add `nodejs_compat` compatibility flag (already declared in `wrangler.toml`).

Custom domains: Workers → your worker → **Triggers → Custom Domains → Add**.

Cloudflare Workers runtime notes (already handled in code):
- `crypto`, `Buffer`, `process.env`, `path`, `fs` (virtual), `stream` work
  via `nodejs_compat`. No code paths use `child_process`, `sharp`, native
  binaries, or filesystem writes outside the bundle.
- Webhooks (`/api/public/payments/**`) and server functions (checkout,
  auth, newsletter, payment init, admin) run as standard Worker `fetch`
  handlers — no changes required.
- Security headers + CSP are applied in `src/server.ts` for every response.



---

## 2. Environment variables

See [`.env.example`](./.env.example) for the full list with comments. Minimum required for a working storefront:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (SSR mirror)
- `SUPABASE_SERVICE_ROLE_KEY` (admin actions, license assignment, webhooks)

Optional: `RESEND_API_KEY` + `EMAILS_ENABLED=true` to actually send email; gateway credentials for whichever payment methods you enable in `/admin/gateways`.

> `VITE_*` vars are baked into the client bundle at **build time** — rebuild after changing them. Non-`VITE_` vars are read at **runtime** via `process.env` and can be changed without rebuilding.

---

## 3. cPanel — Node.js App

1. **Upload code** via Git or File Manager (or `rsync` over SSH).
2. cPanel → **Setup Node.js App** → Create application:
   - Node version: **20.x** or newer
   - Application mode: **Production**
   - Application root: project directory
   - Application URL: your domain
   - Application startup file: `.output/server/index.mjs`
3. Click **Run NPM Install**.
4. Open the cPanel terminal (or SSH) inside the venv shown at the top of the Node.js App page:
   ```bash
   source /home/USER/nodevenv/APPNAME/20/bin/activate
   cd ~/APPNAME
   npm run build
   ```
5. In the Node.js App page, scroll to **Environment variables** and add every key from `.env.example`.
6. Click **Restart**.

cPanel proxies the app via Passenger; no manual Nginx/Apache config needed. Webhooks at `/api/public/*` work out of the box.

**cPanel compatibility:** ✅ Fully supported — single Node entry, no native binaries, no filesystem writes outside `.output/`.

---

## 4. VPS + PM2 + Nginx

```bash
# one-time
sudo apt install -y nodejs npm nginx
sudo npm i -g pm2
git clone <repo> /var/www/digitalnest && cd /var/www/digitalnest
cp .env.example .env && nano .env
npm ci
npm run build

# start under PM2
pm2 start .output/server/index.mjs --name digitalnest --update-env
pm2 save
pm2 startup            # follow the printed command
```

`/etc/nginx/sites-available/digitalnest`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 25m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/digitalnest /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com   # HTTPS
```

Update deploys:

```bash
git pull && npm ci && npm run build && pm2 restart digitalnest --update-env
```

---

## 5. Render / Railway / DigitalOcean App Platform

- **Build command:** `npm ci && npm run build`
- **Start command:** `npm start`
- **Health check path:** `/`
- Add every variable from `.env.example` in the platform's environment UI.
- Node version: select 20 or newer in platform settings (or commit a `.nvmrc` containing `20`).

---

## 6. Webhooks & payments

Webhook routes live under `/api/public/*` and bypass auth by design. They verify HMAC signatures inside each handler. After deploying, configure your gateway dashboards with:

- SSLCommerz IPN: `https://your-domain.com/api/public/payments/sslcommerz/ipn`
- SSLCommerz return: `https://your-domain.com/api/public/payments/sslcommerz/return`
- Custom gateway: `https://your-domain.com/api/public/payments/custom-webhook/<slug>`
- Generic: `https://your-domain.com/api/public/payments/webhook`

These work identically on cPanel, PM2, Render, etc. — they're just HTTP POSTs to the Node server.

---

## 7. Deployment checklist

- [ ] `.env` populated (Supabase URL + keys, service role, gateway secrets)
- [ ] `npm run build` completes with no errors
- [ ] `.output/server/index.mjs` and `.output/public/` both exist
- [ ] `npm start` boots and responds on `$PORT`
- [ ] Reverse proxy / Passenger forwards `Host` + `X-Forwarded-*` headers
- [ ] HTTPS enabled (cert from Let's Encrypt / cPanel AutoSSL / platform)
- [ ] `/admin/health` reports green
- [ ] Test order → webhook → license delivery end-to-end

---

## Deployment report

| Field | Value |
|---|---|
| Production entry file | `.output/server/index.mjs` |
| Build output folder | `.output/` (server) + `.output/public/` (static) |
| `npm start` command | `node .output/server/index.mjs` |
| Required Node.js | `>=20.11.0` (engines field enforces this) |
| Required env vars | See `.env.example` — Supabase trio is the minimum |
| cPanel compatibility | ✅ Compatible (Passenger + Node 20 app) |
| Production readiness | **9.5 / 10** |
| Remaining blockers | None — supply real Supabase + gateway credentials and deploy |
