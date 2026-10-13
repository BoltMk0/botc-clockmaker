# Setting up a virtual grimoire

[← The clock remote](clock-remote.md) · [Documentation home](README.md) · Next: [Using the grimoire →](grimoire.md)

The virtual grimoire replaces (or sits beside) the physical grimoire: a tablet-friendly board of character tokens,
reminders and player names, with the night order worked out for you. It also feeds the town square — the 3D display
shows the seated players, deaths and ghost votes.

This page covers getting a game *into* the grimoire. [Using the grimoire](grimoire.md) covers running it.

- [Before your first grimoire: characters and scripts](#before-your-first-grimoire-characters-and-scripts)
- [Starting the setup](#starting-the-setup)
- [Step 1: Script](#step-1-script)
- [Step 2: Players](#step-2-players)
- [Step 3: Preset](#step-3-preset)
- [Step 4: Characters](#step-4-characters)
- [Step 5: Bluffs](#step-5-bluffs)
- [Step 6: Finish](#step-6-finish)
- [Drawing tokens (pass the phone)](#drawing-tokens-pass-the-phone)
- [Going straight to the grim](#going-straight-to-the-grim)
- [Travellers, loric and fabled](#travellers-loric-and-fabled)

## Before your first grimoire: characters and scripts

The grimoire needs a **script**, and scripts are made of **characters**. A fresh install has neither. The quickest
way to fill them in (the server needs internet access for this):

1. **Settings → Characters → Wiki Scraper → Scrape all.** This downloads every official character — name, ability
   text and token icon — from the official wiki. It takes a few minutes.
2. **Settings → Scripts → Wiki Scraper → Scrape all.** This creates *Trouble Brewing*, *Bad Moon Rising* and
   *Sects & Violets* with their characters and night order.

For any other script, use **Settings → Scripts → Import** with a JSON file from the official Script Tool, or build
one by hand. See [Settings → Characters](settings/characters.md) and [Settings → Scripts](settings/scripts.md).

## Starting the setup

On **Play**, press **Setup Grimoire** on the game's card. (Once a game has a grimoire, the button becomes
**Grimoire**, with **End game** beneath it.)

The setup is a six-step wizard. The steps are shown along the top; **← Back** goes back one step.

## Step 1: Script

Pick the script for this game. **Configure Scripts** jumps to the script settings if the one you want isn't there.

## Step 2: Players

Pick the number of players, 4 to 15. Don't count travellers: they're added later (see
[below](#travellers-loric-and-fabled)).

## Step 3: Preset

A **preset** is a saved setup for a script and player count: the characters, which tokens go on the grim rather
than in the bag, and bluff sets. This step lists the presets for this script that match your player count.

- Each preset shows its characters (demons first) and its record, e.g. *"Played 7 times · Good 57% / Evil 43%"*.
- Pick one to load it and jump straight to [Finish](#step-6-finish). (You can still go back and change it.)
- Or press **New Game** to choose characters yourself.

If there are no matching presets, this step is skipped. Presets are managed in
[Settings → Scripts → Presets](settings/scripts.md#presets).

## Step 4: Characters

The script's characters, grouped by type, with the full ability text. Across the top a counter shows how many of
each type you've chosen against how many the player count calls for, e.g. *"3/5 Townsfolk"*.

- Use **+** / **−** on a character to add or remove it. The same character can be added more than once (for
  example for a Legion game).
- The counts are a guide, not a rule: you can choose a setup that doesn't match them, to account for characters
  that change the setup (the "[+2 Outsiders]" type of text is shown under each character).
- You can choose *more* characters than players — for example a Drunk's "thinks they are" token, or a Marionette.
  You'll sort which tokens go in the bag at the end.
- Travellers, loric and fabled from the whole character library are available here too, even though they're not
  on the script.

**Next** becomes available once you have at least one token per player.

## Step 5: Bluffs

Optional. Prepare one or more **bluff sets** — the three not-in-play characters you'll show the demon.

- **+ Add bluff set**, then tap characters to add or remove them. Each set needs at least three.
- Characters already chosen for the game are faded, so you don't pick one that's in play.
- Use the **Set 1 / Set 2…** tabs to switch between sets, and **Remove set** to delete one.
- Several sets are handy for demons that get extra bluffs, or to have alternatives ready.

You can also create bluff sets later, from the grimoire.

## Step 6: Finish

A summary of the setup.

- **If you chose more tokens than players**, you're asked to sort them: tap a token to move it between **In the
  bag** and **On the grim**. The bag must hold exactly one token per player. Tokens "on the grim" are placed on the
  board for you but are not drawn by a player (e.g. the Drunk's townsfolk token).
- **Save setup as new preset** (on by default) saves this setup as a preset if it isn't one already, so you can
  reuse it and its win record is kept. A game set up from a preset is credited to that preset when it ends.

Then choose how to seat the players:

- **[Draw tokens](#drawing-tokens-pass-the-phone)** — players draw their characters on a passed-around phone, and
  the grimoire is built for you with their names and seats.
- **[Go straight to grim view](#going-straight-to-the-grim)** — use a physical bag, or assign characters yourself,
  and fill in the grimoire by hand.

## Drawing tokens (pass the phone)

The digital equivalent of the token bag. The characters are hidden behind numbers; each player picks a number, sees
their character in private, and types their name.

1. Hand the device to the first player. They see *"Draw your character"* and a grid of numbers.
2. They tap any number. Their **character token**, **ability text** and any setup note appear.
3. They type their **name** and tap **✓**. The number becomes a tick and nobody else can take it.
4. They pass the device to the **next player round the table** (in seating order — that's how seats are worked
   out).
5. When every number is taken, the screen says *"Please return this device to the storyteller"*. The **Finish Setup**
   button unlocks after five seconds (so a player doesn't tap it by accident) and builds the grimoire.

When the draw finishes:

- every player is placed round the circle **in the order they drew**, with their name, character and default
  alignment (evil for minions and demons). They're spread evenly from the bottom left (the first to draw), clockwise
  over the top, to the bottom right (the last), leaving a gap at the bottom of the circle;
- tokens you put "on the grim", and any loric/fabled, are placed on the board;
- your bluff sets are ready in the token tray;
- the game's **player count** is set (travellers not included), the day is reset to **0**, the clock is cleared and
  the game is at **night**: the first night. Going to the morning then starts day 1.

Characters stay hidden from the storyteller's device until the draw is finished, and each slot only reveals its
character to the player who taps it.

## Going straight to the grim

Skips the draw. Every chosen token is laid out in rows along the top of the board, with no player names, and the
day is reset to 0 with the clock cleared.

From there, drag tokens to seats round the circle and tap each one to type the player's name (see
[Using the grimoire](grimoire.md)). A token only counts as a seated player once it has a name.

## Travellers, loric and fabled

- **Travellers** can be chosen during setup, but they aren't drawn from the bag. Once in the grimoire, drag the
  traveller's token to their seat and set the player's name to seat them. Travellers can also be added mid-game from
  the token tray. Travellers are public, so the 3D town square shows their character on their seat.
- **Loric and fabled** are never player characters: they have no name, alignment or alive/dead state. They're
  placed on the board apart from the town, and the 3D town square lists them with their rules text.
