# Audio overview

[← Player-facing pages](player-pages.md) · [Documentation home](README.md) · Next: [The audio mixer →](audio-mixer.md)

Clockmaker can do much more than ring a bell. This page explains how sound works across your devices, then walks
through building up a full setup step by step.

- [The sound sources](#the-sound-sources)
- [Which devices make sound](#which-devices-make-sound)
- [Shared vs per-device controls](#shared-vs-per-device-controls)
- [The phase drives the audio](#the-phase-drives-the-audio)
- [Building up a setup, step by step](#building-up-a-setup-step-by-step)
- [Recommended room setups](#recommended-room-setups)

## The sound sources

| Source | What it is | Set up in |
| --- | --- | --- |
| **Clock bells** | Each game's start of day, reminder and end of day sounds. | [Settings → Audio → Clock SFX](settings/audio.md#clock-sfx) |
| **Ambience** | Looping background tracks (rain, crickets, tavern chatter…), each switched on or off for morning, day, dusk and night. | Files: [Settings → Audio → Ambience Assets](settings/audio.md#ambience-assets). Tracks: the [mixer](audio-mixer.md#ambience) |
| **Stings** | Short dramatic sounds; each press of the sting button plays a random one. | [Settings → Audio → Audio Stings](settings/audio.md#audio-stings) |
| **Music player** | Your own uploaded music, played from playlists and presets. | [Settings → Music](settings/music.md) |
| **Spotify** | A Spotify account played through the browser. | [Music & Spotify](music-and-spotify.md#spotify) |

## Which devices make sound

This is the most important thing to understand about Clockmaker's audio.

**Bells, ambience and stings play on *every* device that has an audio engine running.** That's:

- every **town square** page with **Audio Engine** ticked in its ☰ menu (the default);
- the **View All (Splitscreen)** page;
- the **Audio Only (Mixer)** page (**Play → Tools**), unless opened as a remote.

They're kept in sync, so two devices in *different* rooms both hear the bell. But two devices in the *same* room
will double up. **In each room, leave the audio engine on for exactly one device** and turn it off on the others.

**The music player and Spotify play on exactly one device** — the one that started them (the *host*). Every other
mixer shows "Playing from another device" and acts as a remote control for it. To move the music to another
device, press **Stop player** on the strip's menu and start it again from the other device.

**These never make sound** and are always remote controls: the clock remote, the grimoire, the mixer opened from
the remote or the grimoire, and the town square with its audio engine off ("Mixer Remote").

> Browsers only allow a page to play sound after you've interacted with it. After opening a page that plays audio,
> click or tap it once.

## Shared vs per-device controls

| Shared by every device | Local to each device |
| --- | --- |
| Every fader, pan and knob on the mixer | **Mute** (tap a strip's "Gain" label) |
| The ambience engine playing or stopped, and its tracks | The **Audio Engine** switch on the town square |
| The time-of-day trims | |
| **DIM**, and its strength | |
| Which music preset is playing, play/pause, skip | |
| Music crossfade and loudness levelling settings | |

So the storyteller can ride the levels from their phone while the sound comes out of the TV, and someone using a
tablet as a second display can mute it without affecting anyone else.

## The phase drives the audio

The game's phase (morning, day, dusk or night) changes the audio automatically:

- **Ambience tracks** each have Morning / Day / Dusk / Night switches, and fade in or out (over 3 seconds) as the
  phase changes.
- **Time-of-day trims** raise or lower the whole Music & Ambience level per phase — e.g. quieter during day
  discussions, louder at night.
- **Adaptive music presets** play a different playlist for each phase, or stay silent through a phase with none.
  See [Music & Spotify](music-and-spotify.md#preset-types).
- The **start of day** bell rings going from night to morning or day.

When several games share the audio (the mixer page, the split screen and the music players follow every game), it's
daytime if any game is (**day** if any game's countdown is running, otherwise **morning**), and only **night** once
every game is.

## Building up a setup, step by step

1. **Bells.** Create a clock SFX preset and upload an End of Day sound, then pick the preset on each game's card on
   **Play**. → [Settings → Audio](settings/audio.md#clock-sfx)
2. **Ambience.** Upload a few looping sounds under **Ambience Assets**. On the town square, open ☰ → **Audio
   Mixer**, load a sound into each ambience track (tap the track's name), set its Morning / Day / Dusk / Night
   switches, and tap **Ambience Engine** to start it. → [The audio mixer](audio-mixer.md#ambience)
3. **Stings.** Upload some under **Audio Stings**. Trigger them from the mixer's STING strip or the grimoire's audio
   menu.
4. **Music.** Upload tracks in **Settings → Music**, make playlists, and create music presets. In the mixer, press
   **+ Music** to start the player on this device and pick a preset. → [Music & Spotify](music-and-spotify.md)
5. **Balance the levels** with the mixer's faders and the per-phase trims, and set the dim strength.
6. **Control it from your phone**: the clock remote's now playing bar (skip), and its music view (presets, volume, DIM and the mixer).

## Recommended room setups

**One screen, one phone (most common).** The town square on the TV plays everything (audio engine on). The
storyteller's phone uses the clock remote or the grimoire, which never make sound. Open the mixer from the phone to
adjust levels.

**Separate speaker.** Put **Audio Only (Mixer)** on the device connected to the good speakers (a laptop, mini-PC or
old phone). Turn **Audio Engine** off on the town square screen. Start the music player from the mixer device.

**Several tables in one room.** Use one audio device for the whole room — either **View All (Splitscreen)** on one
screen, or the **Audio Only (Mixer)** page — and turn the audio engine off on each table's own town square. Each
game's bells have their own strip in the mixer, so you can pan different tables' bells left and right.
