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
- [Undo](#undo)
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

Tap a token to open its popup. At the top is the **player name**: tap the pencil beside it to change it (what's there
is selected, so typing replaces it; Enter or tapping elsewhere finishes). A token only counts as a seated player (for
the night order, the town square and framing the view) once it has a name.

Below are four buttons. The bottom-right one switches between two pages of them:

| Page 1 | Page 2 |
| --- | --- |
| **Alive / Dead** — toggles death. Dead players are shown as dead on the 3D town square. | **Good / Evil** — toggles alignment. |
| **Has vote / Vote used** — tracks a dead player's ghost vote (also shown on the town square). Greyed out while they're alive. | **Change character** / **Choose character** — gives the player a different character (or none), keeping their name, seat and life status. For example after a Pit-Hag or a Snake Charmer swap. |
| **Show** — shows this character full-screen, with its ability, to hold up to a player. ✕ returns to the grim. | **Wake** — marks the player to wake tonight for some other reason than their character, with a **?** in an orange circle beside their token (below their night order number, if they have one). Tap again (**Waking**) to take it off. |

Then the character's **ability text** and setup note, and its **reminder tokens**, ready to drag onto the board.

On a phone, tapping a token opens a full-screen overlay with the same controls in one list.

Loric and fabled tokens have no name, alive/dead, alignment or wake controls: just **Show** and **Change character**.

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

Each living, seated character that wakes tonight gets a **number badge** showing its position in the night order
(and any player marked to **Wake** from their popup gets a **?** badge):

- On **day 0** it uses the script's **first night** order; from day 1 on, the **other nights** order.
- Dead players and characters that don't wake are left out, so the badges count 1, 2, 3… down the real wake order.

The **night order** button in the sidebar opens the whole night as a sheet, with a tab for the first night and one for
the other nights. Each character shows the storyteller's night reminder, or its ability text when it has none. With 7
or more seated players (not counting travellers), the first night also lists **Minion Info** and **Demon Info** in
their places.

The night order comes from the script; it can be edited in
[Settings → Scripts → Edit Characters](settings/scripts.md#editing-a-scripts-characters-and-night-order).

## The clock

The game's clock sits in the middle of the board, showing the countdown and the day. Tap its centre to open the
full [clock remote](clock-remote.md) (timer options, phases, day and player counters, dim, skip and bell). Starting
the timer closes it again.

Hide or show the clock with the clock button in the sidebar.

## Communications: showing things to players

The **Communications** button (speech bubble) in the sidebar opens two tabs of things to show a player. Each is shown
on a clean full-screen page in large type to hold up; **✕** returns to the grim. A third, **Chalkboard**, opens a blank
board to draw on instead.

### Preset

Your [message presets](settings/communications.md#presets), each shown in one tap. **Bluffs** shows your bluff set (pick
which, if there are several). With none yet, it lets you create one: choose at least three characters and press
**Add bluff set**.

### Custom

A message builder, empty each time. Put together what you want to show from any number of **elements**, then press
**Show**: they're drawn top to bottom. Tick **Save as a preset** above **Show** to add the message to your presets as
well, under the name you give it (its first text, if you don't).

Tap **Add element** (the dashed box), then choose:

| Element | Shows |
| --- | --- |
| **Text** | A line of text. Pick one from the list — each is shown in its style: a **Header** large, in the title font, or **Text** smaller. The list is set in [Settings → Communications → Texts](settings/communications.md#texts). **Custom…** writes a new one: choose its style, type the text, and tick **Save as a text option** to keep it in the list for next time (it's off by default). **Character's ability…** adds a character's ability as a line of Text: tap the character. |
| **Character** | A row of character tokens. Pick as many as you like (tap again to unpick), laid out as in the token tray: those in play, then the script (faded if on the board), then travellers, loric and fabled. |
| **Alignment** | A blue **GOOD** or a red **EVIL** — choose which. |

In the builder, **✕** removes an element, tapping a row of characters changes them, and tapping an alignment switches
it between good and evil.

**Back**, top left, goes back a step, and closes communications from the tabs. In any text, put asterisks round
words to make them bold and underlined: *"You are \*drunk\*"* shows *"You are **drunk**"*. The words *good* and *evil* are
shown in blue and red.

### Chalkboard

A blank, near-black board to draw on in white, for anything easier drawn than written. The buttons top left switch
between the **pen** and the **eraser** (which rubs out whole lines), and **✕** returns to the grim. The drawing isn't
kept once you close it.

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
- **Undo** (curved arrow) undoes your last change; see [Undo](#undo). A two-finger tap while drawing does the same.
- **With a stylus**, you can draw at any time, even outside annotate mode, using the last pen you picked. The stylus's
  side button switches to the eraser.

Opening the token tray or the audio menu leaves annotate mode.

## Saving

The grimoire saves automatically. Dropping a token or reminder, finishing a line, and the popup's buttons save
straight away; typing a name saves about a second after you stop. Changes are also kept in the browser straight away,
so you can close the tablet, reload or open the same grimoire on another device and carry on.

The grimoire can be open on several devices at once, and they keep each other up to date: each change appears on the
others as soon as it's saved. If two devices change it at the same moment, both changes are kept (one moving a token
while the other renames it, say). A device in the middle of dragging a token or drawing a line takes in the other's
changes once it has finished. If the grimoire is deleted on one device, the others go back to the Play page.

## Undo

The **undo** button (curved arrow, on the board whenever there's something to undo) takes back your changes one at a
time, newest first: moving, adding or removing a token or reminder, a player's name, alive/dead, ghost vote,
alignment, character or wake, resetting token positions, drawing, erasing or clearing lines, and adding or deleting a
bluff set. A two-finger tap while drawing does the same. Changing a name counts as one change however many letters
you type, as long as you don't pause for more than a second.

Undo only takes back changes made on this device, and keeps what other devices have changed since: if you move a
token and someone else then renames it, undoing puts it back where it was, under its new name. A change that has
since been undone elsewhere (say, the token has been removed) is skipped for the one before it. Adding and deleting
layers can't be undone, and the lines drawn before a layer is added or deleted can no longer be undone either. The undo
list starts empty each time the page loads.

## Ending a game

From **Delete grim** in the sidebar, or **End game** on the game's card on **Play**, choose:

- **Evil victory** or **Good victory** — records the result against the preset the game was set up from (shown as
  the preset's win record), then deletes the grimoire;
- **Just delete** — deletes it without recording anything;
- **Cancel**.

Deleting the grimoire can't be undone. The game itself (its clock, name and bells) stays, ready for the next
[setup](grimoire-setup.md).
