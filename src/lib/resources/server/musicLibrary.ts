import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { parseBuffer, selectCover } from "music-metadata";
import { isMusicAlbum, isMusicPlaylist, isMusicTrack, musicNameKey, MUSIC_NUMBER_MAX, MUSIC_TEXT_MAX_LENGTH, type MusicAlbum, type MusicAlbumDetails, type MusicLibrary, type MusicPlaylist, type MusicTrack, type MusicTrackDetails } from "$lib/audio/common/musicLibrary";
import { getAcceptedExtensionsForResourceType } from "../common/types";
import { getMimeTypeForExtension } from "../common/util";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { deleteResource, saveResource } from "./resources";
import { removeMusicPlaylistFromPresets } from "./musicPresets";

const TRACKS = new JSONMultiResourceManager<MusicTrack>('music-tracks', isMusicTrack);
const ALBUMS = new JSONMultiResourceManager<MusicAlbum>('music-albums', isMusicAlbum);
const PLAYLISTS = new JSONMultiResourceManager<MusicPlaylist>('music-playlists', isMusicPlaylist);

/** Artwork is stored scaled down to fit this square (never enlarged), as WebP. */
const ARTWORK_SIZE = 600;
const ARTWORK_QUALITY = 85;

/** Something asked of the library that doesn't exist, or can't be done; the message is fit to show the user. */
export class MusicLibraryError extends Error {
    constructor(message: string, readonly status: 400 | 404 | 415 = 400) {
        super(message);
        this.name = "MusicLibraryError";
    }
}

/** Every track, album and playlist. Playlists only list tracks that still exist. */
export function getMusicLibrary(): MusicLibrary {
    const trackIds = new Set(TRACKS.values.map(t => t.id));
    return {
        tracks: [...TRACKS.values],
        albums: [...ALBUMS.values],
        playlists: PLAYLISTS.values.map(p => ({ ...p, trackIds: p.trackIds.filter(id => trackIds.has(id)) }))
    };
}

export function getMusicTrack(id: string): MusicTrack | undefined {
    return TRACKS.get(id);
}

export function getMusicAlbum(id: string): MusicAlbum | undefined {
    return ALBUMS.get(id);
}

export function getMusicPlaylist(id: string): MusicPlaylist | undefined {
    return PLAYLISTS.get(id);
}

function text(value: string | undefined | null): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').slice(0, MUSIC_TEXT_MAX_LENGTH);
}

function optionalNumber(value: number | undefined | null): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MUSIC_NUMBER_MAX ? value : null;
}

function findAlbum(title: string, artist: string): MusicAlbum | undefined {
    const titleKey = musicNameKey(title), artistKey = musicNameKey(artist);
    return ALBUMS.values.find(a => musicNameKey(a.title) === titleKey && musicNameKey(a.artist) === artistKey);
}

function findOrCreateAlbum(title: string, artist: string): MusicAlbum {
    return findAlbum(title, artist) ?? ALBUMS.add({ id: randomUUID(), title, artist, artwork: null } satisfies MusicAlbum);
}

/** Drops an album (and its artwork) once no track is on it any more. */
function pruneAlbum(albumId: string | null) {
    if (albumId === null || TRACKS.values.some(t => t.albumId === albumId)) return;
    const album = ALBUMS.get(albumId);
    if (!album) return;
    if (album.artwork) deleteResource(album.artwork);
    ALBUMS.delete(album);
}

// ---- Tracks ----

/**
 * Stores an uploaded audio file as a new track, filled in from the file's tags (title, artist, album, year, track
 * number, length) where it has them, or titled after the file otherwise. It goes on the album its tags name, by the
 * album's artist, which is made if need be; and if that album has no artwork yet, it gets the file's cover picture.
 */
export async function addMusicTrack(filename: string, data: Buffer): Promise<MusicTrack> {
    const dot = filename.lastIndexOf('.');
    const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
    const accepted = getAcceptedExtensionsForResourceType('music');
    if (!accepted.includes(ext)) throw new MusicLibraryError(`Unsupported file "${filename}". Allowed: ${accepted.join(', ')}`, 415);

    let tags: Awaited<ReturnType<typeof parseBuffer>> | null = null;
    try {
        tags = await parseBuffer(new Uint8Array(data), { mimeType: getMimeTypeForExtension(ext), size: data.length }, { duration: true });
    } catch (e) {
        console.warn(`Couldn't read the tags of "${filename}"; it's titled after the file`, e);
    }
    const common = tags?.common;
    const artist = text(common?.artist ?? common?.artists?.join(', '));
    const albumTitle = text(common?.album);
    const album = albumTitle ? findOrCreateAlbum(albumTitle, text(common?.albumartist) || artist) : null;

    const id = randomUUID();
    const file = `music-${id}${ext}`;
    saveResource(file, data);
    const track = TRACKS.add({
        id,
        file,
        title: text(common?.title) || text(dot > 0 ? filename.slice(0, dot) : filename) || 'Untitled',
        artist,
        albumId: album?.id ?? null,
        year: optionalNumber(common?.year),
        trackNumber: optionalNumber(common?.track?.no),
        duration: typeof tags?.format.duration === 'number' && isFinite(tags.format.duration) ? tags.format.duration : null
    } satisfies MusicTrack);

    const cover = selectCover(common?.picture);
    if (album && !album.artwork && cover) {
        await setMusicAlbumArtwork(album.id, Buffer.from(cover.data))
            .catch(e => console.warn(`Couldn't use the cover picture in "${filename}" as album artwork`, e));
    }
    return track;
}

/**
 * Updates a track's details. Its album is by title: a track keeps the album it's on while the title still matches it
 * (so retitling a track on a compilation doesn't split it off), and otherwise moves to that album by its artist,
 * made if need be. An album left with no tracks goes.
 */
export function updateMusicTrack(id: string, details: MusicTrackDetails): MusicTrack {
    const track = TRACKS.get(id);
    if (!track) throw new MusicLibraryError('Track not found', 404);
    const artist = text(details.artist);
    const albumTitle = text(details.album);
    const current = track.albumId === null ? undefined : ALBUMS.get(track.albumId);
    let albumId: string | null = null;
    if (albumTitle) {
        albumId = current && musicNameKey(current.title) === musicNameKey(albumTitle) ? current.id : findOrCreateAlbum(albumTitle, artist).id;
    }
    const updated = TRACKS.add({
        ...track,
        title: text(details.title) || track.title,
        artist,
        albumId,
        year: optionalNumber(details.year),
        trackNumber: optionalNumber(details.trackNumber)
    } satisfies MusicTrack);
    if (track.albumId !== albumId) pruneAlbum(track.albumId);
    return updated;
}

/** Deletes a track and its file, taking it out of every playlist. An album left with no tracks goes. */
export function deleteMusicTrack(id: string) {
    const track = TRACKS.get(id);
    if (!track) throw new MusicLibraryError('Track not found', 404);
    deleteResource(track.file);
    TRACKS.delete(track);
    for (const playlist of PLAYLISTS.values.filter(p => p.trackIds.includes(id))) {
        PLAYLISTS.add({ ...playlist, trackIds: playlist.trackIds.filter(t => t !== id) });
    }
    pruneAlbum(track.albumId);
}

// ---- Albums ----

/**
 * Renames an album, or changes its artist. Its tracks credited to the album's old artist are credited to the new one
 * too. If there's already an album by that title and artist, the two are merged, keeping that album's artwork (or
 * this one's, if it has none). Returns the album the tracks are now on.
 */
export function updateMusicAlbum(id: string, details: MusicAlbumDetails): MusicAlbum {
    const album = ALBUMS.get(id);
    if (!album) throw new MusicLibraryError('Album not found', 404);
    const title = text(details.title);
    const artist = text(details.artist);
    if (!title) throw new MusicLibraryError('An album needs a title');

    const oldArtistKey = musicNameKey(album.artist);
    const target = findAlbum(title, artist);
    const into = target && target.id !== album.id ? target : null;
    for (const track of TRACKS.values.filter(t => t.albumId === album.id)) {
        TRACKS.add({
            ...track,
            albumId: into?.id ?? album.id,
            artist: musicNameKey(track.artist) === oldArtistKey ? artist : track.artist
        } satisfies MusicTrack);
    }
    if (!into) return ALBUMS.add({ ...album, title, artist } satisfies MusicAlbum);

    ALBUMS.delete(album);
    if (into.artwork === null && album.artwork !== null) return ALBUMS.add({ ...into, artwork: album.artwork } satisfies MusicAlbum);
    if (album.artwork) deleteResource(album.artwork);
    return into;
}

/** Replaces an album's artwork, scaled down and stored as WebP. Rejects, keeping the old artwork, if it isn't an image. */
export async function setMusicAlbumArtwork(id: string, data: Buffer): Promise<MusicAlbum> {
    if (!ALBUMS.get(id)) throw new MusicLibraryError('Album not found', 404);
    let image: Buffer;
    try {
        image = await sharp(data)
            .rotate() // Upright, by its EXIF orientation
            .resize(ARTWORK_SIZE, ARTWORK_SIZE, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: ARTWORK_QUALITY })
            .toBuffer();
    } catch {
        throw new MusicLibraryError("That file couldn't be read as an image", 415);
    }
    // Looked up again: the album may have changed while the image was converting
    const album = ALBUMS.get(id);
    if (!album) throw new MusicLibraryError('Album not found', 404);
    // A new name for each image, so a page showing the old one never keeps it from a cache
    const artwork = `albumart-${album.id}-${randomUUID().slice(0, 8)}.webp`;
    saveResource(artwork, image);
    if (album.artwork) deleteResource(album.artwork);
    return ALBUMS.add({ ...album, artwork } satisfies MusicAlbum);
}

export function clearMusicAlbumArtwork(id: string): MusicAlbum {
    const album = ALBUMS.get(id);
    if (!album) throw new MusicLibraryError('Album not found', 404);
    if (album.artwork) deleteResource(album.artwork);
    return ALBUMS.add({ ...album, artwork: null } satisfies MusicAlbum);
}

// ---- Playlists ----

export function createMusicPlaylist(name: string): MusicPlaylist {
    return PLAYLISTS.add({ id: randomUUID(), name: text(name) || 'New Playlist', trackIds: [] } satisfies MusicPlaylist);
}

/** Renames a playlist and/or sets its tracks, in order. Tracks that don't exist, and repeats, are dropped. */
export function updateMusicPlaylist(id: string, changes: { name?: string, trackIds?: string[] }): MusicPlaylist {
    const playlist = PLAYLISTS.get(id);
    if (!playlist) throw new MusicLibraryError('Playlist not found', 404);
    const trackIds = changes.trackIds === undefined ? playlist.trackIds : [...new Set(changes.trackIds)].filter(t => TRACKS.get(t) !== undefined);
    return PLAYLISTS.add({
        ...playlist,
        name: changes.name === undefined ? playlist.name : text(changes.name) || playlist.name,
        trackIds
    } satisfies MusicPlaylist);
}

/** Deletes a playlist, taking it out of the music presets (and dropping any left with nothing to play). */
export function deleteMusicPlaylist(id: string) {
    if (!PLAYLISTS.get(id)) throw new MusicLibraryError('Playlist not found', 404);
    PLAYLISTS.delete(id);
    removeMusicPlaylistFromPresets(id);
}
