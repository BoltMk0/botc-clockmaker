# Troubleshooting & FAQ

[← Documentation home](README.md)

- [Installation and access](#installation-and-access)
- [Sound](#sound)
- [Music and Spotify](#music-and-spotify)
- [Grimoire and scripts](#grimoire-and-scripts)
- [Display](#display)

## Installation and access

**My games and settings disappeared after updating.**
The container was storing data inside itself. Mount a volume at `/data` (and, with images up to 0.3.11, set
`RESOURCE_DATA_DIR=/data`) — see
[Installing with Docker](installation-docker.md#recommended-docker-compose-with-a-data-volume). Data written before
that change can't be recovered from a removed container.

**Other devices can't open the app.**
Use the host's network address (e.g. `http://192.168.0.64:3000`), not `localhost`. Check the container is running
(`docker compose ps`), the port is published, the host firewall allows it, and the devices are on the same network.

**I've forgotten the password.**
See [Settings → Password → Forgotten the password?](settings/password.md#forgotten-the-password)

**Players can't open the town square on their phones.**
The town square needs the password. Give players the [script viewer](player-pages.md#the-script-viewer) (via the
town square's Script QR) instead — it doesn't.

## Sound

**There's no bell when the timer runs out.**
- A fresh install has no bell sounds. Create a [Clock SFX preset](settings/audio.md#clock-sfx) with an End of Day
  sound, and pick it in the game's **Clock SFX** dropdown on **Play**.
- Click or tap the town square page once after opening it — browsers block sound until you interact with a page.
- Check the town square's ☰ menu has **Audio Engine** ticked on the device that should play.
- In the [mixer](audio-mixer.md#sfx), check the game's strip, the SFX MASTER and the STING aren't turned down or
  muted on that device, and that DIM isn't on.

**The bell rings twice / echoes.**
More than one device in the room is playing sound. Turn **Audio Engine** off in the town square ☰ menu on all but
one. See [Which devices make sound](audio-overview.md#which-devices-make-sound).

**The bell rang although I'd already ended the day.**
Pressing Dusk doesn't stop the countdown. To end the day early, press ⏸ first, then Dusk. See
[The clock remote](clock-remote.md#common-tasks).

**The ambience doesn't play.**
Tap **Ambience Engine** in the mixer to start it, check each track has a sound loaded and is switched on for the
current phase (Morning / Day / Dusk / Night), and check the BUS and MASTER levels.

**A strip is silent on one device only.**
Mutes are per device: tap the strip's **Gain** label to unmute it there.

## Music and Spotify

**The mixer says "Player not running" and has no + Music button.**
This mixer is a remote (opened from the clock remote or grimoire, or a town square with its audio engine off). Start
the player from a device that plays sound — the town square with its audio engine on, or **Play → Tools → Audio
Only (Mixer)**.

**The music stopped when I closed a page.**
The music plays from the device that started it. Keep that page open and the device awake, or start the player on a
device that stays on. See [Which device plays the music](music-and-spotify.md#which-device-plays-the-music).

**There's no Spotify option in the mixer.**
The server needs `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` — see [Setting up Spotify](music-and-spotify.md#setting-up-spotify).

**Spotify sign-in fails with a redirect URI error.**
The Redirect URI in your Spotify app must exactly match the address you opened Clockmaker with, plus
`/api/spotify/callback` — including `http`/`https`, host name and port. Spotify only accepts `https://` addresses,
or loopback ones like `http://127.0.0.1:3000`. Behind a reverse proxy, set `ORIGIN`.

**Spotify won't play.**
Spotify's in-browser player needs a Premium account and a secure (HTTPS) page. Also check the account is added
under User Management if your Spotify app is in development mode.

**Tracks play at very different volumes.**
Turn on [loudness levelling](settings/audio.md#loudness-levelling) (uploaded music only). Newly uploaded tracks are
levelled once they've been measured.

**A preset I tapped didn't start.**
While other music is playing, tapping a preset **schedules** it for the next phase change. Tap it again to switch
straight away. An adaptive preset is silent through any phase with no playlist — with only day and night ones,
that's the morning until the countdown starts, and dusk.

## Grimoire and scripts

**There are no scripts to choose in the grimoire setup.**
Run the [character scraper](settings/characters.md#the-wiki-scraper), then the
[script scraper](settings/scripts.md#the-wiki-scraper), or [import a script](settings/scripts.md#importing-a-script).

**The scraper fails.**
The server needs internet access to reach the Blood on the Clocktower wiki. Check the server's connection and try
again; individual failures are listed per character.

**Importing a script fails.**
The file must be a script JSON in the official format. Characters are matched by name; homebrew characters must be
described in full in the file (or created first in Settings → Characters). The error lists what couldn't be
matched.

**The night order numbers are wrong.**
They come from the script's night order: fix them in
[Settings → Scripts → Edit Characters](settings/scripts.md#editing-a-scripts-characters-and-night-order). Night 1 uses
the first night order while the day counter is 0.

**A token won't move.**
Tokens are locked — press the lock in the grimoire's sidebar, or open the token tray, to unlock them.

**"Draw tokens" is greyed out.**
The bag must hold exactly one token per player. Move surplus tokens to "On the grim".

## Display

**The 3D clocktower is slow.**
Switch the town square's **Display Mode** to **Clocktower** or **Original** in the ☰ menu (per device).

**The clock is too big or too small.**
Untick **Display Size → Auto** in the ☰ menu and use the slider.

**The town square doesn't show player names.**
Names come from the virtual grimoire and are shown in the **Clocktower (3D)** display mode. The game needs a grimoire
with named players.
