# Lightscapes: Zigbee lighting

[← Documentation home](README.md)

Lightscapes sets the room's lights to follow a game. A **hub** drives the lights: a separate program on a small
computer with a Zigbee USB adapter (a Raspberry Pi is plenty), next to the lights. Installing a hub is covered in the
[Lightscapes repository](https://github.com/BoltMk0/lightscapes). Everything the lights do is set up here, in
Clockmaker:
- **Settings → Lightscapes** approves the hubs and holds the **lighting presets**: what a game's lights do.
- **Play** picks which hubs follow each game, and the game's preset.

## Connecting a hub

1. On the hub's own page (port 8090 of the computer it runs on), set its address to Clockmaker's, followed by
   `/lightscapes`: for example `http://homelab:3000/lightscapes`. The exact address is shown on
   **Settings → Lightscapes**.
2. The hub asks to connect. It shows on **Settings → Lightscapes** under **Asking to connect**.
3. Click **Approve**. **Reject** turns it away; it won't ask again until it's told to on its own page.

A hub doesn't need the password or the [API token](settings/api-token.md). It's known by an id and secret of its own
from the first time it connects. Up to 10 hubs can wait to be approved at once, and one not approved within a day is
forgotten.

The approved hubs are listed with whether they're online, the game they follow, and how many lights they have.
**Details** shows each one's lights and their states, its buttons, and what it's done recently. **Remove** stops it
driving the lights; it has to be told to ask again on its own page.

A hub set up before Clockmaker drove it shows **Old settings**. Its details offer **Import as a preset**, which makes a
lighting preset from its scenes, spectrums, bells and buttons and opens it.

## Choosing a game's lights

On **Play**, each game has a **Lights** section once a hub is approved:
- Tick the hubs in the game's room. A game can have several. A hub follows one game at a time, so ticking one that
  follows another game asks first, then moves it. An offline hub is greyed out; it picks up its game when it's back.
- When there's more than one lighting preset, pick the game's. Otherwise games use the only one.

A game that hasn't picked a preset, or whose preset was deleted, uses the first one made: the one marked **Default**
in Settings.

## Lighting presets

**+ Lighting Preset** on **Settings → Lightscapes** makes one; **Duplicate** copies one, and the pencil opens it.
Changes are kept when you click **Save** in the bar at the bottom, and games using the preset change at once.
**Delete this preset** is at the bottom of the page.

Lights and buttons are picked from what the approved hubs have, labelled with the hub's name when there's more than
one hub. A light no hub has any more is marked **(not on any hub)**.

### Previews

The bar at the bottom picks the hub to **Preview on**. Previews show the preset as it is on the page, including
changes you haven't saved. They last a minute, or until **Back to the game**, then the lights follow the hub's game
again. Previews aren't shown while the lights are [overridden from the remote](#overriding-the-lights).

### Phases

Each phase has a **scene**: a list of lights or groups, and what to set each one to. The phases follow the game as in
[The clock remote and the day cycle](clock-remote.md):

| Phase | When |
| --- | --- |
| Morning | Once the day's timer is set up, until it's started (and while it's paused) |
| Day | While the countdown runs |
| Dusk | When the countdown runs out, or the day is ended |
| Night | Night |

For each light you choose:
- **On or off.**
- **Brightness:** leave it unticked to keep the light's brightness as it is.
- **Colour:** *Keep colour*, a *Colour*, a *White* from warm to cool, or one of the [spectrums](#spectrums). A light
  following a spectrum takes its brightness from the spectrum, scaled by its own.

A note says when a light can't show what it's set to, say a colour on a white-only bulb. It then shows the nearest it
can.

Lights not in a phase's scene are left as they are. **Fade between phases over** sets how long the lights take to
change when the phase does. **Preview** shows a phase's lights; for the day, at the point in the countdown you pick.

### Spectrums

A spectrum fades lights through a list of colours as the day's countdown runs. You can make as many as you like, say a
sky for the main lights and a firelight for the lamps, and each one is a colour a phase's light can pick.

What a light following a spectrum shows depends on the phase:

| Phase | Shows |
| --- | --- |
| Morning | The first colour |
| Day | The colours in turn, as the countdown runs |
| Dusk, Night | The last colour |

**+ Add a spectrum** adds one, and **Delete** removes it. Lights that followed a deleted spectrum keep their colour as
it is. Under each spectrum's name is the list of lights that follow it, in each phase.

- **Colours:** each one is placed at a point in the countdown, from 0% at the start to 100% at the end. You can edit
  them, add your own, or remove them. The bar above shows the result.
  **Use the town square's sky** fills them in from the sky behind the town square's clocktower:
  - pale dawn blue at the start
  - a clear midday blue
  - an orange sunset
  - deep purple twilight as the time runs out

  Each colour has its own brightness, so the room darkens with the sky.
- **Move the lights along every:** how often the lights are sent their next colour. They fade smoothly from each
  colour to the next, and always reach each listed colour on time, so 5–15 seconds is smooth without crowding the
  Zigbee network.
- **Preview the day at:** shows the day phase's lights at a point in the countdown.
- **Play it through over:** plays the spectrum from its first colour to its last over 10, 20, 30 or 60 seconds, on
  every light that follows it. A line moves along the bar to show where it's got to, and **Stop** ends it early. The
  lights hold the last colour for a few seconds, then go back to the game.

As on the town square, a spectrum stops just short of its last colour until the countdown runs out.

### Reactions

When a bell rings or a sting plays, its lights fade to the reaction's over **Fade over** seconds (0 to switch at
once), stay for **Hold for** seconds, then fade back to the phase's over the same time.
- **Start of day bell:** rings when night turns to day.
- **Reminder bell:** rings when the countdown gets to the reminder time its [timer option](settings/timer-options.md)
  has. Its lights are timed to land with the bell.
- **Hand bell, and the end of the day:** rung from the remote or a button, and as the countdown runs out.
- **Sting A, Sting B:** when the mixer's first or second sting plays.

A reaction's lights can also play an **effect** that the light does by itself, like *Blink* or *Breathe*. **Test**
shows the reaction's lights now.

### Buttons

Zigbee buttons and remotes paired with a hub can control the clock of the game the hub follows. Each binding is a
button, one of its actions (e.g. *single*, *double*, *hold*, or *on* and *off* for a two-button remote), and what it
does:

| Does | Like the remote's |
| --- | --- |
| Day (set the timer up) | **Day**: sets the last timer up again, ready to start |
| Start / pause the timer | **Start**, or **Pause** while it runs. Does nothing until a timer is set up. |
| Dusk, Night | **Dusk**, **Night** |
| Ring the bell | The bell |
| Play the armed sting | The mixer's sting trigger |

**Learn a button** (on the hub picked to preview on) waits 30 seconds for a button press, then adds it: pick what it
does and save. While learning, that press isn't acted on.

## Overriding the lights

The game's [remote](clock-remote.md#lighting) can set every light in any phase's scene to one white or colour and
brightness, in place of following the game.

While the lights are overridden:
- They don't change with the phase or the spectrums.
- The bells and stings don't flash them.
- Previews from Settings aren't shown.

When it's ended on the remote, the lights fade to the phase's. A light not in that phase's scene stays as the override
left it, as lights not in a scene always do.

## If a hub goes offline

A hub keeps its lights as the game last had them, and puts them back after a restart. When it's back online it picks
up its game where it's got to.
