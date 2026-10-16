# Clockmaker Documentation

Welcome to the Clockmaker user guide. Clockmaker is a self-hosted web app for running in-person games of
*Blood on the Clocktower*: a big-screen day/night clock for the town square, a phone remote for the storyteller,
an optional virtual grimoire, and a shared audio system (bells, ambience, stings and music) that stays in sync
across every device in the room.

The guides are written to be read roughly in order — start simple, add more as you need it — but each page
stands on its own, so jump to whatever you need.

## Getting started

1. [Installing with Docker & Docker Compose](installation-docker.md) — get the server running and keep your data safe.
2. [First run](first-run.md) — setting the password, the home screen, and how games and devices fit together.
3. [Basic setup: a clock in the town square](basic-setup.md) — the simplest useful setup: one screen, one phone, no grimoire.

## Running games

- [The town square display](town-square.md) — display modes, the side menu and every per-device display option.
- [The clock remote and the day cycle](clock-remote.md) — timer options, day/dusk/night, bells and what each button does.
- [Setting up a virtual grimoire](grimoire-setup.md) — scripts, presets, and the setup wizard (including the pass-the-phone token draw).
- [Using the grimoire](grimoire.md) — the board, tokens, reminders, night order, communications, annotation and ending a game.
- [Player-facing pages](player-pages.md) — the public script viewer, the rules slideshow and the feedback form.

## Audio

- [Audio overview](audio-overview.md) — how sound works across devices, and a recommended setup.
- [The audio mixer](audio-mixer.md) — every strip, fader and knob on the mixer.
- [Music & Spotify](music-and-spotify.md) — the uploaded-music player, Spotify, presets, and adaptive playlists.

## Lighting

- [Lightscapes: Zigbee lighting](lightscapes.md) — lights that follow the game's phases and the town square's sky, bell flashes, and Zigbee buttons as a remote.

## Settings reference

The **Settings** area holds everything shared between games. See the [settings overview](settings/README.md), or go
straight to a page:

| Page | What it controls |
| --- | --- |
| [Characters](settings/characters.md) | The character library, token images, reminder tokens and the wiki scraper |
| [Scripts](settings/scripts.md) | Scripts, their character lists and night order, import/export, and setup presets |
| [Timer Options](settings/timer-options.md) | The countdown buttons offered on the clock remote |
| [Message Texts](settings/message-texts.md) | The text offered by the grimoire's communications builder |
| [QR Codes](settings/qr-codes.md) | QR codes shown on the town square |
| [Audio](settings/audio.md) | Dim strength, loudness levelling, crossfade, clock bell sounds, ambience and sting libraries |
| [Music](settings/music.md) | The music library, playlists, music presets and Spotify presets |
| [Rules Slides](settings/rules-slides.md) | The images in the rules slideshow |
| [Feedback](settings/feedback.md) | Reading feedback sent through the feedback form |
| [Password](settings/password.md) | Resetting the site password |
| [API Token](settings/api-token.md) | The token other programs, like Lightscapes, use the API with |

## Reference

- [Configuration & data reference](configuration.md) — environment variables, where data lives, backups.
- [Troubleshooting & FAQ](troubleshooting.md)
