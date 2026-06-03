# Collegemeet

A college portfolio and collaboration platform with blog posts, real-time chat, and WebRTC video calls.

## Features

- User authentication (local + Google OAuth)
- Portfolio pages (about, skills, qualifications)
- Blog / notice board with comments and likes
- Department-based text chat rooms
- WebRTC video calls with screen sharing and local recording
- Contact form

## Local development

```bash
npm install
cp .env.example .env
# Start MongoDB locally, then:
npm run dev
```

Open [http://localhost:8000](http://localhost:8000)

---

## Deploy with Docker (recommended)

Best for a VPS (DigitalOcean, AWS EC2, Linode, etc.). Runs the app, MongoDB, and Redis together.

### Requirements

- A server with Docker and Docker Compose installed
- A domain name (optional but required for HTTPS / video calls)

### Steps

1. **Copy the project to your server** (git clone or scp).

2. **Create production env file:**

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Example |
|---|---|
| `SESSION_SECRET` | long random string |
| `GOOGLE_CALLBACK_URL` | `https://yourdomain.com/users/auth/google/callback` |
| `SMTP_USER` / `SMTP_PASS` | Gmail app password (optional) |

3. **Start everything:**

```bash
docker compose up -d --build
```

4. **Check it's running:**

```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

5. **Put Nginx + HTTPS in front** (required for WebRTC/camera in browsers):

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get a free SSL cert with [Certbot](https://certbot.eff.org/).

6. **Update Google OAuth** callback URL to `https://yourdomain.com/users/auth/google/callback` if using Google sign-in.

### Useful Docker commands

```bash
docker compose logs -f app    # view logs
docker compose restart app  # restart app
docker compose down         # stop all services
```

---

## Deploy without Docker (VPS / manual)

1. Install Node 20+, MongoDB, and Redis on the server.
2. Clone repo, run `npm ci --omit=dev`.
3. Set env vars (see `.env.example`):

```bash
export NODE_ENV=production
export PORT=8000
export SESSION_SECRET=your-secret
export MONGODB_URI=mongodb://127.0.0.1:27017/blog_website
export REDIS_HOST=127.0.0.1
export REDIS_PORT=6379
```

4. Run with a process manager:

```bash
npm install -g pm2
pm2 start index.js --name collegemeet
pm2 save
pm2 startup
```

5. Put Nginx + HTTPS in front (same config as above).

---

## Cloud database option (MongoDB Atlas)

If you use [MongoDB Atlas](https://www.mongodb.com/atlas) instead of the Docker MongoDB service:

1. Create a free cluster and copy the connection string.
2. Set in `.env`:

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/blog_website
```

3. Remove the `mongo` service from `docker-compose.yml` or run only the app container.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default 8000) |
| `NODE_ENV` | Yes (prod) | Set to `production` |
| `SESSION_SECRET` | Yes (prod) | Session cookie secret |
| `MONGODB_URI` | Yes (prod) | MongoDB connection string |
| `REDIS_HOST` | No | Redis host for email queue |
| `REDIS_PORT` | No | Redis port (default 6379) |
| `SMTP_USER` / `SMTP_PASS` | No | Email for comment notifications |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | No | Google OAuth |

---

## Production notes

- **HTTPS is required** for camera/microphone and WebRTC video calls.
- **Uploads** are stored on disk (`uploads/`). With Docker, a volume keeps them across restarts.
- **Video calls** between users on different networks may need a TURN server. Set `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL` in `.env` (see `.env.example`); the room page injects them for WebRTC.
- **Debugging the room**: every flow logs to the browser console as `[Collegemeet:module]`. Filter DevTools by `Collegemeet`. Export history with `cmDumpLogs()` in the console. Add `&debug=1` for an on-page log panel. Server logs: `[stream]` in the terminal and `production_logs/room-flow.log` when `DEBUG_LOGS=1` (on by default in development).
- **Redis** is only needed for comment email notifications; the app runs without it but emails won't send.

## Health check

```
GET /health
→ {"status":"ok"}
```
