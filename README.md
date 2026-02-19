# 3Dify

**Drop a photo. Get a 3D print.**

A free, self-hosted web service that converts photos into 3D-printable STL files using AI. Upload an image, watch it get processed in real time, download a print-ready model.

![3Dify Demo](docs/demo.gif)

## How It Works

You upload a photo on the web frontend (hosted on your VPS). The server queues the job and your home GPU worker picks it up over a WebSocket connection. The worker runs [Hunyuan3D 2.1](https://github.com/Tencent/Hunyuan3D-2) to generate a 3D mesh, repairs it for printing, and sends the result back. You download the STL and print it.

```
[Browser] → [VPS: Nginx + FastAPI] ←WebSocket→ [Home PC: Worker + GPU]
```

The worker connects *outbound* to the server — no port forwarding needed on your home network.

## Features

- **Photo → STL in ~60 seconds** (depends on GPU and resolution settings)
- **Live progress tracking** via WebSocket — watch each step as it happens
- **In-browser 3D preview** of the generated model (GLB)
- **Community gallery** of generated models
- **Admin dashboard** with GPU monitoring, job management, moderation tools, audit log
- **Worker runs on your home GPU** — no cloud GPU costs
- **Outbound-only worker connection** — no port forwarding, works behind NAT/firewalls

## Requirements

### VPS (Server)

- Docker + Docker Compose
- Domain with SSL (Nginx + Let's Encrypt, or Cloudflare)
- PostgreSQL (included in docker-compose, or use an external instance)

### Home PC (Worker)

- NVIDIA GPU with 16GB+ VRAM (tested on RTX 5070 Ti)
- WSL2 (Ubuntu) or native Linux
- [Hunyuan3D 2.1](https://github.com/Tencent/Hunyuan3D-2) installed
- Python 3.10+, CUDA 12+

## VPS Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/ThatButters/3Dify.git
   cd 3Dify
   ```

2. Create your environment file:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and set real values — at minimum change the passwords and generate random tokens for `ADMIN_AUTH_TOKEN` and `WORKER_AUTH_TOKEN`:
   ```bash
   # Quick way to generate tokens:
   python3 -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

3. Start the stack:
   ```bash
   docker compose up -d
   ```
   This starts three containers: FastAPI backend (port 8080), Nginx frontend (port 3000), and PostgreSQL.

4. Point your domain to the VPS. If using a reverse proxy (Nginx/Caddy on the host), proxy to port 3000 — the included `nginx.conf` inside the frontend container handles API and WebSocket proxying to the backend internally.

5. Visit `https://yourdomain.com/admin` and log in with your admin token.

> **Note:** If you already have PostgreSQL running on the host, remove the `db` service from `docker-compose.yml` and set `DATABASE_URL` in `.env` to point to your existing instance.

## Worker Setup

1. Install [Hunyuan3D 2.1](https://github.com/Tencent/Hunyuan3D-2) following their instructions. Make sure it runs on your GPU.

2. Install worker dependencies:
   ```bash
   cd worker
   pip install -r requirements.txt
   ```

3. Create the worker config:
   ```bash
   cp .env.example .env
   ```
   Set `VPS_WS_URL` to your server's WebSocket endpoint (e.g. `wss://yourdomain.com/ws/worker`) and `WORKER_AUTH_TOKEN` to match the token in your server's `.env`.

4. Start the worker:
   ```bash
   python worker.py
   ```
   The worker will connect to your server, show a heartbeat, and wait for jobs. The AI model loads into VRAM on the first job and stays loaded for subsequent ones.

## Usage

- Visit your domain, drop in a photo, wait about a minute
- The 3D model renders in your browser — download as STL or GLB
- Rate limit: 20 jobs per IP per day (configurable in admin)
- Jobs expire after 72 hours

## Admin Dashboard

Visit `/admin` and log in with your `ADMIN_AUTH_TOKEN` from `.env`.

From the dashboard you can:
- Monitor GPU utilization, VRAM, temperature in real time
- Pause/resume job processing
- View, retry, cancel, or delete jobs
- Handle content reports and manage IP bans
- Configure rate limits and job settings
- Export audit logs

## Tips for Best Results

- Use a photo with a **clear subject and simple background** — rembg removes the background automatically, but cleaner inputs help
- **Single objects** work better than scenes
- Good lighting and a **straight-on angle** produces the best geometry
- **Organic shapes** (people, animals, characters) tend to print more interestingly than flat objects
- The output is already watertight and scaled for printing — load the STL directly into your slicer

## Project Structure

```
3Dify/
├── docker-compose.yml      # VPS deployment (server + frontend + db)
├── .env.example             # Server environment variables
├── img2stl.py               # Core AI pipeline script
├── server/                  # FastAPI backend
│   ├── Dockerfile
│   ├── main.py
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   └── models/              # Database models
├── frontend/                # React + Vite frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/
│       ├── components/      # UI components + admin dashboard
│       └── pages/           # Route pages
└── worker/                  # Home GPU worker service
    ├── .env.example
    ├── worker.py
    ├── pipeline.py
    └── gpu_monitor.py
```

## Tech Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4
- **Backend:** FastAPI, SQLModel, PostgreSQL, Alembic
- **Worker:** Python, WebSockets, Hunyuan3D 2.1
- **Infrastructure:** Docker, Nginx
- **3D:** trimesh, pyrender, rembg

## License

MIT

---

<!-- TODO: Update GitHub repo settings:
  Description: "Self-hosted photo → 3D-printable STL service powered by Hunyuan3D 2.1"
  Topics: 3d-printing, hunyuan3d, self-hosted, fastapi, react, websocket, ai, stl
-->
