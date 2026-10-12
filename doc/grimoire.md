# Using the grimoire

[← Setting up a virtual grimoire](grimoire-setup.md) · [Documentation home](README.md) · Next: [Player-facing pages →](player-pages.md)

The grimoire is designed for a tablet (it works on phones and desktops too, and with a stylus). Open it from
**Play → Grimoire** on the game's card.

- [The board](#the-board)
- [Player tokens](#player-tokens)
- [Reminder tokens](#reminder-tokens)
- [The token tray](#the-token-tray)
- [Night order](#night-order)
- [The clock](#the-clock)
- [Communications: showing things to players](#communications-showing-things-to-players)
- [The sidebar](#the-sidebar)
- [Annotate mode (drawing)](#annotate-mode-drawing)
- [Saving](#saving)
- [Ending a game](#ending-a-game)

## The board

The board is the town circle, with three faint guide rings and the game's clock in the middle.

- **Pinch** to zoom and **drag empty space** to pan (with a mouse: scroll to zoom). The view re-fits itself when the
  screen is rotated or resized.
- **Drag a token** to move it. To take a token off the board, drag it to the top or bottom edge of the screen, or
  onto the open token tray. Tokens can be locked in place (see [the sidebar](#the-sidebar)); dragging a locked
  token shows *"Grimoire Tokens Locked"*.
- **Tap a token** to open its popup.

How tokens look:

| Look | Meaning |
| --- | --- |
| Name under the token, with an outline | A seated player |
| No name, drawn behind the players | A character token that isn't a player (e.g. the Drunk's townsfolk token) |
| Darkened and greyed | Dead |
| Ghost-vote marker | Dead and still has their ghost vote |
| Colours inverted (hue-shifted) | The player's alignment differs from their character's usual one (e.g. an evil townsfolk) |
| Number badge | Their place in tonight's [night order](#night-order) |

## Player tokens

Tap a token to open its popup:

- **Player name** — type to set it. A token only counts as a seated player (for the night order, the town square
  and framing the view) once it has a name.
- **Alive / Dead** — toggles death. Dead players are shown as dead on the 3D town square.
- **Good / Evil** — toggles alignment.
- **Has vote / Vote used** — appears for dead players; tracks their ghost vote (also shown on the town square).
- **Show** — shows this character full-screen, with its ability, to hold up to a player. ✕ returns to the grim.
- **Change character** / **Choose character** — gives the player a different character (or none), keeping their
  name, seat and life status. For example after a Pit-Hag or a Snake Charmer swap.
- The character's **ability text** and setup note.
- The character's **reminder tokens**, ready to drag onto the board.

Loric and fabled tokens have no name, alive/dead or alignment controls.

Tap anywhere else to close the popup.

## Reminder tokens

- **Add** a reminder by dragging it out of a token's popup, or out of a character's overview in the
  [token tray](#the-token-tray).
- Every character also has a **blank reminder** (just the character's icon) if it has no reminders of its own.
- **Move** reminders by dragging them.
- **Remove** a reminder by dragging it to the top or bottom edge of the screen.

Reminders follow their nearest player when you [reset token positions](#the-sidebar).

## The token tray

Open it with the tray button at the bottom of the screen (an arrow over three tokens); ✕ or tapping outside closes
it. The tray shows the script's name and:

- **In-play** — the characters of the seated players.
- **Bluffs** — your bluff sets. **Show bluffs** opens a full-screen *"These roles are not in play"* page with that
  set, to show the demon. ✕ deletes a set.
- **Travellers**, **Loric** and **Fabled** — every one in the library, so they can be added mid-game.
- **All Characters** — the rest of the script.

Tap a character in the tray to open its **overview**: the token, its ability, and its reminders. **Drag the token**
from the overview onto the board to add it, or **drag a reminder** to place it. Dropping a dragged token near the top
or bottom edge, or back on the tray, cancels it.

Opening the tray unlocks the tokens.

## Night order

Each living, seated character that wakes tonight gets a **number badge** showing its position in the night order:

- On **day 0** it uses the script's **first night** order; from day 1 on, the **other nights** order.
- Dead players and characters that don't wake are left out, so the badges count 1, 2, 3… down the real wake order.

The night order comes from the script; it can be edited in
[Settings → Scripts → Edit Characters](settings/scripts.md#editing-a-scripts-characters-and-night-order).

## The clock

The game's clock sits in the middle of the board, showing the countdown and the day. Tap its centre to open the
full [clock remote](clock-remote.md) (timer options, phases, day and player counters, dim, skip and bell). Starting
the timer closes it again.

Hide or show the clock with the clock button in the sidebar.

## Communications: showing things to players

The **Communications** button (speech bubble) in the sidebar opens a menu of things to show a player. Each opens a
clean full-screen page in large type to hold up; **✕** returns to the grim.

| Option | Shows |
| --- | --- |
| **This is your demon** | That text. |
| **These are your minions** | That text. |
| **This character has selected you…** | Pick an in-play character, then optionally a suffix: *…to be mad that this player is evil…*, *…and is this player…*, or *…to be mad that you are this character…* (then pick that second character). |
| **You are…** | Pick a character, then optionally *…and you are on the EVIL team* or *…and you are on the GOOD team*. |
| **Bluffs** | Your bluff set (pick which, if there are several). With none yet, it lets you create one: choose at least three characters and press **Add bluff set**. |
| **Speak to me tomorrow** | That text. |
| *Your saved messages* | Every message from [Settings → Grim Messages](settings/grim-messages.md). If one has blank character slots, you're asked to fill each in first. |
| **Custom message…** | Build a one-off message from text and character-token rows, then **Show message**. |

## The sidebar

The column of buttons on the side of the screen. The top row is always there; the rest show when the menu is open.

| Button | What it does |
| --- | --- |
| **☰ / ⌃** | Opens or collapses the menu. Collapsing it leaves annotate mode. |
| **Audio** (speaker) | A pop-out with **Dim**, play/pause and skip for whichever music player is running (Spotify or uploaded music), **Sting** (a big *Trigger Sting* button) and **Open mixer** (the [mixer](audio-mixer.md) as a remote). |
| **Communications** | See [above](#communications-showing-things-to-players). |
| **Hide grimoire** (eye) | Replaces the grim with a *"Grimoire Hidden"* screen, for when you leave the tablet lying around. **Unhide** brings it back. |
| **Back to Play** | Saves and returns to the Play page. |
| **Annotate** (pen) | Enters [annotate mode](#annotate-mode-drawing). |
| **Lock** | Locks token positions so they can't be dragged by accident (tapping still works). Remembered on this device. |
| **Reset token positions** | Spaces the players evenly round the **Near**, **Mid** or **Far** ring, keeping their order round the table. Unnamed tokens and reminders move with their nearest player; loric and fabled stay put. Only while unlocked. |
| **Clock** | Shows or hides the clock in the middle. |
| **Refresh** | Reloads the page. |
| **Delete grim** (bin) | [Ends the game](#ending-a-game). |

A small indicator shows whether your latest changes are **saved**, **saving** or failed to save.

## Annotate mode (drawing)

Draw freehand notes over the board — a quick way to note who claimed what or who nominated whom.

- **Pens**: red, green, blue and yellow, plus an **eraser** (which removes whole strokes).
- **Layers**: drawings live on layers. Pick a layer to draw on it; **clear** wipes a layer; **delete** removes it
  (when there's more than one); **+** adds a new one. Use layers to keep, say, claims and nominations apart.
- **Undo** (curved arrow, while the layer has strokes) removes the last pen stroke on the current layer.
- **With a stylus**, you can draw at any time, even outside annotate mode, using the last pen you picked. The stylus's
  side button switches to the eraser.

Opening the token tray or the audio menu leaves annotate mode.

## Saving

The grimoire saves automatically: about a second after each change it's sent to the server, and it's also kept in
the browser straight away. You can close the tablet, reload or open the same grimoire on another device and carry on.

## Ending a game

From **Delete grim** in the sidebar, or **End game** on the game's card on **Play**, choose:

- **Evil victory** or **Good victory** — records the result against the preset the game was set up from (shown as
  the preset's win record), then deletes the grimoire;
- **Just delete** — deletes it without recording anything;
- **Cancel**.

Deleting the grimoire can't be undone. The game itself (its clock, name and bells) stays, ready for the next
[setup](grimoire-setup.md).
