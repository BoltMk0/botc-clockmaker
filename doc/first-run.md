# First run

[← Installing with Docker](installation-docker.md) · [Documentation home](README.md) · Next: [Basic setup →](basic-setup.md)

- [Setting the password](#setting-the-password)
- [The home screen](#the-home-screen)
- [Key ideas](#key-ideas)
- [What a fresh install has (and doesn't)](#what-a-fresh-install-has-and-doesnt)
- [Where to go next](#where-to-go-next)

## Setting the password

The first time anyone opens Clockmaker, it asks them to **set a password** (at least 4 characters, typed twice).
This protects the whole site: after that, every device has to sign in once with the same password.

- There is one shared password, not user accounts. Give it to anyone who should be able to run games.
- A signed-in device stays signed in for a year.
- Some pages never need the password, so players can use them on their own phones:
  the [public script viewer](player-pages.md#the-script-viewer), the [feedback form](player-pages.md#the-feedback-form)
  and the sign-in page itself. Everything else — including the town square — needs a signed-in device.
- Forgot it, or need to sign everyone out? See [Settings → Password](settings/password.md).

> Set the password straight after installing: until one is set, whoever opens the site first gets to choose it.

## The home screen

The home screen shows a clock that follows the real time of day over a matching sky, the app version, and up to
three buttons:

| Button | What it opens |
| --- | --- |
| **Play** | Your games: create, rename and delete them, and open each game's town square, remote and grimoire. |
| **Rules** | The rules slideshow. Only shown once you've uploaded some [rules slides](settings/rules-slides.md). |
| **Settings** | Everything shared between games: characters, scripts, timers, audio, music and more. |

## Key ideas

**A game** is one clock: its timer, day number, player count and phase (morning, day, dusk or night). It may also
have a virtual grimoire. You can run several games at once — useful for events with more than one table — and each
has its own town square and remote.

**Every device is a live view.** The town square screen, the storyteller's phone and anything else showing a game
are all connected to the server and update the moment anything changes. Start the timer from a phone and the TV
counts down; set the phase to night and every screen for that game turns to night.

**Two kinds of settings:**

- *Shared settings* live on the server and apply to every device: everything under **Settings**, each game's name and
  bell sounds, and the mixer's shared levels.
- *Per-device settings* are remembered by each browser separately: the town square's display mode, size, QR code
  options, now-playing banner and whether that device plays audio. So the TV can show the 3D clocktower while a
  tablet uses the simpler display.

**Phases.** Each game is always in one of four phases:

- **Morning** — daytime with the countdown set up but not running (not started yet, or paused).
- **Day** — discussion time; the countdown runs.
- **Dusk** — the day is over (the timer ran out or the storyteller ended it) but night hasn't been called yet;
  typically nominations and executions.
- **Night** — the storyteller is waking characters.

Where several games share one set of speakers, the room's audio follows the *earliest* phase among them: it's day
if any game is in its day, and only night once every game is.

## What a fresh install has (and doesn't)

A brand-new install is deliberately empty. Before your first game, you may want to add:

| You want… | You need | Where |
| --- | --- | --- |
| Bell sounds when the timer ends | A clock SFX preset with sounds uploaded | [Settings → Audio](settings/audio.md#clock-sfx) |
| A virtual grimoire | Characters and at least one script | [Settings → Characters](settings/characters.md) and [Scripts](settings/scripts.md) |
| Ambience, stings or music | Uploaded audio files | [Settings → Audio](settings/audio.md), [Settings → Music](settings/music.md) |
| A rules slideshow | Uploaded images | [Settings → Rules Slides](settings/rules-slides.md) |

Timer options come with sensible defaults (1, 3, 5, 8 and 10 minutes, plus a 5-second example), so the clock works
straight away.

## Where to go next

- Just want a clock on the wall? → [Basic setup: a clock in the town square](basic-setup.md)
- Want to run the grimoire from a tablet? → [Setting up a virtual grimoire](grimoire-setup.md)
- Want atmosphere? → [Audio overview](audio-overview.md)
