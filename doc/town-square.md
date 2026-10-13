# The town square display

[← Basic setup](basic-setup.md) · [Documentation home](README.md) · Next: [The clock remote →](clock-remote.md)

The town square is the screen the players look at: the clock, the day, the player count and, in the 3D view, the
players themselves. Open it from **Play → Town Square** on a game's card.

- [Display modes](#display-modes)
- [Messages shown on screen](#messages-shown-on-screen)
- [The ☰ menu](#the--menu)
- [Showing several games at once](#showing-several-games-at-once)
- [Tips for the big screen](#tips-for-the-big-screen)

## Display modes

Pick one from **Display Mode** in the ☰ menu. The choice is remembered per device.

### Clocktower (3D) — default

A rendered clocktower whose sky, sun, moon, mist and lanterns follow the game's phase, with the clock hands sweeping
as the countdown runs. Beside the tower a panel shows:

- a banner with the **day number**;
- a banner with the **player count** and how many townsfolk, outsiders, minions and demons that player count calls for;
- if the game has a [virtual grimoire](grimoire-setup.md): every seated **player's name**, whether they're
  **dead**, and whether a dead player still has their **ghost vote**. Characters stay secret, except
  **travellers**, which are public and so shown on their seat;
- any **loric and fabled** in play, each with its full rules text;
- the [QR codes](settings/qr-codes.md) you've chosen to show, drawn into the scene.

The 3D view needs a reasonably capable device. If it's slow or stutters, use one of the other modes.

### Clocktower

A lighter, flat illustrated clocktower with a sky that follows the phase, a clock face with the countdown, and the
day number and player-count breakdown. A good choice for older TVs and tablets.

### Original

The original simple clock face with a day dial — the lightest option. Good for small screens or when you want just the
countdown.

In every mode the screen follows the game's **phase** (set from the remote), not just the timer: dusk is drawn like
night, and pressing Night turns the sky to night straight away.

## Messages shown on screen

The town square shows a message for 10 seconds when:

| Event | Message |
| --- | --- |
| The reminder bell rings | *The end of the day is approaching…* |
| The timer runs out | *The day has ended! Please return to the Town Square.* |
| The bell is rung by hand during the day | *Your Story Teller requires your attention!* |
| The bell is rung by hand at dusk or night | *The day has ended! Please return to the Town Square.* |

## The ☰ menu

The menu button sits in the top-left corner. Everything in it except the first three buttons is a **per-device**
setting, remembered by this browser.

| Option | What it does |
| --- | --- |
| **Home** | Back to the home screen. |
| **Open Clock Remote** | Opens the [clock remote](clock-remote.md) for this game on this device. |
| **Audio Mixer** / **Mixer Remote** | Opens the [audio mixer](audio-mixer.md) over the page. Labelled "Mixer Remote" when this device's audio engine is off. |
| **Audio Engine** | Whether this device plays sound (bells, ambience, stings, music). Turn it off on every screen but one in the same room. When off, nothing is loaded or played here and the mixer only acts as a remote. See [which devices make sound](audio-overview.md#which-devices-make-sound). |
| **Display Mode** | Original, Clocktower or Clocktower (3D) — see above. |
| **Display Size** → **Auto** | Sizes the clock to fit the window (and re-fits when the window changes size). Untick it to set the size yourself with the slider (400–1400); **Reset** returns it to the automatic size. Mostly affects the Original and Clocktower modes (and the size of the game name in all modes). |
| **Show Clock Names** | Shows the game's name on the display. |
| **Now Playing** | Shows the music track playing (title, artist and album art, from Spotify or the uploaded-music player): **Off**, **Popup** (pops up for a few seconds whenever a new track starts) or **On** (shown for as long as it plays). |
| **Position** | Where the now-playing banner appears: top, top right, bottom, bottom left or bottom right. |
| **Show Custom QR** | Shows the QR codes set up in [Settings → QR Codes](settings/qr-codes.md). |
| **Script QR** | Shows a QR code linking to the [public script viewer](player-pages.md#the-script-viewer) for the game's script, so players can read the characters on their own phones. Choose a corner or edge, or Off. It appears once the game has a grimoire with a script, and follows the grimoire being set up or ended. |
| **QR Size** → **Auto** | Default QR size. Untick it to scale QR codes from 50% to 200%. |
| **Share QR Code** | Shows a big QR code for the page you're on — the quickest way to get another device onto it. Tap anywhere to close. |

## Showing several games at once

For events with several tables, **Play → Tools → View All (Splitscreen)** shows every game side by side on one
screen, each in its own panel. When one game's bell or reminder rings, the other panels dim briefly so it's clear
which table it's for.

The split screen always plays sound (it has no Audio Engine switch) — mute or close it on other devices if needed.

## Tips for the big screen

- Use the browser's full-screen mode (`F11`), or install Clockmaker as an app from the browser menu.
- Click or tap the page once after opening it, so the browser allows it to play sound.
- Turn off screen savers and sleep on the display device.
- If the 3D view is choppy, switch to **Clocktower** or **Original**.
- The town square needs a signed-in device. Players' own phones should use the
  [script QR](player-pages.md#the-script-viewer) instead, which needs no password.
