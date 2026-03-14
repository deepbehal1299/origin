# Origin Beta Deployment Runbook

## Goal

Deploy Origin for a private beta using:

- `Vercel` for the Next.js frontend
- `Neon Postgres` for the managed database
- `Railway` or low-cost `Render` for the Node backend

This runbook keeps the stack simple, low-cost, and repeatable.

## 1. Prerequisites

- GitHub repo is up to date on `main`
- Local checks pass:
  - `npm run -w backend test`
  - `npm run -w backend build`
  - `npm run -w frontend test`
  - `npm run -w frontend build`
- You have created accounts for:
  - Neon
  - Vercel
  - Railway or Render

## 2. Environment Variables

### Backend

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon Postgres connection string |
| `DATABASE_SSL` | Usually yes in prod | Set to `true` when the provider requires SSL |
| `PORT` | Yes | Backend port, usually provided by host |
| `CORS_ORIGIN` | Yes | Frontend URL, for example `https://origin-your-team.vercel.app` |
| `ROASTERS_CONFIG` | No | Override the default roaster config path if needed |

### Frontend

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes | Public base URL for the backend, for example `https://origin-api.up.railway.app` |

## 3. Neon Setup

1. Create a new Neon project.
2. Create a database named `origin`.
3. Copy the pooled Postgres connection string.
4. Store it for backend `DATABASE_URL`.
5. If Neon requires SSL for the chosen connection string, set `DATABASE_SSL=true`.

## 4. Backend Deployment

### Railway path

1. Create a new Railway project from the GitHub repo.
2. Set the root directory to `backend` if Railway asks for it, or configure the service to run backend workspace commands from the repo root.
3. Set environment variables:
   - `DATABASE_URL`
   - `DATABASE_SSL=true`
   - `CORS_ORIGIN=<your frontend URL>`
   - `PORT` if Railway does not inject it automatically
4. Use these commands:
   - Build: `npm run -w backend build`
   - Start: `npm run -w backend start`
5. After the first deploy, run migrations:
   - `npm run -w backend db:migrate`
6. Trigger a manual scrape:
   - `npm run -w backend scrape`

### Render path

1. Create a new Web Service from the GitHub repo.
2. Set the root directory to the repo root.
3. Use these commands:
   - Build: `npm ci && npm run -w backend build`
   - Start: `npm run -w backend start`
4. Set the same backend environment variables as above.
5. After the first deploy:
   - run `npm run -w backend db:migrate`
   - run `npm run -w backend scrape`

## 5. Frontend Deployment

1. Import the GitHub repo into Vercel.
2. Set the root directory to `frontend`.
3. Set `NEXT_PUBLIC_API_URL` to the deployed backend URL.
4. Deploy on the Hobby plan first.
5. After deploy, note the generated frontend URL and backfill it into backend `CORS_ORIGIN`.

## 6. Post-Deploy Smoke Test

### Backend

- Open `<backend-url>/health`
- Expect: `{"status":"ok"}`

- Open `<backend-url>/coffees`
- Expect: JSON array

- Open `<backend-url>/meta`
- Expect: JSON object with freshness fields

### Frontend

- Open the deployed frontend URL
- Verify the Feed loads live data
- Verify “Last updated” appears after a successful scrape
- Verify Compare and Settings navigation works
- Verify Buy opens a roaster product page in a new tab

## 7. Monitoring Baseline

For private beta, the minimum acceptable monitoring is:

- uptime check on frontend homepage
- uptime check on backend `/health`
- provider log access for backend runtime errors
- provider log access for scrape failures
- manual check of `/meta` to confirm freshness after the scheduled scrape

## 8. Release Checklist

- backend CI green
- frontend CI green
- migrations applied in production
- manual scrape completed
- `/coffees` returns expected data
- `/meta` returns freshness metadata
- Feed retry/fallback state manually verified
- Android Chrome smoke pass
- Desktop Chrome smoke pass

## 9. Rollback Approach

- Keep the previous successful backend deployment available in the hosting provider
- Keep the previous frontend deployment in Vercel
- Do not destroy the Neon database during rollback
- If a bad scrape corrupts freshness expectations, re-run `npm run -w backend scrape` after the rollback
