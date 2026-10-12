# Configuration & data reference

[← Documentation home](README.md)

- [Environment variables](#environment-variables)
- [The data directory](#the-data-directory)
- [What's stored in each browser](#whats-stored-in-each-browser)
- [Backups](#backups)

## Environment variables

Set these in `docker-compose.yml` (`environment:`), in a `.env` file, or with `-e` on `docker run`. See
[Installing with Docker](installation-docker.md).

### Storage

| Variable | Default | Description |
| --- | --- | --- |
| `RESOURCE_DATA_DIR` | `/data` in the Docker image; otherwise `data/resources`, relative to the working directory | Where all configuration and content is stored. In Docker, **mount a volume at this path**, or your data is lost when the container is replaced. (Images up to 0.3.11 don't set it, so set it to `/data` yourself.) |
| `FEEDBACK_DATA_DIR` | `/data/feedback` in the Docker image; otherwise `data/feedback` | Where feedback form submissions are stored. (Images up to 0.3.11 don't set it.) |

### Server

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on inside the container. With Docker you normally leave this alone and change the published port instead. |
| `ORIGIN` | — | The public address users reach the app at, e.g. `https://clock.example.com`. Set this behind a reverse proxy so the Spotify callback address is built correctly. |
| `PROTOCOL_HEADER`, `HOST_HEADER` | — | Alternatively to `ORIGIN`, the headers your reverse proxy sets, e.g. `x-forwarded-proto` and `x-forwarded-host`. |
| `BODY_SIZE_LIMIT` | `200M` in the Docker image | Largest upload accepted per request. Raise it if very large music files fail to upload. |
| `FFMPEG_PATH` | `ffmpeg` | The ffmpeg used to measure music loudness. Included in the Docker image. |

(`PORT`, `ORIGIN`, `PROTOCOL_HEADER`, `HOST_HEADER` and `BODY_SIZE_LIMIT` come from SvelteKit's Node adapter, which
supports a few more such as `HOST` and `ADDRESS_HEADER`.)

### Spotify

| Variable | Description |
| --- | --- |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | Credentials of your Spotify developer app. Both are needed for Spotify to be offered in the mixer. See [Setting up Spotify](music-and-spotify.md#setting-up-spotify). |

### Feedback form

| Variable | Description |
| --- | --- |
| `TURNSTILE_SITE_KEY` | The site key of your Cloudflare Turnstile widget, shown on the feedback form. Defaults to the original Clockmaker deployment's widget, which only works on that deployment's domain, so self-hosters should set their own. |
| `TURNSTILE_SECRET_KEY` | The secret key of the same Turnstile widget. **Required** for the feedback form to accept submissions. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Optional. A Gmail account and app password to send feedback emails from. |
| `FEEDBACK_TO_EMAILS` | Optional. Where to email feedback; several addresses separated by `;`. |

See [The feedback form](player-pages.md#the-feedback-form).

## The data directory

There's no database: everything lives in files under `RESOURCE_DATA_DIR`, grouped into one folder per kind of
thing. Most is JSON; uploads keep their original format. You shouldn't need to edit these by hand — everything is
managed in the app — but it's useful to know what's where.

| Folder | Contents |
| --- | --- |
| `singletons/` | One-of-a-kind settings: the password (`auth.json`), timer options, grim messages, the mixer's shared levels, dim, time-of-day trims, music crossfade/levelling, music and Spotify presets, the linked Spotify account, rules slide order, sound file details… |
| `appconfig/` | Other app-wide settings, such as the QR code list. |
| `clock-config/` | Each game: name, bell preset, clock state and mixer levels. |
| `grimoire-state-v2/` | Each game's grimoire. |
| `draw-sessions/` | Token draws in progress. |
| `characters/`, `charactertokenimage/` | The character library and token images. |
| `scripts/`, `presets/` | Scripts and setup presets (with win records). |
| `clocksfx-presets/` | Clock bell presets and their sound files. |
| `ambience/`, `sting/` | Ambience and sting sound files. |
| `music-tracks/`, `music-albums/`, `music-playlists/` | The music library. Music files and album art are stored alongside. |
| `rules-slide/` | Rules slideshow images. |

Feedback submissions are stored separately, in `FEEDBACK_DATA_DIR`.

Clockmaker reads its data when it starts, so stop it before changing or restoring files, and start it again after.

## What's stored in each browser

Some settings are deliberately per device, kept in the browser's local storage:

- the town square's display options (display mode, size, clock names, QR codes, now playing, audio engine);
- mixer mutes;
- whether the grimoire's tokens are locked, and a backup copy of the grimoire while it's open;
- highlighted characters in the script viewer;
- the sign-in session (a cookie, valid for a year).

Clearing the browser's site data resets these, and signs the device out.

## Backups

Back up the whole data directory (and the feedback directory, if you keep feedback). See
[Backing up and restoring](installation-docker.md#backing-up-and-restoring) for Docker commands.
