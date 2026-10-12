# Basic setup: a clock in the town square

[← First run](first-run.md) · [Documentation home](README.md) · Next: [The town square display →](town-square.md)

The simplest useful Clockmaker setup: a big screen showing the clock to the players, and the storyteller's phone as
a remote. No grimoire, no scripts, no music — those can all come later.

You'll need:

- the server running ([Installing with Docker](installation-docker.md));
- a **display** for the town square — a TV, monitor or projector driven by any device with a browser (a laptop, a
  mini-PC, a smart TV browser, a tablet);
- a **phone** (or tablet) for the storyteller.

## 1. Create a game

1. Open Clockmaker and choose **Play**.
2. Press **New Game**. A card appears, named "Team 1".
3. Optional: press the pencil next to the name to rename it (Enter to save, Escape to cancel). The name is shown on
   the town square.

Each game card shows:

- **Script**, **Players** and **Day** — the game's script (once it has a grimoire), player count and day number.
- **Clock SFX** — which set of bell sounds the game rings. "None" means silent; see [step 5](#5-optional-add-a-bell-sound).
- **Town Square** — opens the display for the players.
- **Setup Grimoire** / **Grimoire** — the virtual grimoire (not needed for this guide).
- Top-right: the **remote** button (opens the clock remote) and the **delete** button.

## 2. Put the town square on the big screen

On the display device, open Clockmaker, sign in, go to **Play** and press **Town Square** on your game. Then:

- Make the browser full screen (usually `F11`, or install Clockmaker as an app).
- Tap or click once anywhere on the page. Browsers only allow sound after you've interacted with the page, so this
  "wakes up" the audio for the bells.

The display shows the clock, the day number and the player count. By default it's the **Clocktower (3D)** scene;
the menu (☰, top left) lets you switch to a simpler display if the device struggles. See
[The town square display](town-square.md) for all the options.

## 3. Open the remote on your phone

On your phone, open **Play** and press the **remote** button (top right of the game's card).

> Shortcut: on the town square screen, open the ☰ menu and press **Share QR Code**, scan it with your phone, then
> open **Open Clock Remote** from the phone's ☰ menu. Or on the phone, open the town square and use **Open Clock
> Remote** from its menu.

The remote shows, from top to bottom:

- the **time remaining** with a play/pause button;
- **Day / Dusk / Night** buttons for the current phase;
- **Day** and **Players** counters with − and + buttons;
- your **timer options** (e.g. "5 Minutes");
- a bottom row of **mixer**, **DIM**, **skip track** and **ring bell** buttons.

## 4. Run a game

1. **Set the player count** with the Players − / + buttons. The town square shows it, along with how many
   townsfolk, outsiders, minions and demons that means.
2. **Night 1.** Set the phase to **Night**. The town square shows night.
3. **Morning.** Press a **timer option**, e.g. "5 Minutes". This moves the game to the next day (Day 1), sets the
   countdown to 5:00 and switches to **Day**. The countdown doesn't start yet.
4. **Start the discussion** with the ▶ button. The clock counts down on every screen.
5. If the timer option has a reminder (e.g. 30 s), a **reminder bell** rings with that long left, and the town
   square says *"The end of the day is approaching…"*.
6. When the time runs out, the **end of day bell** rings, the game moves to **Dusk**, and the town square says
   *"The day has ended! Please return to the Town Square."*
7. When you're ready for night, press **Night**.
8. Next morning, press a timer option again: the game moves to Day 2, and so on.

Other things you can do:

- **Ring the bell** by hand (bottom-right button) at any time to call people back. During the day the town square
  shows *"Your Story Teller requires your attention!"*.
- **Pause/stop** the countdown with ⏸. Note this stops the clock *and resets it* to the full time; ▶ starts it
  again from the top.
- **End the day early**: press ⏸, then **Dusk** (or **Night**). If you only press Dusk, the screens turn to dusk
  but the countdown carries on in the background and its end of day bell still rings when it runs out.
- **Fix the day number** with the Day − / + buttons.

The full detail is in [The clock remote and the day cycle](clock-remote.md).

## 5. Optional: add a bell sound

A fresh install has no bell sounds, so the bells above are silent until you add some:

1. Go to **Settings → Audio** and, under **Clock SFX**, press **+ Clock SFX Preset**.
2. Name it, and upload a sound for **End of Day** (and, if you like, **Start of Day** and **Reminder Bell**).
   Save.
3. Back on **Play**, pick the preset in the game's **Clock SFX** dropdown. (Games created *after* a preset exists
   use the first preset automatically.)

Details: [Settings → Audio → Clock SFX](settings/audio.md#clock-sfx).

## 6. Optional: let only one device make noise

Every town square screen plays the bells by default. If you have more than one screen showing the town square in
the same room (say a TV and a tablet), turn **Audio Engine** off in the ☰ menu on all but one of them, or the bells
will echo. The remote and the grimoire never play sound. See [Audio overview](audio-overview.md#which-devices-make-sound).

## Next steps

- Tune the display: [The town square display](town-square.md)
- Change the timer buttons: [Settings → Timer Options](settings/timer-options.md)
- Add atmosphere: [Audio overview](audio-overview.md)
- Run the grimoire from a tablet: [Setting up a virtual grimoire](grimoire-setup.md)
