# Installing with Docker & Docker Compose

[← Documentation home](README.md) · Next: [First run →](first-run.md)

Clockmaker ships as a Docker image, `boltmk0/botc-clockmaker`, so the only thing you need on the host machine is
Docker. Any always-on machine on your local network works: a home server, a NAS, a Raspberry Pi-class box, or just
the laptop you bring to game night.

- [What's in the image](#whats-in-the-image)
- [Quick try-out (no saved data)](#quick-try-out-no-saved-data)
- [Recommended: Docker Compose with a data volume](#recommended-docker-compose-with-a-data-volume)
- [Using `docker run` instead](#using-docker-run-instead)
- [Storing data in a folder instead of a volume](#storing-data-in-a-folder-instead-of-a-volume)
- [Secrets and optional features (`.env`)](#secrets-and-optional-features-env)
- [Changing the port](#changing-the-port)
- [Opening the app from other devices](#opening-the-app-from-other-devices)
- [HTTPS and reverse proxies](#https-and-reverse-proxies)
- [Updating](#updating)
- [Backing up and restoring](#backing-up-and-restoring)
- [Building the image yourself](#building-the-image-yourself)

---

## What's in the image

- The production Node.js server, listening on port **3000** inside the container.
- `ffmpeg`, used to measure the loudness of uploaded music for [loudness levelling](settings/audio.md#loudness-levelling).
- An upload limit of 200 MB per request (`BODY_SIZE_LIMIT=200M`), so large lossless music files can be uploaded.

Clockmaker has no database. Everything — games, scripts, characters, images, audio, grimoire state, settings — is
stored as plain files under one data directory (see [Configuration & data reference](configuration.md)).

> **Important:** the app stores its data in `/data` inside the container (images after 0.3.11 set
> `RESOURCE_DATA_DIR=/data` and `FEEDBACK_DATA_DIR=/data/feedback` themselves; older ones need them set, which the
> examples below do). Unless you **mount a volume at `/data`**, your data lives only in the container and is **lost
> when the container is recreated** (for example, when you update). Every example below except the quick try-out
> sets this up properly.

## Quick try-out (no saved data)

To have a quick look without keeping anything:

```sh
docker run --rm -p 3000:3000 boltmk0/botc-clockmaker:latest
```

Open <http://localhost:3000>. Press `Ctrl+C` to stop it; everything you did is thrown away.

## Recommended: Docker Compose with a data volume

Create a folder for Clockmaker (e.g. `~/clockmaker`) and put this `docker-compose.yml` in it:

```yaml
# docker-compose.yml
services:
  server:
    image: boltmk0/botc-clockmaker:latest
    restart: unless-stopped          # start again when the host reboots
    ports:
      - "3000:3000"                  # host port : container port
    volumes:
      - data:/data                   # keep all app data in the "data" volume
    environment:
      - RESOURCE_DATA_DIR=/data      # store data in the volume (the default in newer images; needed for older ones)
      - FEEDBACK_DATA_DIR=/data/feedback   # keep feedback submissions in the volume too
    env_file:                        # optional secrets (see below); fine if the file doesn't exist
      - path: .env
        required: false

volumes:
  data:
```

Then, from that folder:

```sh
docker compose up -d        # download the image and start it in the background
docker compose logs -f      # watch the logs (Ctrl+C to stop watching)
docker compose ps           # check it's running
```

Open `http://<host>:3000` and carry on with [First run](first-run.md).

Useful commands:

| Command | What it does |
| --- | --- |
| `docker compose stop` | Stop the app (data is kept) |
| `docker compose start` | Start it again |
| `docker compose down` | Remove the container (data in the volume is kept) |
| `docker compose down -v` | Remove the container **and delete all data** |
| `docker compose restart` | Restart, e.g. after editing `.env` |

> `env_file` with `required: false` needs Docker Compose v2.24 or newer. On an older version, either create an
> empty `.env` file or remove the `env_file` section.

## Using `docker run` instead

The same setup without Compose:

```sh
docker run -d \
  --name clockmaker \
  --restart unless-stopped \
  -p 3000:3000 \
  -e RESOURCE_DATA_DIR=/data \
  -e FEEDBACK_DATA_DIR=/data/feedback \
  -v clockmaker-data:/data \
  boltmk0/botc-clockmaker:latest
```

Add `--env-file .env` to pass secrets (see below). Manage it with `docker stop clockmaker`,
`docker start clockmaker`, `docker logs -f clockmaker` and `docker rm clockmaker`.

## Storing data in a folder instead of a volume

A named volume is managed by Docker. If you would rather see the files directly (handy for backups), map a folder
on the host instead:

```yaml
    volumes:
      - ./clockmaker-data:/data
```

or with `docker run`: `-v "$(pwd)/clockmaker-data:/data"`.

The folder is created on first start. Its layout is described in the
[configuration reference](configuration.md#the-data-directory).

## Secrets and optional features (`.env`)

Some optional features need credentials. Put them in a file called `.env` next to `docker-compose.yml`
(never commit it anywhere public):

```dotenv
# Spotify (see music-and-spotify.md) — needs a Spotify developer app and Spotify Premium
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret

# Feedback form (see player-pages.md#the-feedback-form)
TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret
GMAIL_USER=you@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password
FEEDBACK_TO_EMAILS=you@example.com;someone@example.com
```

Restart the container after changing it (`docker compose up -d` picks up changes). Every variable is listed in the
[configuration reference](configuration.md#environment-variables).

## Changing the port

Change only the **left-hand** number of the port mapping. To serve on port 8080:

```yaml
    ports:
      - "8080:3000"
```

or `-p 8080:3000` with `docker run`. The app is then at `http://<host>:8080`.

## Opening the app from other devices

Every device in the room (the town square TV, the storyteller's phone, tablets…) just opens the app in a web
browser. Use the host machine's address on your network, for example `http://192.168.0.64:3000` or
`http://my-server.local:3000`.

- Make sure the host's firewall allows the port you chose.
- Once you're in, the town square menu has a **Share QR Code** button that shows a QR code for the current page, which
  is the quickest way to get a phone onto it.
- Clockmaker can be installed as an app (a "PWA") from the browser menu — "Add to Home Screen" on phones — which
  gives it its own icon and a full-screen window.

## HTTPS and reverse proxies

Plain HTTP on your local network is fine for nearly everything. You'll want HTTPS (usually through a reverse proxy
such as Caddy, Traefik or nginx in front of the container) if you:

- use **Spotify** from a device that isn't the host itself — Spotify only accepts `https://` redirect addresses
  (plain `http://` is only allowed for loopback addresses like `http://127.0.0.1:3000`), and its in-browser player
  needs a secure page; or
- expose Clockmaker to the internet (not needed for normal use).

When running behind a proxy:

- Tell the app its public address so links and the Spotify sign-in callback are built correctly. Either set
  `ORIGIN=https://clock.example.com`, or have the proxy send forwarding headers and set
  `PROTOCOL_HEADER=x-forwarded-proto` and `HOST_HEADER=x-forwarded-host`.
- The app keeps every device in sync with long-lived streaming connections (server-sent events). Make sure the
  proxy doesn't buffer responses or time them out quickly (in nginx: `proxy_buffering off;` and a long
  `proxy_read_timeout`).
- Keep the proxy's upload size limit high enough for music uploads (in nginx: `client_max_body_size 200m;`).

## Updating

```sh
docker compose pull      # fetch the newest image
docker compose up -d     # recreate the container with it
docker image prune       # optional: remove the old image
```

With `docker run`: `docker pull boltmk0/botc-clockmaker:latest`, then `docker rm -f clockmaker` and run the same
`docker run` command again. Your data lives in the volume, so it survives.

To stay on a specific release, use a version tag instead of `latest`, e.g. `boltmk0/botc-clockmaker:0.3.11`. The
version is shown under the title on the home screen.

## Backing up and restoring

All state is in the data directory, so a backup is just a copy of it. Stop the app first so nothing is half-written:

```sh
docker compose stop
# Named volume: archive it via a throwaway container
docker run --rm -v clockmaker_data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/clockmaker-backup.tgz -C /data .
docker compose start
```

Compose prefixes volume names with the project (folder) name — find the exact name with `docker volume ls`.

To restore into an empty volume:

```sh
docker compose stop
docker run --rm -v clockmaker_data:/data -v "$(pwd)":/backup alpine \
  sh -c "rm -rf /data/* && tar xzf /backup/clockmaker-backup.tgz -C /data"
docker compose start
```

If you used a [host folder](#storing-data-in-a-folder-instead-of-a-volume), just copy the folder.

## Building the image yourself

The repository's own `docker-compose.yml` builds from source rather than pulling the published image:

```sh
git clone <repository-url> botc-clockmaker
cd botc-clockmaker
docker compose up -d --build
```

It mounts a `data` volume at `/data` (where the image keeps its data and feedback) and reads an optional `.env`.

To produce tagged images, the project has helper scripts (they need Node.js as well as Docker):

```sh
npm run docker:build   # build locally, tagged :latest and :<package.json version>
npm run docker:push    # build for linux/amd64 and push both tags (run `docker login` first)
```

Both take options after `--` (e.g. `npm run docker:push -- --registry my.registry.io`); run either with
`-- --help` for the full list.

To run without Docker at all, see "From source code" in the project's main [README](../README.md#from-source-code).

---

Next: [First run →](first-run.md)
