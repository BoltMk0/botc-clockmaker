# Settings → Scripts

[← Settings overview](README.md) · [Documentation home](../README.md)

Scripts are the lists of characters a game is played with. Each has a name, a colour, its characters in display
order, its night order, and its saved setup presets.

- [The script list](#the-script-list)
- [The wiki scraper](#the-wiki-scraper)
- [Importing a script](#importing-a-script)
- [Creating a script](#creating-a-script)
- [A script's page](#a-scripts-page)
- [Editing a script's characters and night order](#editing-a-scripts-characters-and-night-order)
- [Exporting a script](#exporting-a-script)
- [Presets](#presets)
- [Deleting a script](#deleting-a-script)

## The script list

Every script, with its colour and character count. Tap one to open it. The header has **Wiki Scraper**,
**Import** and **+** (create).

## The wiki scraper

Creates the three base scripts — **Trouble Brewing**, **Bad Moon Rising** and **Sects & Violets** — with their
characters, from the official wiki.

- **Scrape All**, or **Scrape** / **Re-scrape** on a single script.
- Each script shows how many of its characters are available. The characters must already be in the library: if
  any are missing, it lists them — run the [character scraper](characters.md#the-wiki-scraper) (or add them by hand),
  then re-scrape the script.

## Importing a script

**Import** takes a script **JSON file in the official format**, as made by the official Script Tool (and most
other script sites).

- Characters already in the library are matched by **name** (or by ID, for entries that are only an ID).
- Characters the file describes **in full** (homebrew) that aren't in the library yet are **created**.
- If anything can't be imported, nothing is saved and the problems are listed.

After importing you're taken to the new script.

## Creating a script

**+** asks for a **Name** and a **Colour**, then opens the new, empty script for you to add characters.

## A script's page

Shows the script's name and colour and its characters, with:

- **View Script** — the [public script viewer](../player-pages.md#the-script-viewer) for this script.
- **Presets** — the script's [setup presets](#presets).
- **Edit Characters** — see below.
- **Export** — see below.

## Editing a script's characters and night order

**Edit Characters** opens a four-column editor. At the top: **Back**, the script's **colour** and **name** (both
editable), and **Save**. Nothing is saved until you press **Save**.

| Column | What it's for |
| --- | --- |
| **All characters** | The library. **Search** by name; **Filter by script** to show another script's characters (handy for building variants); tick which **categories** to show (travellers, loric and fabled are hidden by default; **Reset** restores that). Characters already in the script are outlined. Tap one to **add** it (tap again to remove it). |
| **In Script** | The script's characters, in the order players will see them. Drag to reorder within a category. Tap to **remove**. |
| **First Night** | The first night's wake order. Drag to reorder. **Reset** rebuilds it from each character's default night order. |
| **Other Nights** | The same for every other night. |

When you add a character, it's slotted into each night where its default night order puts it, so a hand-edited
night order is kept. The grimoire uses these orders for its [night order badges](../grimoire.md#night-order).

Travellers, loric and fabled don't need adding to a script to be used in a game — the grimoire setup always offers
them.

## Exporting a script

**Export** downloads the script as a JSON file in the official format, for use in other tools or another Clockmaker.

## Presets

A **preset** is a saved game setup for one script and player count:

- the **characters** (repeats allowed);
- which tokens go **on the grim** rather than in the bag (e.g. the Drunk's townsfolk);
- any **bluff sets**;
- an optional **name**;
- its **record**: how many times it's been played and the good/evil win split. Results are recorded when a game set
  up from it [ends](../grimoire.md#ending-a-game) with *Good victory* or *Evil victory*.

Presets appear in the grimoire setup's [Preset step](../grimoire-setup.md#step-3-preset) for their player count.
They're created automatically when you finish a grimoire setup with **Save setup as new preset** on, or by hand here.

The **Presets** page lists them grouped by player count, with **Edit** and **Delete** on each, and **+ New Preset**.

The preset editor walks through the same steps as the grimoire setup — **Players**, **Characters**, **Bluffs** and
a **Summary** — which you can jump between from the step list at the top. On the summary, give the preset a name,
sort any surplus tokens into the bag and the grim, and press **Save**.

## Deleting a script

On the script list, press **Delete** on the script, type its name to confirm, and press **Confirm Delete**. This
can't be undone.
