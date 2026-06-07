# Cloudflare Front Challenge

## Goal

The web front door is protected by Cloudflare Managed Challenge, while the backend remains the real source of truth for authentication and authorization.

## Cloudflare Rules

### Skip

```text
http.host eq "sub.889100.xyz" and (
  starts_with(http.request.uri.path, "/sub/")
  or starts_with(http.request.uri.path, "/api/")
  or http.request.uri.path eq "/config"
  or http.request.uri.path eq "/health"
  or starts_with(http.request.uri.path, "/assets/")
  or http.request.uri.path eq "/favicon.ico"
  or http.request.uri.path eq "/robots.txt"
  or http.request.uri.path eq "/manifest.json"
)
```

Action: `Skip`

### Managed Challenge

```text
http.host eq "sub.889100.xyz" and not (
  starts_with(http.request.uri.path, "/sub/")
  or starts_with(http.request.uri.path, "/api/")
  or http.request.uri.path eq "/config"
  or http.request.uri.path eq "/health"
  or starts_with(http.request.uri.path, "/assets/")
  or http.request.uri.path eq "/favicon.ico"
  or http.request.uri.path eq "/robots.txt"
  or http.request.uri.path eq "/manifest.json"
)
```

Action: `Managed Challenge`

## Frontend Rules

- `/login`, `/register`, and `/help` are public routes in the SPA.
- Logged-in users entering `/login` or `/register` are redirected to their home page.
- Protected pages do not show inline `401` or `Unauthorized` states when the session expires.
- Session expiry uses `window.location.replace('/login')` so the browser performs a real document request again.

## Backend Interface Classes

| Class | Endpoints | Notes |
| --- | --- | --- |
| Public | `GET /health`, `GET /config`, `POST /api/auth/login`, `POST /api/auth/register`, `GET /sub/:token`, `GET /api/internal/converter-source/:cacheKey?secret=...` | `/config` does not expose Turnstile data. |
| Logged-in user | `GET /api/auth/me`, `POST /api/auth/change-password`, `POST /api/auth/user/reset-sub-token`, `POST /api/redeem`, user subscription views | Missing session returns `401 { error: "UNAUTHORIZED", message: "请先登录" }`. |
| Admin | `/api/admin/*`, `/api/upstreams/*`, `/api/settings/*`, `/api/logs/*`, `/api/admin/rotation/*` | Missing session returns `401`, non-admin session returns `403`. |
| Internal secret | `GET /api/internal/converter-source/:cacheKey` | Requires `secret` query parameter. |

## Notes

- The in-app Turnstile widget has been removed.
- Login and registration no longer send or validate Turnstile tokens.
- Cloudflare is a front-door protection layer only. Backend authorization still applies even if Cloudflare rules are bypassed or misconfigured.
