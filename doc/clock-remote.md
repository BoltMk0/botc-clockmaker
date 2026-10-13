# The clock remote and the day cycle

[← The town square display](town-square.md) · [Documentation home](README.md) · Next: [Setting up a virtual grimoire →](grimoire-setup.md)

The clock remote is the storyteller's control panel for one game. It appears in two places:

- **On its own** — from the remote button on a game's card on **Play**, or **Open Clock Remote** in the town
  square's ☰ menu. Ideal for a phone in your pocket.
- **Inside the grimoire** — tap the centre of the clock in the middle of the [grimoire board](grimoire.md#the-clock).

Both are the same controls, and every change shows up on every screen for that game at once.

- [The controls](#the-controls)
- [How the day cycle works](#how-the-day-cycle-works)
- [The bells](#the-bells)
- [Common tasks](#common-tasks)

## The controls

From top to bottom:

### Time remaining and play/pause

The countdown, with one button beside it:

- **▶ Start** — starts the countdown. Greyed out once the timer has run out (pick a timer option to set up a new day).
- **⏸ Pause** — shown while counting down. It stops the clock **and resets it to its full time**, and the game goes
  back to **Morning**; pressing ▶ again starts the countdown from the top.

### Day / Dusk / Night

Set the game's phase. The highlighted button is the current phase. Phases change the town square's sky, the night
order in the grimoire, and the [time-of-day audio](audio-overview.md#the-phase-drives-the-audio).

- **Day** sets the timer up again as it was last set up (the last timer option picked) and waits for ▶ — a new day,
  if the last one had ended. Until the countdown starts it reads **Morning**. It's disabled while the countdown runs.
- **Dusk** and **Night** set that phase straight away.

There's no Morning button: the game is in the morning whenever the timer is set up but not running, and in the day
while it runs.

### Day and Players

- **Day − / +** — corrects the day number. (It normally moves on by itself; see below.)
- **Players − / +** — the number of players. The town square shows the matching character breakdown. When a game
  is set up with the grimoire's token draw, this is set for you.

### Timer options

One button per timer option from [Settings → Timer Options](settings/timer-options.md). Each shows its duration
(⏱), its reminder bell time (🔔, or a crossed-out bell for none) and its label. The option currently loaded is
highlighted. They're disabled while the countdown is running.

Pressing one **sets up a day** — see [How the day cycle works](#how-the-day-cycle-works).

### Bottom row

| Button | What it does |
| --- | --- |
| **Mixer** (three sliders) | Opens the [audio mixer](audio-mixer.md) as a remote control — it plays no sound on this device — with a back button to where you came from. |
| **DIM** | Turns all the room's audio down by the dim amount (6 dB by default), and back up again. Shared: every device follows it. Shows the current reduction, e.g. "-6 dB". Set the amount in [Settings → Audio](settings/audio.md#dim-strength). |
| **⏭ Skip** | Skips to the next music track, on whichever player is running (the uploaded-music player or Spotify). Disabled when neither is running. |
| **🔔 Ring bell** | Rings the game's **End of Day** bell by hand on every device playing sound, and shows a message on the town square. |

## How the day cycle works

Clockmaker tracks a **day number** and a **phase** (morning, day, dusk or night) for each game.

1. **Picking a timer option** (or pressing **Day**, which repeats the last one) sets up a day:
   - If the game is at **dusk or night** (or still on day 0), the day number goes up by one. If it's already
     daytime, the day number stays the same — so you can swap to a different timer mid-morning without skipping a
     day.
   - Any running countdown is stopped, the new duration and reminder are loaded, and the phase becomes **Morning**.
2. **▶** starts the countdown, and the phase becomes **Day**. Pausing goes back to **Morning**.
3. With the reminder time left, the **reminder bell** rings.
4. When the countdown reaches zero, the **end of day bell** rings and the phase becomes **Dusk**.
5. **Night** is only ever set by hand, with the Night button.
6. Going from **Night** to daytime (by picking a timer option, or pressing Day) rings the **start of day** sound.

The server keeps time, so the countdown is the same on every device and survives a page reload. If the server
restarts while a countdown is running and the time runs out meanwhile, the game is at dusk when it comes back.

## The bells

Each game rings the sounds of its **Clock SFX preset**, picked on the game's card on **Play** (see
[Settings → Audio → Clock SFX](settings/audio.md#clock-sfx)):

| Sound | When it plays |
| --- | --- |
| **Start of Day** | The game goes from night to morning or day. |
| **Reminder Bell** | The reminder time is reached during the countdown. |
| **End of Day** | The countdown runs out, or the bell is rung by hand. |

A game whose preset is "None", or whose preset has no sound for a slot, stays silent for it. Bells play on every
device whose audio engine is on — see [which devices make sound](audio-overview.md#which-devices-make-sound).

## Common tasks

| I want to… | Do this |
| --- | --- |
| Start the first day | Set Night for night 1, then pick a timer option (Day 1) and press ▶. |
| Give more time | Press ⏸ (resets the timer), pick a longer option, press ▶. Or ▶ again to rerun the same length. |
| End the day early | Press ⏸, then Dusk. (Pressing only Dusk leaves the countdown running underneath, and its bell still rings when it runs out.) |
| Call players back | Press 🔔. |
| Go to night | Press Night. |
| Start the next day | Pick a timer option, or press Day to repeat the last one — the day number goes up by one. |
| Fix a wrong day number | Day − / +. |
| Quieten the music while you talk | Press DIM; press again to restore. |
