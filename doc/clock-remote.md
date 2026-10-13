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

### Game

A slim bar showing the **day number** and **player count**. Tap it to open the − / + counters:

- **Day − / +** — corrects the day number. (It normally moves on by itself; see below.)
- **Players − / +** — the number of players. The town square shows the matching character breakdown. When a game
  is set up with the grimoire's token draw, this is set for you.

### The day's flow

The four phases, **Morning → Day → Dusk → Night**, in a row. The current phase is lit, and the next one is
outlined. Phases change the town square's sky, the night order in the grimoire, and the
[time-of-day audio](audio-overview.md#the-phase-drives-the-audio).

Under them is the countdown. While the timer is set up (in the morning) or counting down, there are buttons beside
and under it:

- **▶** (morning) starts the timer as it's set up, without picking one.
- **⏸** (day) pauses. It stops the clock **and resets it to its full time**, and the game goes back to **Morning**.
- **−1m, −30s, +30s, +1m** give the day more or less time, while it counts down or before it starts. They change
  only this day: the next morning sets up the timer option as it was picked. A minus button is disabled when it
  would take off all the time that's left.

### The main button

One large button that moves the game on to its next phase. It says what it will do:

| Phase | Button | What it does |
| --- | --- | --- |
| Morning | **Start the day** | Opens the timer options. Picking one sets it up and starts it: the game moves to **Day**. |
| Day | **End the day** | Ends the day early. Tap it twice (it turns red and asks): the countdown stops, the game moves to **Dusk** and the **end of day bell** rings. When the timer runs out, the game moves to dusk by itself. |
| Dusk | **Night falls** | Moves the game to **Night**. |
| Night | **Morning of day N** | Sets the last timer option up again and moves the game to **Morning** of the next day. |

You can also tap a phase in the flow to jump straight to it, e.g. to fix a mistake. Tapping **Day** opens the timer
options. Going to Dusk or Night while the countdown runs asks first, then ends the countdown and rings the end of day bell
(it doesn't ring again later). Morning can't be picked while the countdown runs (pause instead).

### The timer options

Shown when you start the day: one button per timer option from
[Settings → Timer Options](settings/timer-options.md), each with its duration (⏱), its reminder bell time (🔔, or a
crossed-out bell for none) and its label. The option currently set up is highlighted. Tap outside to close it
without starting.

### Now playing

The bar at the bottom shows what's playing on the uploaded-music player or Spotify (whichever is playing) with its
album art, **DIM** (turns all the room's audio down by the dim amount, shown under it; red while it's on, tap again to restore) and
a **⏭ skip** button. "No music player running" means neither player is running on any device.

Tap the bar to open the **music view**:

- a **preset button** above the album art, showing the preset that's loaded (and, under it, one waiting for the next
  phase). Tap it for a scrollable list of **every music and Spotify preset**, each marked with its player. Tapping the
  preset that's loaded plays or pauses it. While anything is playing, tapping another preset queues it for the next
  change of phase (it's outlined and reads *Next phase*); tap it again to switch now. Presets of a player that isn't
  running are greyed out;
- the track, artist and player;
- **previous / play-pause / next**;
- a **volume** slider for the player that's playing (the music strip's fader, or Spotify's volume) and **DIM**, which
  turns all the room's audio down by the dim amount (see [Settings → Audio](settings/audio.md#dim-strength));
- **Mixer** (top right) opens the [audio mixer](audio-mixer.md) as a remote control, with a back button.

**‹ Clock** returns to the clock controls.

## How the day cycle works

Clockmaker tracks a **day number** and a **phase** (morning, day, dusk or night) for each game.

1. **Picking a timer option** (or going to **Morning**, which repeats the last one) sets up a day:
   - If the game is at **dusk or night** (or still on day 0), the day number goes up by one. If it's already
     daytime, the day number stays the same — so you can swap to a different timer mid-morning without skipping a
     day.
   - Any running countdown is stopped, the new duration and reminder are loaded, and the phase becomes **Morning**.
2. **▶** starts the countdown, and the phase becomes **Day**. Pausing goes back to **Morning**.
3. With the reminder time left, the **reminder bell** rings.
4. When the countdown reaches zero, the **end of day bell** rings and the phase becomes **Dusk**.
5. **Night** is only ever set by hand, with **Night falls**.
6. Going from **Night** to daytime rings the **start of day** sound.

The server keeps time, so the countdown is the same on every device and survives a page reload. If the server
restarts while a countdown is running and the time runs out meanwhile, the game is at dusk when it comes back.

## The bells

Each game rings the sounds of its **Clock SFX preset**, picked on the game's card on **Play** (see
[Settings → Audio → Clock SFX](settings/audio.md#clock-sfx)):

| Sound | When it plays |
| --- | --- |
| **Start of Day** | The game goes from night to morning or day. |
| **Reminder Bell** | The reminder time is reached during the countdown. |
| **End of Day** | The countdown runs out or the day is ended early, or the bell is rung by hand (e.g. from a [Lightscapes](lightscapes.md) button). |

A game whose preset is "None", or whose preset has no sound for a slot, stays silent for it. Bells play on every
device whose audio engine is on — see [which devices make sound](audio-overview.md#which-devices-make-sound).

## Common tasks

| I want to… | Do this |
| --- | --- |
| Start the first day | Tap **Night** in the flow for night 1, then the main button (**Morning of day 1**), then **Start the day** and pick a timer. |
| Give more time | **+30s** or **+1m**. |
| End the day early | **End the day**, and tap it again to confirm. |
| Go to night | **Night falls**. |
| Start the next day | **Morning of day N**, then **Start the day** and pick a timer. |
| Fix a wrong day number | Open **Game** at the top, then Day − / +. |
| Change the music | Tap the now playing bar and pick a preset. |
| Quieten the music while you talk | **DIM** on the now playing bar; tap again to restore. |
