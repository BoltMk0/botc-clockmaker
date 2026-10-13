# The audio mixer

[← Audio overview](audio-overview.md) · [Documentation home](README.md) · Next: [Music & Spotify →](music-and-spotify.md)

The mixer controls every sound in the room. Its levels are shared: move a fader on one device and it moves on all of
them.

- [Opening the mixer](#opening-the-mixer)
- [Common controls](#common-controls)
- [Music & Ambience](#music--ambience)
  - [Ambience](#ambience)
  - [Music players](#music-players)
  - [Master and time-of-day trims](#master-and-time-of-day-trims)
- [SFX](#sfx)

## Opening the mixer

| From | Plays sound here? |
| --- | --- |
| **Play → Tools → Audio Only (Mixer)** (`/admin/mixer`) | Yes — a dedicated audio device. |
| Town square ☰ → **Audio Mixer** | Yes, if the town square's Audio Engine is on. With it off the button reads **Mixer Remote**, and a note says no sound plays here. |
| The clock remote's mixer button, or the grimoire's audio menu → **Open mixer** | No — always a remote (`/admin/mixer?remote_only=1`). A **Back** button returns you. |

The mixer is wider than a phone screen; scroll sideways to see all of it.

## Common controls

Most strips have the same parts, from top to bottom:

- **Title** — the strip's name. On some strips tapping it does something (noted below).
- **Pan** — a horizontal slider from left to right.
- **Gain fader** — a vertical fader with a level meter (the meter only moves on a device that's playing sound).
  The label above it shows the level in dB.
- **Mute** — tap the **Gain** label to mute or unmute the strip. Mutes are **local to this device**, unlike
  everything else.

**Double-click or double-tap** any fader, slider or knob to reset it (0 dB for faders, centre for pan).

The mixer is split into two groups, each with its own master: **Music & Ambience** and **SFX**.

## Music & Ambience

### Ambience

The ambience engine plays looping background sounds. Its strips sit under an **Ambience Engine** heading:

- Tap **Ambience Engine** (the heading with the ▶/⏸ icon) to start or stop all ambience, for every device.
- Each **ambience track** strip:
  - Tap its **name** (or "(empty)") to pick a sound from your [ambience assets](settings/audio.md#ambience-assets),
    choose **None** to empty it, or **Remove ambience track**.
  - **Morning / Day / Dusk / Night** switches (two by two) choose which phases it plays in: the ones it plays in
    are lit blue, brighter for the current phase, which is also outlined. A track fades in and out over three
    seconds as the phase changes.
  - Its own pan and gain.
- **+ Ambience Track** adds another track (up to 16). New installs start with four.
- **BUS** — the level and pan of all the ambience together.

The ambience follows the phase of the games this mixer is for: all games on the mixer page and the split screen,
or just that game on a game's own town square.

### Music players

Next to the ambience are the music strips, for the [uploaded-music player and Spotify](music-and-spotify.md). Only
one of the two plays at a time.

When no player is running you'll see a dashed outline:

- **+ Music** — starts the uploaded-music player **on this device**.
- **+ Spotify** — starts the Spotify player on this device (once a Spotify account is linked).
- **+ Link Spotify** — links a Spotify account (only offered when the server has Spotify credentials).
- **Player not running** — this device can't start one (for example, it's a remote-only mixer).

A device that was running a player starts it again by itself when the page opens, and plays what it was playing (see
[which device plays the music](music-and-spotify.md#which-device-plays-the-music)).

Once a player is running, its strip shows:

- **Music** / **Spotify** title — tap for controls: previous, play/pause, next, and **Stop player** on the host
  device (or *"Playing from another device"* elsewhere).
- **Now playing** — the current track (scrolls if it's long).
- **Presets** — one button per preset. The icons show the phases each covers. See
  [picking presets](music-and-spotify.md#picking-presets-in-the-mixer).
- **⏮ ⏭** previous / next track.
- **Gain** (music player) or **Vol** (Spotify) fader.

### Master and time-of-day trims

The **MASTER** strip at the end of the group sets the overall Music & Ambience level (Spotify follows it too).
Above its fader are four small **trim knobs**, one each for **Morning**, **Day**, **Dusk** and **Night**:

- Each raises or lowers the whole group by up to ±12 dB during that phase. The current phase's knob is outlined.
- Drag up/down to change; double-click to reset to 0. A bubble at the top of the screen shows the value while you
  drag.
- Changes fade in smoothly when the phase changes.

Typical use: turn the morning and day down a few dB so music doesn't drown out discussion, and the night up.

## SFX

The second group holds the one-off sounds:

- **STING** — tap the title to fire a sting (a random sound from your [sting library](settings/audio.md#audio-stings))
  on every playing device. Its fader and pan set the sting level.
- **One strip per game** — the level and pan of that game's bells. Tap the game's name to **preview** its End of
  Day bell on this device only. Panning games apart is useful when several tables share a room.
- **MASTER** — the level and pan of all the SFX together.

The **DIM** button (in the clock remote's music view and in the grimoire) turns down *everything* — both groups and Spotify — by
the [dim strength](settings/audio.md#dim-strength).
