# Music & Spotify

[← The audio mixer](audio-mixer.md) · [Documentation home](README.md) · Next: [Settings overview →](settings/README.md)

Clockmaker has two music sources: a built-in **music player** for files you upload, and **Spotify**. They can both
be set up side by side, but only one plays at a time.

- [The music player (uploaded music)](#the-music-player-uploaded-music)
- [Spotify](#spotify)
- [Preset types](#preset-types)
- [Picking presets in the mixer](#picking-presets-in-the-mixer)
- [Controlling music during a game](#controlling-music-during-a-game)
- [Which device plays the music](#which-device-plays-the-music)

## The music player (uploaded music)

Plays your own music files through the mixer, so it gets the mixer's fader, dim, time-of-day trims and level meter.

1. **Upload** tracks in [Settings → Music → Library](settings/music.md#library). Titles, artists, albums and cover
   art are read from the files' tags.
2. **Make playlists** on the Playlists tab.
3. **Make presets** on the Music Presets tab — this is what the mixer shows. See [preset types](#preset-types).
4. Optionally turn on **loudness levelling** and **crossfade** in [Settings → Audio](settings/audio.md#audio-options).
5. In the mixer, press **+ Music** to start the player on this device, then tap a preset.

Presets always play **shuffled**, and remember their place: coming back to a playlist carries on with tracks it
hasn't played yet, rather than repeating ones it has, until it has played them all.

## Spotify

Plays a Spotify account through the browser, using Spotify's Web Playback SDK. Things to know first:

- It needs a **Spotify Premium** account.
- The server needs **Spotify developer credentials** (a free Spotify developer app).
- Spotify only accepts secure sign-in addresses: an `https://` address, or a loopback address such as
  `http://127.0.0.1:3000`. For use around the house this usually means putting Clockmaker
  [behind HTTPS](installation-docker.md#https-and-reverse-proxies).

### Setting up Spotify

1. Go to the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and **create an app**.
   - **Redirect URI**: your Clockmaker address followed by `/api/spotify/callback`, for example
     `https://clock.example.com/api/spotify/callback`. It must match exactly the address you open Clockmaker with.
   - Tick the **Web API** and **Web Playback SDK**.
   - While the app is in development mode, add the Spotify account(s) you'll use under the app's **User Management**.
2. Copy the app's **Client ID** and **Client secret** into your `.env`:
   ```dotenv
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```
   and restart Clockmaker (see [Secrets and optional features](installation-docker.md#secrets-and-optional-features-env)).
   If you're behind a reverse proxy, make sure `ORIGIN` is set so the callback address is right.
3. Open the mixer on the device that should play the music and press **+ Link Spotify**. Sign in to Spotify and
   accept. You're returned to the mixer.
4. Press **+ Spotify** to start the Spotify player on this device. (Linking only needs doing once; starting the
   player is per session.)
5. Add albums and playlists in [Settings → Music → Spotify](settings/music.md#spotify): in Spotify, use
   **Share → Copy link** and paste it in.

Clockmaker controls the Spotify volume itself, applying the mixer's Music & Ambience master, the dim and the
time-of-day trims, so Spotify fits in with everything else even though it doesn't play through the mixer.

## Preset types

Both players use the same three kinds of preset.

### Ambient Playlist

One playlist (or Spotify album/playlist), played continuously whatever the phase.

### Ambient Adaptive Playlist

A playlist **for each phase** — day, dusk and night. It plays the current phase's playlist, and when the games'
phase changes it fades out and moves to the new phase's playlist.

- Music player: leave a phase empty to **keep playing** whatever was on through it.
- Spotify: leave a phase empty to make it **silent** — the music fades out and pauses, and picks up again when a
  phase with a list comes round. A phase with the same list as the one playing carries straight on.

### Day & Night Playlist

A playlist for the **day** and one for the **night**, built around the countdown:

- the day playlist only plays **while a game's countdown is running**;
- the rest of the day — the morning before the timer starts, a pause, and dusk — is **silent**;
- it picks up by itself when the countdown starts or night falls.

Leave either empty to keep that time silent too. This is ideal for "music while people talk, silence for
nominations, night music while the storyteller works".

## Picking presets in the mixer

On the Music or Spotify strip, tap a preset:

- **Nothing playing** — it starts straight away.
- **Something already playing** — it's **scheduled** for the next phase change, so the music changes at a natural
  moment rather than cutting in. Tap it **again** to switch now.
- **The current preset** — pauses or resumes it.

The same rules apply between the two players: picking a preset on one while the other is playing schedules it, and
when it takes over the other fades out. A preset that's waiting through a silent spell (a day & night preset before
the countdown starts, say) shows as waiting.

## Controlling music during a game

You don't need the mixer open to control the music:

- **Clock remote** — **⏭** skips the track; **DIM** turns everything down while you talk.
- **Grimoire** → audio menu — dim, play/pause and skip for whichever player is running, plus the sting.
- **Town square** — the **Now Playing** banner (☰ menu) shows players what's on.

## Which device plays the music

Exactly one device — the one where **+ Music** or **+ Spotify** was pressed — plays the music (the *host*). Every
other mixer controls it remotely. The host reports in every few seconds; if it disappears (closed, asleep, lost
Wi-Fi) for about 15 seconds, another device can start the player instead.

To move the music to another device, open the strip's menu on the host, press **Stop player**, then start it from
the other device.

The music player plays through that device's mixer, so start it on the device connected to your speakers, and keep
that page open and the screen awake.
