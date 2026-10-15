# Settings → Characters

[← Settings overview](README.md) · [Documentation home](../README.md)

The character library: every character any script can use, with its token image, ability text, night order
defaults and reminder tokens.

- [The character list](#the-character-list)
- [The wiki scraper](#the-wiki-scraper)
- [Creating a character](#creating-a-character)
- [Editing a character](#editing-a-character)
- [Reminder tokens](#reminder-tokens)

## The character list

Shows how many characters there are, with a **search** box. Tap a character to open it. From here you can also
**Create Character** and open the **Wiki Scraper**.

## The wiki scraper

The fastest way to fill the library. It finds every townsfolk, outsider, minion, demon, traveller, loric and fabled
on the official [Blood on the Clocktower wiki](https://wiki.bloodontheclocktower.com/Main_Page) and fetches each
one's:

- name and **ability text**, and any setup change (e.g. "[+2 Outsiders]");
- **token icon**;
- **night order** (whether it wakes on the first night and other nights, and where), and the storyteller's
  **night reminders** for each;
- **reminder tokens** (taken from the community-maintained role list used by the clocktower.online grimoire).

Press **Scrape All** (press again to **Stop**). A progress bar and status line show how it's going, and each
character, grouped by category (tap a category to expand it), shows whether its data and icon are saved.

Notes:

- The **server** needs internet access.
- Scraping again **updates** characters that already exist (matched by name), overwriting their details with the
  wiki's. If you've edited an official character by hand, re-scraping undoes it.
- After scraping characters, use the [script scraper](scripts.md#the-wiki-scraper) to create the base scripts.

## Creating a character

For homebrew characters: **Create Character**, enter a **name** and pick a **category** (townsfolk, outsider,
minion, demon, traveller, loric or fabled), then **Submit**. You're taken to the new character to fill in the rest.

Characters can also be created by [importing a script](scripts.md#importing-a-script) that describes them in full.

## Editing a character

| Field | Notes |
| --- | --- |
| **Image** | Tap the image (or "No image") to choose a picture, then **Upload** or **Cancel**. PNG, JPEG, WebP or GIF; a square image with a transparent background looks best. |
| **ID** | Set automatically; read-only. |
| **Name** | |
| **Group** | The category: townsfolk, outsider, minion, demon, traveller, loric or fabled. Decides the default alignment (minions and demons are evil), where it's listed, and whether it's a player character. |
| **Text** | The ability text, shown on tokens, in the grimoire and in the script viewer. |
| **Setup** | Any setup change, e.g. "+2 Outsiders". Leave empty if it doesn't change setup. Shown in brackets under the ability. |
| **Wakes First Night** / **Wakes Other Nights** | Whether it wakes at night. |
| **Counts as Player** | Whether the token is drawn by a player. Untick for tokens that only ever sit on the grim. |
| **Default Night Order** → **First Night** / **Other Nights** | Its default position in the night order. Scripts use this when the character is added, and when you press **Reset** on a script's night order. |
| **First Night Reminder** / **Other Nights Reminder** | What the storyteller does when it wakes, shown on the grimoire's night order sheet. Leave empty to show the ability text there instead. |

Press **Save Changes** to save, or **Delete** to remove the character.

## Reminder tokens

Below the details is the character's set of **reminder tokens** — the small tokens placed on the grimoire.

- Tap a reminder to edit it: its **Text** and **Text Size** (10–100%), with live previews at three sizes. **Save
  Changes** or **Delete Token**.
- **+** adds a new reminder.

In the grimoire, a character with no reminders of its own still has a blank reminder (just its icon).
