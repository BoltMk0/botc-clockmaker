# Lightscapes: Zigbee lighting

[← Documentation home](README.md)

Lightscapes sets the room's lights to follow a game. It's a separate program that runs next to the game, on a small
computer with a Zigbee USB adapter (a Raspberry Pi is plenty), and talks to Clockmaker over the network. Installing it
is covered in [lightscapes/README.md](../lightscapes/README.md). This page is about setting it up for your games.

Lightscapes has its own page, on port 8090 of the computer it runs on. The menu down the side (along the top, on a
phone) has its pages: **Phases & bells**, **Spectrums**, **Buttons**, **Activity** and **Settings**. Changes on any
of them are kept when you click **Save** in the bar at the bottom.

## The status bar

The top of the page shows what Lightscapes is connected to:
- **Clockmaker:** the game it follows.
- **MQTT:** the message broker.
- **Zigbee2MQTT:** what drives the Zigbee adapter.
- The game's day and phase.

A red chip says what's wrong; hover it for more. If Clockmaker can't be reached, the lights stay as they are until it
can. Lightscapes then sets them to the game's phase straight away.

## Settings

Settings has the Clockmaker to follow. Until it's set up, the page opens on Settings.

- **Address:** Clockmaker's address, as the Lightscapes computer reaches it.
- **API token:** made in Clockmaker's [Settings → API Token](settings/api-token.md). Once saved it isn't shown again.
  Enter a new one to replace it.
- **Game:** click **Find games** to list Clockmaker's games, then pick the one in this room.

## Phases

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
  following a spectrum takes its brightness from the spectrum too.

Lights not in a phase's scene are left as they are. **Fade between phases over** sets how long the lights take to
change when the phase does.

**Preview** shows a phase's lights now, including changes you haven't saved. The lights go back to following the game
after a minute, or when you click **Back to the game** in the banner.

## Spectrums

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
  them, add your own, or remove them. The bar above shows the result, with a line marking where the game is now.
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

## Bells

The bells are on the **Phases & bells** page. When a bell rings, its lights fade to the bell's over **Fade over**
seconds (0 to switch at once), stay for **Hold for** seconds, then fade back to the phase's over the same time.
- **Start of day bell:** rings when night turns to day.
- **Reminder bell:** rings when the countdown gets to the reminder time its [timer option](settings/timer-options.md)
  has.
- **Hand bell:** rung from the remote, or from a button.

A bell's lights can also play an **effect** that the light does by itself, like *Blink* or *Breathe*. **Test** rings
the bell's lights now.

## Buttons

Zigbee buttons and remotes can control the clock. Each binding is a button, one of its actions (e.g. *single*,
*double*, *hold*, or *on* and *off* for a two-button remote), and what it does:

| Does | Like the remote's |
| --- | --- |
| Day (set the timer up) | **Day**: sets the last timer up again, ready to start |
| Start / pause the timer | **Start**, or **Pause** while it runs. Does nothing until a timer is set up. |
| Dusk, Night | **Dusk**, **Night** |
| Ring the bell | The bell |
| Play the armed sting | The mixer's sting trigger |

**Learn a button** waits 30 seconds for a button press, then adds it: pick what it does and save. While learning,
that press isn't acted on.

## Overriding the lights

The game's [remote](clock-remote.md#lighting) can set every light in any phase's scene to one white or colour and
brightness, in place of following the game. Tick **Lightscapes lighting** on the game's card on **Play** for the
remote to offer it.

While the lights are overridden:
- They don't change with the phase or the spectrums.
- The bells don't flash them.
- Previews from this page aren't shown. A preview or bell being shown when the override started ends.

The status bar shows **Overridden from the remote**. When it's ended on the remote, the lights fade to the phase's.
A light not in that phase's scene stays as the override left it, as lights not in a scene always do.

## Activity

The Activity page lists what Lightscapes did recently: phase changes, bells, overrides, button presses, and anything
that went wrong.
