# The audio mixer

[← Audio overview](audio-overview.md) · [Documentation home](README.md) · Next: [Music & Spotify →](music-and-spotify.md)

The mixer controls every sound in the room. Its levels are shared: move a fader on one device and it moves on all of
them.

- [Opening the mixer](#opening-the-mixer)
- [Speakers (stereo or 4.0)](#speakers-stereo-or-40)
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

## Speakers (stereo or 4.0)

On a device that plays sound, the top of the mixer shows **Output: N channels** — how many channels the device's
audio output has, as the browser sees it — and a choice of speakers. Like the mutes, this is **local to the device**:
it describes the speakers plugged into it.

- **Stereo** — the usual two speakers.
- **4.0** — four speakers: front left, front right, rear left and rear right. Music, stings and bells play from the
  front pair; the [ambience](#ambience) can play from the rear pair too. 4.0 can only be chosen if the device's audio
  output has at least four channels. If it's chosen but the output then has fewer (say, the speakers were unplugged),
  a note says so and the device plays in stereo.
- **Test speakers** — plays a short burst of noise from each speaker in turn, naming each as it plays, so you can check
  the wiring. It plays past every fader, mute and the dim. Tap **Stop test** to stop it early.

On Linux:

- **Use Firefox** on the device that plays the 4.0 sound. Chrome and Chromium on Linux only ever offer a web page two
  channels, whatever the output, so the mixer there shows **Output: 2 channels**.
- The browser's default sound output has to be set up as 4.0 (front left, front right, rear left, rear right). An audio
  interface whose channels have no speaker positions (such as a Focusrite Scarlett on its "Direct" profile, with
  channels `AUX0`, `AUX1`…) needs a 4.0 output made for it in PipeWire, passing on to its first four channels. Save
  this as `~/.config/pipewire/pipewire.conf.d/clockmaker-quad.conf`, with your interface's output name from
  `wpctl inspect` in `target.object`:

  ```
  context.modules = [
      {   name = libpipewire-module-loopback
          args = {
              node.description = "Clockmaker 4.0"
              capture.props = {
                  node.name      = "clockmaker_quad"
                  media.class    = "Audio/Sink"
                  audio.position = [ FL FR RL RR ]
              }
              playback.props = {
                  node.name         = "clockmaker_quad.playback"
                  audio.position    = [ AUX0 AUX1 AUX2 AUX3 ]
                  target.object     = "<your interface's output name>"
                  stream.dont-remix = true
                  node.passive      = true
              }
          }
      }
  ]
  ```

  Then restart PipeWire (`systemctl --user restart pipewire pipewire-pulse wireplumber`), make **Clockmaker 4.0** the
  default output in Settings → Sound, and restart the browser.

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
  - **F** and **R** switches choose which speakers it plays from in [4.0](#speakers-stereo-or-40): the front, the rear,
    or both. With both, the rear plays the same sound half its length apart from the front, so the room is filled
    without the two sounding alike — best for even sounds like rain or wind. A sound with moments that stand out
    (a crow, a bell) is heard twice as often that way, so set it to just one of them. One is always on. A device in
    stereo plays the track at the front if either is on, so these switches are dimmed there.
  - Its own pan and gain.
- **+ Ambience Track** adds another track (up to 16). New installs start with four.
- **BUS** — the level and pan of all the ambience together, and its **F/R** balance in 4.0: in the middle (**F=R**)
  the front and rear are both at full level, and moving it one way turns the other pair down. Devices in stereo
  ignore it.

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
