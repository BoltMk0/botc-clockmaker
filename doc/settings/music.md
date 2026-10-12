# Settings → Music

[← Settings overview](README.md) · [Documentation home](../README.md)

The uploaded-music library, playlists, and the presets shown on the mixer's music and Spotify strips. For how the
players behave during a game, see [Music & Spotify](../music-and-spotify.md).

The page has four tabs: **Library**, **Playlists**, **Music Presets** and **Spotify**. A small player at the
bottom previews tracks on this device (it's separate from the room's music player).

- [Library](#library)
  - [Editing a track](#editing-a-track)
  - [Editing an album](#editing-an-album)
- [Playlists](#playlists)
- [Music Presets](#music-presets)
- [Spotify](#spotify)

## Library

Upload music with the upload button, or **drop files** onto the panel. WAV, MP3, AAC, M4A, FLAC and OGG are
accepted; each file is uploaded separately (up to 200 MB each in the Docker image).

Each track is filled in from its file's tags where it has them — **title, artist, album, year, track number and
cover art** — and is put on its album, which holds the artwork for all its tracks. Tracks without an album are
grouped under **Not on an album**.

- **Search** by title, artist or album.
- Tap a track's ▶ to preview it in the bottom player (the rest of the list queues after it).
- **+** by a track adds it to a playlist (or a new one); **+ Playlist** by an album adds all its tracks.
- **Edit details** and **Delete** on each track.

### Editing a track

| Field | Notes |
| --- | --- |
| **Title**, **Artist** | |
| **Album** | Type an existing album's name to move the track onto it, or a new name to start a new album. An album left with no tracks is removed. |
| **Year**, **Track #** | Track number sets the album's running order. |
| **Loudness (LUFS)** | The track's measured loudness, used by [loudness levelling](audio.md#loudness-levelling). Shows *Measuring…* while it's being measured. You can type a value to override it, clear it to stop the track being levelled, or **re-measure** it. |

### Editing an album

**Edit album** on an album's heading:

- **Artwork** — upload new artwork (PNG, JPEG, WebP or GIF) or **Remove artwork**.
- **Album title** and **Album artist**. Tracks credited to the album's artist follow a change of artist. Giving it the
  same title and artist as another album **merges** the two.

## Playlists

- Type a name and press **+ Playlist** to make an empty playlist. (You can also make one from the Library's **+**
  menu.)
- Tap a playlist to open it. Its tracks are listed with the total length.
  - **Drag** tracks, or use the **up/down arrows**, to change the order.
  - **Remove from playlist** takes a track off (it stays in the library).
  - **Play** previews the playlist from the top.
- Rename a playlist by editing its name; **Delete playlist** removes it. Deleting a playlist also takes it out of any
  preset that uses it.

The order matters only for previewing: in a game, presets always play shuffled.

## Music Presets

The presets shown on the mixer's **Music** strip. Make at least one playlist first.

Add a preset with one of:

- **Add Ambient Playlist** — one playlist, whatever the phase.
- **Add Ambient Adaptive Playlist** — a playlist each for **Day**, **Dusk** and **Night**.
- **Add Day & Night Playlist** — a **Day** playlist (only while the countdown runs) and a **Night** playlist.

Give each a **name** (it defaults to its type) and choose its playlist(s). The bin deletes a preset. Press **Save
changes** to save. How each type behaves is explained under
[preset types](../music-and-spotify.md#preset-types).

## Spotify

The presets shown on the mixer's **Spotify** strip. The same three types are available — **Add Ambient Playlist**,
**Add Ambient Adaptive Playlist** and **Add Day & Night Playlist** — but each list is a **Spotify album or playlist
link**: in Spotify, use **Share → Copy link** and paste it in. Links are checked and tidied when you save; invalid ones
are highlighted.

For an adaptive or day & night preset, leave a phase's link empty to make that phase **silent** (the music fades out
and pauses, and resumes by itself when a phase with a list comes round).

Press **Save changes** to save. Spotify itself needs [setting up on the server](../music-and-spotify.md#setting-up-spotify)
before these can be played.
