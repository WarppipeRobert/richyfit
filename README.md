# everfit (Express + TypeScript)

## Prereqs
- Node.js 18+ (recommended 20+)
- Docker + Docker Compose

## Setup
cp .env.example .env
docker compose up --build
npm install
npm run dev
## Auth flow (summary)

- `POST /auth/register` creates a user (email + password + role).
- `POST /auth/login` verifies credentials and returns a short-lived JWT access token (default `15m`).
- Protected routes require: `Authorization: Bearer <token>`.
- JWT payload includes:
  - `sub` = userId
  - `role`
  - `iat`, `exp`

### Environment
Set in `.env`:

- `JWT_SECRET` (required)
- `JWT_ACCESS_TTL` (optional, default `15m`)

## Auth examples (curl)

### Register (one-time)
curl -i -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123","role":"client"}'

### Login (get access token)
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}'

If you have `jq`, grab the token:
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' | jq -r .accessToken)
echo $TOKEN

### Call a protected route

`GET /auth/me` returns the current user from the JWT (`{ id, role }`):
curl -s http://localhost:3000/auth/me \
  -H "Authorization: Bearer $TOKEN"

Expected response:
{ "user": { "id": "...", "role": "client" } }


Missing/invalid token:
* returns `401` with `{ code, message }`


