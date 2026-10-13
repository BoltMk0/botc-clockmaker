# Settings → Audio

[← Settings overview](README.md) · [Documentation home](../README.md)

Shared audio settings, the bell sounds for each game's clock, and the libraries of ambience and sting sounds. See
the [Audio overview](../audio-overview.md) for how these fit together.

Audio files can be WAV, MP3, AAC, M4A, FLAC or OGG.

- [Audio Options](#audio-options)
  - [Dim strength](#dim-strength)
  - [Loudness levelling](#loudness-levelling)
  - [Crossfade](#crossfade)
- [Clock SFX](#clock-sfx)
- [Ambience Assets](#ambience-assets)
- [Audio Stings](#audio-stings)
- [Managing sound files](#managing-sound-files)

## Audio Options

Changes here apply straight away, on every device.

### Dim strength

How far the **DIM** button (in the clock remote's music view and in the grimoire) turns the audio down: **3 to 18 dB**,
default **6 dB**. Dim affects everything — ambience, music, Spotify, stings and bells.

### Loudness levelling

For the **uploaded-music player** only (not Spotify). When on, each track is turned up or down so they all play at
about the same loudness, so a quiet folk track isn't followed by a blaring orchestral one.

- **Loudness Levelling** — on or off (off by default).
- **Target loudness** — the level to aim for, in LUFS, from **−40** to **−10** (default **−24**). Higher numbers are
  louder.

Each track's loudness is measured on the server (with `ffmpeg`) after it's uploaded. While tracks are still being
measured, the page shows how many are done; unmeasured tracks play as they are until then. A track's measured
loudness can be seen and changed in [Settings → Music](music.md#editing-a-track).

### Crossfade

Also for the uploaded-music player only. When on, each track overlaps with the next from the same playlist, as it
ends or is skipped.

- **Crossfade** — on or off (off by default).
- **Crossfade duration** — **1 to 30 seconds** (default **6**).

Moving to a *different* playlist (for example, night turning to day in an adaptive preset) still fades the old one
out first rather than overlapping.

## Clock SFX

The sounds a game's clock plays. Each **Clock SFX preset** is a set of up to three sounds:

| Sound | When it plays |
| --- | --- |
| **Start of Day** | A game goes from night to day. |
| **Reminder Bell** | The reminder time is reached during a countdown (see [Timer Options](timer-options.md)). |
| **End of Day** | A game's timer runs out, or the bell is rung by hand. |

The table lists each preset with a ✓ for each sound it has. **+ Clock SFX Preset** makes a new one; the pencil
edits one.

Each game chooses its preset in the **Clock SFX** dropdown on its card on **Play**. New games use the **first**
preset in the list. Several games can share a preset; changing a preset's sounds updates every game using it.

### Editing a preset

- **Preset Name**.
- For each sound: choose a file to upload, play it back, or **Remove** it. A sound left empty is silent.
- **Balance** (−1 to 1) — trades the reminder bell (left) against the start and end of day sounds (right), to even
  out a reminder that's louder or quieter than the others.
- **Gain** (−18 to 0 dB) — the overall level of this preset, to tame a loud set of files once rather than in every
  game.
- **Pan** (−1 to 1) — left/right position.

Balance, gain and pan apply on top of each game's own strip in the [mixer](../audio-mixer.md#sfx).

Press **Save** (then **OK**), or **Delete** to remove the preset.

## Ambience Assets

The library of looping sounds the mixer's [ambience tracks](../audio-mixer.md#ambience) can play — rain, wind,
crickets, a crackling fire, distant bells. **+ Ambience Asset** uploads one or more files.

Ambience loops seamlessly, so choose files that loop cleanly (start and end at the same point in the sound).

## Audio Stings

The library of short sounds the **sting** button plays — a thunderclap, a scream, a gong. Each press plays one at
random (and the next one is already loaded, so it fires instantly). **+ Sting Asset** uploads one or more files.

Fire stings from the mixer's **STING** strip, or the grimoire's audio menu.

## Managing sound files

In both libraries:

- **Click a row** (or its ▶ button) to play or pause it here, to preview it. Ambience previews loop.
- **Bin** — delete it. Deleting an ambience asset empties any ambience track playing it; deleting a sting re-arms
  the sting button with another one.
- Each row shows the file's type and size.

Naming them differs:

- **Ambience assets** have a **Track details** button: set a **Title** (shown on the mixer), **Artist**, **Link**
  and **License** — useful for crediting sounds you've downloaded (e.g. from Freesound under Creative Commons). A file
  with no title shows its filename.
- **Stings** have a **pencil** to rename them.
