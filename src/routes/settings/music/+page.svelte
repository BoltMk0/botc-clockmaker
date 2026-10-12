<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { onMount, tick, untrack } from "svelte";
    import { SvelteSet } from "svelte/reactivity";
    import TimeOfDayIcon from "$lib/assets/timeOfDayIcon.svelte";
    import { TIME_OF_DAY_LABELS, TIMES_OF_DAY, type TimeOfDay } from "$lib/model/client/types";
    import { COUNTDOWN_PHASES, type CountdownPhase } from "$lib/audio/common/spotifyPreset";
    import { isMusicAdaptivePreset, isMusicCountdownPreset, type MusicPreset } from "$lib/audio/common/musicPreset";
    import BinIcon from "$lib/assets/binIcon.svelte";
    import PencilIcon from "$lib/components/PencilIcon.svelte";
    import PlayIcon from "$lib/audio/client/components/PlayIcon.svelte";
    import PauseIcon from "$lib/audio/client/components/PauseIcon.svelte";
    import MusicPreviewPlayer from "$lib/audio/client/components/MusicPreviewPlayer.svelte";
    import { MusicLevelling } from "$lib/audio/client/MusicLevelling.svelte";
    import { levellingGainDb } from "$lib/audio/common/model/musicModel";
    import SpotifyPresetsEditor from "$lib/components/SpotifyPresetsEditor.svelte";
    import { getAcceptedExtensionsForResourceType } from "$lib/resources/common/types";
    import { formatMusicDuration, musicNameKey, MUSIC_LOUDNESS_MAX, MUSIC_LOUDNESS_MIN, MUSIC_NUMBER_MAX, MUSIC_TEXT_MAX_LENGTH, type MusicAlbum, type MusicLibrary, type MusicPlaylist, type MusicTrack, type MusicTrackDetails } from "$lib/audio/common/musicLibrary";

    let { data }: { data: { library: MusicLibrary, musicPresets: MusicPreset[] } } = $props();

    const acceptedAudioExtensions = getAcceptedExtensionsForResourceType('music');
    const acceptedImageExtensions = getAcceptedExtensionsForResourceType('albumart');

    const tracksById = $derived(new Map(data.library.tracks.map(t => [t.id, t])));
    const albumsById = $derived(new Map(data.library.albums.map(a => [a.id, a])));

    /** Natural order for names: case-insensitive, and "Track 10" after "Track 9". */
    function compareNames(a: string, b: string) {
        return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
    }

    /** An album's running order: by track number (unnumbered last), then title. */
    function compareTracks(a: MusicTrack, b: MusicTrack) {
        return (a.trackNumber ?? Infinity) - (b.trackNumber ?? Infinity) || compareNames(a.title, b.title);
    }

    function albumOf(track: MusicTrack): MusicAlbum | null {
        return track.albumId === null ? null : albumsById.get(track.albumId) ?? null;
    }

    function totalDuration(tracks: MusicTrack[]): number | null {
        if (tracks.length === 0) return 0;
        return tracks.some(t => t.duration === null) ? null : tracks.reduce((sum, t) => sum + t.duration!, 0);
    }

    function artworkUrl(album: MusicAlbum | null): string | null {
        return album?.artwork ? `/api/resources/${album.artwork}` : null;
    }

    async function failed(r: Response, what: string) {
        const message = await r.json().then(j => j.message).catch(() => r.statusText);
        alert(`Failed to ${what} (${r.status}): ${message}`);
    }

    function sendJson(url: string, method: string, body: unknown) {
        return fetch(url, { method, body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
    }

    // ---- Tabs ----

    /** All on this one page, rather than a page each, so the player keeps playing whichever is showing. */
    type Tab = 'library' | 'playlists' | 'presets' | 'spotify';
    let tab: Tab = $state('library');
    /** (The Spotify presets load in their own editor, so that tab has no count.) */
    const TABS: { tab: Tab, label: string, count?: () => number }[] = [
        { tab: 'library', label: 'Library', count: () => data.library.tracks.length },
        { tab: 'playlists', label: 'Playlists', count: () => data.library.playlists.length },
        { tab: 'presets', label: 'Presets', count: () => presetRows.length },
        { tab: 'spotify', label: 'Spotify' }
    ];

    // ---- Browsing ----

    type View = 'artists' | 'albums' | 'tracks';
    const VIEWS: { view: View, label: string }[] = [
        { view: 'artists', label: 'Artists' },
        { view: 'albums', label: 'Albums' },
        { view: 'tracks', label: 'Tracks' }
    ];
    let view: View = $state('artists');
    let search = $state('');
    const searching = $derived(search.trim() !== '');

    /** Whether the track's title, artist or album (or the album's artist) has every word searched for. */
    function matchesSearch(track: MusicTrack): boolean {
        const words = musicNameKey(search).split(' ').filter(w => w !== '');
        if (words.length === 0) return true;
        const album = albumOf(track);
        const haystack = musicNameKey([track.title, track.artist, album?.title ?? '', album?.artist ?? ''].join(' '));
        return words.every(w => haystack.includes(w));
    }

    const visibleTracks = $derived(data.library.tracks.filter(matchesSearch));

    type AlbumGroup = { album: MusicAlbum, tracks: MusicTrack[], year: number | null };

    /** The albums with tracks that match the search (just those tracks), in title order. */
    const albumGroups: AlbumGroup[] = $derived.by(() => {
        const groups = new Map<string, AlbumGroup>();
        for (const track of visibleTracks) {
            const album = albumOf(track);
            if (!album) continue;
            let group = groups.get(album.id);
            if (!group) groups.set(album.id, group = { album, tracks: [], year: null });
            group.tracks.push(track);
        }
        for (const group of groups.values()) {
            group.tracks.sort(compareTracks);
            group.year = group.tracks.find(t => t.year !== null)?.year ?? null;
        }
        return [...groups.values()].sort((a, b) => compareNames(a.album.title, b.album.title));
    });

    /** Matching tracks that aren't on an album, by artist then title. */
    const singles = $derived(visibleTracks.filter(t => albumOf(t) === null)
        .sort((a, b) => compareNames(a.artist, b.artist) || compareNames(a.title, b.title)));

    /**
     * The artists collapsed in the Artists view (all start expanded, and all are while searching). Kept here rather than left to the
     * <details> elements, which would otherwise reopen whenever the library reloads after a change.
     */
    const collapsedArtists = new SvelteSet<string>();

    type ArtistGroup = { key: string, name: string, albums: AlbumGroup[], singles: MusicTrack[] };

    /** Albums grouped by the album's artist, and singles by the track's; unknown artists last. */
    const artistGroups: ArtistGroup[] = $derived.by(() => {
        const groups = new Map<string, ArtistGroup>();
        const groupFor = (name: string) => {
            const key = musicNameKey(name);
            let group = groups.get(key);
            if (!group) groups.set(key, group = { key, name: name.trim(), albums: [], singles: [] });
            return group;
        };
        for (const group of albumGroups) groupFor(group.album.artist).albums.push(group);
        for (const track of singles) groupFor(track.artist).singles.push(track);
        return [...groups.values()].sort((a, b) => (a.key === '' ? 1 : 0) - (b.key === '' ? 1 : 0) || compareNames(a.name, b.name));
    });

    /** Every matching track, by artist, album and running order. */
    const allTracksSorted = $derived([...visibleTracks].sort((a, b) =>
        compareNames(a.artist, b.artist) || compareNames(albumOf(a)?.title ?? '', albumOf(b)?.title ?? '') || compareTracks(a, b)));

    /** Albums view: the album opened from the grid (or 'singles' for the tracks on none). */
    let openAlbumId: string | 'singles' | null = $state(null);
    const openAlbumGroup = $derived(albumGroups.find(g => g.album.id === openAlbumId) ?? null);

    // For the details forms' suggestions
    const knownArtists = $derived([...new Set(data.library.tracks.map(t => t.artist).concat(data.library.albums.map(a => a.artist)).filter(a => a !== ''))].sort(compareNames));
    const knownAlbumTitles = $derived([...new Set(data.library.albums.map(a => a.title))].sort(compareNames));

    // ---- Playing ----

    let player: MusicPreviewPlayer | undefined = $state();
    let playingId: string | null = $state(null);
    /** What the playing track was started from (its album, a playlist...), which "next" and "previous" go through. */
    let queue: string[] = $state([]);
    const playingTrack = $derived(playingId === null ? null : tracksById.get(playingId) ?? null);
    /** The loudness levelling settings (set on the Audio settings page), applied here as on the music player. */
    let levelling = $state<MusicLevelling | null>(null);
    onMount(() => {
        const l = levelling = new MusicLevelling();
        return () => l.close();
    });
    const playingGainDb = $derived(levelling && playingTrack ? levellingGainDb(levelling.model, playingTrack.loudness) : 0);

    async function play(track: MusicTrack, from: MusicTrack[]) {
        playingId = track.id;
        queue = from.map(t => t.id);
        await tick(); // Let the player pick up the new url first
        player?.play();
    }

    function isPlaying(track: MusicTrack) {
        return playingId === track.id && (player?.isPlaying() ?? false);
    }

    /** A track's play button: pauses or resumes it if it's the one loaded, otherwise starts it. */
    function togglePlay(track: MusicTrack, from: MusicTrack[]) {
        if (playingId !== track.id) play(track, from);
        else player?.setPaused(isPlaying(track));
    }

    /** Moves through the queue (skipping tracks deleted since), stopping at either end. */
    function step(by: 1 | -1) {
        let i = playingId === null ? -1 : queue.indexOf(playingId);
        for (i += by; i >= 0 && i < queue.length; i += by) {
            const track = tracksById.get(queue[i]);
            if (track) {
                play(track, queue.map(id => tracksById.get(id)).filter((t): t is MusicTrack => t !== undefined));
                return;
            }
        }
    }

    const queueIndex = $derived(playingId === null ? -1 : queue.indexOf(playingId));

    // ---- Uploading ----

    let uploadProgress: { done: number, total: number } | null = $state(null);
    /** Dropping files to upload: counts nested dragenter/dragleave pairs, so moving over a child doesn't end the highlight. */
    let dragDepth = $state(0);

    function isAcceptedAudio(file: File) {
        const dot = file.name.lastIndexOf('.');
        return dot >= 0 && acceptedAudioExtensions.includes(file.name.slice(dot).toLowerCase());
    }

    /** Uploads the files as new tracks, one after another (so tracks from one album all land on the same album). */
    async function upload(files: File[]) {
        const accepted = files.filter(isAcceptedAudio);
        if (accepted.length < files.length) {
            alert(`Skipped ${files.length - accepted.length} file(s) that aren't audio (${acceptedAudioExtensions.join(', ')}).`);
        }
        if (accepted.length === 0) return;
        uploadProgress = { done: 0, total: accepted.length };
        try {
            for (const file of accepted) {
                const formData = new FormData();
                formData.append('file', file);
                const r = await fetch('/api/music/tracks', { method: 'POST', body: formData });
                if (!r.ok) await failed(r, `upload "${file.name}"`);
                uploadProgress.done++;
            }
        } finally {
            uploadProgress = null;
            await invalidateAll();
        }
    }

    function isFileDrag(e: DragEvent) {
        return draggingTrackId === null && (e.dataTransfer?.types.includes('Files') ?? false);
    }

    function onLibraryDrop(e: DragEvent) {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth = 0;
        if (!uploadProgress) upload(Array.from(e.dataTransfer?.files ?? []));
    }

    // ---- Editing tracks ----

    /** The track whose details form is open, and the values typed so far (numbers as typed, so they can be blank). */
    let detailsId: string | null = $state(null);
    let detailsDraft = $state<{ title: string, artist: string, album: string, year: string | number | null, trackNumber: string | number | null, loudness: string | number | null }>(
        { title: '', artist: '', album: '', year: '', trackNumber: '', loudness: '' });
    /** The loudness as the form opened with it, so it's only sent if changed (one not yet measured stays queued). */
    let detailsLoudness = '';
    /** The track whose loudness is being measured again, if any. */
    let remeasuringId: string | null = $state(null);
    let saving = $state(false);

    function toggleDetails(track: MusicTrack) {
        albumEditId = null;
        if (detailsId === track.id) {
            detailsId = null;
            return;
        }
        detailsId = track.id;
        detailsDraft = {
            title: track.title,
            artist: track.artist,
            album: albumOf(track)?.title ?? '',
            year: track.year?.toString() ?? '',
            trackNumber: track.trackNumber?.toString() ?? '',
            loudness: detailsLoudness = track.loudness?.toString() ?? ''
        };
    }

    function parseLoudness(value: string | number | null): number | null {
        const n = parseFloat(fieldText(value));
        return isNaN(n) ? null : Math.min(Math.max(MUSIC_LOUDNESS_MIN, n), MUSIC_LOUDNESS_MAX);
    }

    /** A number field's value as text: it starts as text, but once typed in, Svelte binds it as a number (or null when cleared). */
    function fieldText(value: string | number | null): string {
        return value === null ? '' : String(value).trim();
    }

    function parseNumber(value: string | number | null): number | null {
        const n = parseInt(fieldText(value), 10);
        return isNaN(n) ? null : Math.min(Math.max(0, n), MUSIC_NUMBER_MAX);
    }

    async function saveDetails(track: MusicTrack) {
        const details: MusicTrackDetails = {
            title: detailsDraft.title,
            artist: detailsDraft.artist,
            album: detailsDraft.album,
            year: parseNumber(detailsDraft.year),
            trackNumber: parseNumber(detailsDraft.trackNumber)
        };
        if (fieldText(detailsDraft.loudness) !== detailsLoudness) details.loudness = parseLoudness(detailsDraft.loudness);
        saving = true;
        try {
            const r = await sendJson(`/api/music/tracks/${encodeURIComponent(track.id)}`, 'PATCH', details);
            if (!r.ok) return await failed(r, 'save the track');
            detailsId = null;
            await invalidateAll();
        } finally {
            saving = false;
        }
    }

    /** Measures the track's loudness again, filling the field with it (it's recorded straight away, so needn't be saved). */
    async function remeasureLoudness(track: MusicTrack) {
        remeasuringId = track.id;
        try {
            const r = await fetch(`/api/music/tracks/${encodeURIComponent(track.id)}/loudness`, { method: 'POST' });
            if (!r.ok) return await failed(r, 'measure the loudness');
            const { loudness } = await r.json() as { loudness: number | null };
            const text = loudness?.toString() ?? '';
            if (detailsId === track.id) detailsDraft.loudness = detailsLoudness = text;
            if (loudness === null) alert(`The loudness of "${track.title}" couldn't be measured (is it silent, or unreadable?)`);
            await invalidateAll();
        } finally {
            remeasuringId = null;
        }
    }

    async function deleteTrack(track: MusicTrack) {
        const inPlaylists = data.library.playlists.filter(p => p.trackIds.includes(track.id)).length;
        const warning = inPlaylists > 0 ? ` It will be taken out of ${inPlaylists} playlist${inPlaylists === 1 ? '' : 's'}.` : '';
        if (!confirm(`Delete "${track.title}"?${warning} This cannot be undone.`)) return;
        const r = await fetch(`/api/music/tracks/${encodeURIComponent(track.id)}`, { method: 'DELETE' });
        if (!r.ok) return await failed(r, 'delete the track');
        if (detailsId === track.id) detailsId = null;
        await invalidateAll();
    }

    // ---- Editing albums ----

    let albumEditId: string | null = $state(null);
    let albumDraft = $state({ title: '', artist: '' });
    let artworkBusy = $state(false);

    function toggleAlbumEdit(album: MusicAlbum) {
        detailsId = null;
        if (albumEditId === album.id) {
            albumEditId = null;
            return;
        }
        albumEditId = album.id;
        albumDraft = { title: album.title, artist: album.artist };
    }

    async function saveAlbum(album: MusicAlbum) {
        if (albumDraft.title.trim() === '') return alert('An album needs a title.');
        saving = true;
        try {
            const r = await sendJson(`/api/music/albums/${encodeURIComponent(album.id)}`, 'PATCH', albumDraft);
            if (!r.ok) return await failed(r, 'save the album');
            const saved: MusicAlbum = await r.json();
            // Merged into another album: follow it
            if (openAlbumId === album.id) openAlbumId = saved.id;
            albumEditId = null;
            await invalidateAll();
        } finally {
            saving = false;
        }
    }

    async function uploadArtwork(album: MusicAlbum, file: File | undefined) {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        artworkBusy = true;
        try {
            const r = await fetch(`/api/music/albums/${encodeURIComponent(album.id)}/artwork`, { method: 'PUT', body: formData });
            if (!r.ok) return await failed(r, 'upload the artwork');
            await invalidateAll();
        } finally {
            artworkBusy = false;
        }
    }

    async function removeArtwork(album: MusicAlbum) {
        if (!confirm(`Remove the artwork from "${album.title}"?`)) return;
        artworkBusy = true;
        try {
            const r = await fetch(`/api/music/albums/${encodeURIComponent(album.id)}/artwork`, { method: 'DELETE' });
            if (!r.ok) return await failed(r, 'remove the artwork');
            await invalidateAll();
        } finally {
            artworkBusy = false;
        }
    }

    // ---- Playlists ----

    /** The playlist open in the playlist panel; tracks in the library can be added to it. */
    let openPlaylistId: string | null = $state(null);
    const openPlaylist = $derived(data.library.playlists.find(p => p.id === openPlaylistId) ?? null);
    let newPlaylistName = $state('');
    let playlistNameDraft = $state('');
    const sortedPlaylists = $derived([...data.library.playlists].sort((a, b) => compareNames(a.name, b.name)));

    function tracksOf(playlist: MusicPlaylist): MusicTrack[] {
        return playlist.trackIds.map(id => tracksById.get(id)).filter((t): t is MusicTrack => t !== undefined);
    }

    function openPlaylistById(id: string | null) {
        openPlaylistId = id;
        playlistNameDraft = data.library.playlists.find(p => p.id === id)?.name ?? '';
    }

    async function createPlaylist() {
        const r = await sendJson('/api/music/playlists', 'POST', { name: newPlaylistName });
        if (!r.ok) return await failed(r, 'create the playlist');
        const playlist: MusicPlaylist = await r.json();
        newPlaylistName = '';
        await invalidateAll();
        openPlaylistById(playlist.id);
    }

    /** The order shown while it's being saved (or dragged), so the list doesn't jump back in between; null when idle. */
    let pendingOrder: string[] | null = $state(null);
    const openPlaylistTracks = $derived(openPlaylist ? (pendingOrder ?? openPlaylist.trackIds).map(id => tracksById.get(id)).filter((t): t is MusicTrack => t !== undefined) : []);

    async function savePlaylist(playlist: MusicPlaylist, changes: { name?: string, trackIds?: string[] }) {
        if (changes.trackIds) pendingOrder = changes.trackIds;
        try {
            const r = await sendJson(`/api/music/playlists/${encodeURIComponent(playlist.id)}`, 'PATCH', changes);
            if (!r.ok) await failed(r, 'save the playlist');
            await invalidateAll();
        } finally {
            pendingOrder = null;
        }
    }

    function renamePlaylist(playlist: MusicPlaylist) {
        const name = playlistNameDraft.trim();
        if (name === '' || name === playlist.name) {
            playlistNameDraft = playlist.name;
            return;
        }
        savePlaylist(playlist, { name });
    }

    async function deletePlaylist(playlist: MusicPlaylist) {
        if (!confirm(`Delete the playlist "${playlist.name}"? Its tracks stay in the library. This cannot be undone.`)) return;
        const r = await fetch(`/api/music/playlists/${encodeURIComponent(playlist.id)}`, { method: 'DELETE' });
        if (!r.ok) return await failed(r, 'delete the playlist');
        openPlaylistById(null);
        await invalidateAll();
    }

    /** The open playlist's remove button for a track. */
    function removeFromOpenPlaylist(track: MusicTrack) {
        if (!openPlaylist) return;
        savePlaylist(openPlaylist, { trackIds: (pendingOrder ?? openPlaylist.trackIds).filter(id => id !== track.id) });
    }

    // ---- The "add to playlist" popup ----

    /**
     * The popup a + button opens, for adding its tracks (one track's, an album's, or every one showing) to playlists:
     * each playlist with a tick if it has them all, and a field for making a new one with them on. Fixed in place by
     * the button, below it (or above, near the bottom of the screen).
     */
    type AddMenu = { trackIds: string[], label: string, trigger: HTMLElement, left: number, top: number, above: boolean };
    let addMenu: AddMenu | null = $state(null);
    let addMenuEl: HTMLElement | undefined = $state();
    let menuPlaylistName = $state('');
    let menuCreating = $state(false);
    /** Playlists' tracks as changed from the popup, until saved, so its ticks change straight away. */
    let pendingMembership: Record<string, string[]> = $state({});
    /** Keep in step with .add-menu's width. */
    const ADD_MENU_WIDTH_PX = 272;
    /** Below this much room under the button, the popup opens above it instead. */
    const ADD_MENU_MIN_ROOM_PX = 320;

    function openAddMenu(e: MouseEvent, tracks: MusicTrack[], label: string) {
        e.stopPropagation();
        const trigger = e.currentTarget as HTMLElement;
        if (addMenu?.trigger === trigger) return closeAddMenu();
        const rect = trigger.getBoundingClientRect();
        const above = window.innerHeight - rect.bottom < ADD_MENU_MIN_ROOM_PX && rect.top > window.innerHeight - rect.bottom;
        addMenu = {
            trackIds: tracks.map(t => t.id),
            label,
            trigger,
            // Right-aligned with the button, kept on screen
            left: Math.max(8, Math.min(rect.right - ADD_MENU_WIDTH_PX, window.innerWidth - ADD_MENU_WIDTH_PX - 8)),
            top: above ? rect.top - 4 : rect.bottom + 4,
            above
        };
        menuPlaylistName = '';
        tick().then(() => addMenuEl?.focus());
    }

    /** Whether the popup is open for just this track. */
    function addMenuFor(track: MusicTrack) {
        return addMenu?.trackIds.length === 1 && addMenu.trackIds[0] === track.id;
    }

    function closeAddMenu(returnFocus = false) {
        if (returnFocus) addMenu?.trigger.focus();
        addMenu = null;
    }

    function playlistTrackIds(playlist: MusicPlaylist) {
        return pendingMembership[playlist.id] ?? playlist.trackIds;
    }

    /** How many of the popup's tracks the playlist has: all, some or none. */
    function membership(playlist: MusicPlaylist, trackIds: string[]): 'all' | 'some' | 'none' {
        const ids = new Set(playlistTrackIds(playlist));
        const count = trackIds.filter(id => ids.has(id)).length;
        return count === 0 ? 'none' : count === trackIds.length ? 'all' : 'some';
    }

    /** Ticking a playlist adds the tracks it doesn't have to its end; unticking one that has them all takes them off. */
    function toggleMembership(playlist: MusicPlaylist, trackIds: string[]) {
        const ids = playlistTrackIds(playlist);
        const next = membership(playlist, trackIds) === 'all'
            ? ids.filter(id => !trackIds.includes(id))
            : [...ids, ...trackIds.filter(id => !ids.includes(id))];
        saveMembership(playlist.id, next);
    }

    async function saveMembership(playlistId: string, trackIds: string[]) {
        pendingMembership[playlistId] = trackIds;
        try {
            const r = await sendJson(`/api/music/playlists/${encodeURIComponent(playlistId)}`, 'PATCH', { trackIds });
            if (!r.ok) await failed(r, 'save the playlist');
            await invalidateAll();
        } finally {
            // A later change to the same playlist, still saving, keeps its own
            if (pendingMembership[playlistId] === trackIds) delete pendingMembership[playlistId];
        }
    }

    /** Makes a new playlist with the popup's tracks on it, leaving the popup open with it ticked. */
    async function createPlaylistFromMenu(trackIds: string[]) {
        menuCreating = true;
        try {
            const r = await sendJson('/api/music/playlists', 'POST', { name: menuPlaylistName });
            if (!r.ok) return await failed(r, 'create the playlist');
            const playlist: MusicPlaylist = await r.json();
            menuPlaylistName = '';
            await saveMembership(playlist.id, trackIds);
        } finally {
            menuCreating = false;
        }
    }

    function movePlaylistTrack(playlist: MusicPlaylist, index: number, by: 1 | -1) {
        const ids = [...(pendingOrder ?? playlist.trackIds)];
        const to = index + by;
        if (to < 0 || to >= ids.length) return;
        [ids[index], ids[to]] = [ids[to], ids[index]];
        savePlaylist(playlist, { trackIds: ids });
    }

    // Reordering the open playlist by dragging a track
    let draggingTrackId: string | null = $state(null);
    let dropped = false;

    function onPlaylistDragStart(e: DragEvent, track: MusicTrack) {
        if (!openPlaylist) return;
        draggingTrackId = track.id;
        dropped = false;
        pendingOrder = [...openPlaylist.trackIds];
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', track.title); // Firefox won't start a drag without some data
        }
    }

    /** Moves the dragged track to above or below the hovered one, depending on which half the pointer is over. */
    function onPlaylistDragOver(e: DragEvent, target: MusicTrack) {
        if (draggingTrackId === null || !pendingOrder) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (target.id === draggingTrackId) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const below = e.clientY > rect.top + rect.height / 2;
        const order = pendingOrder.filter(id => id !== draggingTrackId);
        order.splice(order.indexOf(target.id) + (below ? 1 : 0), 0, draggingTrackId);
        if (order.join() !== pendingOrder.join()) pendingOrder = order;
    }

    function onPlaylistDrop(e: DragEvent) {
        if (draggingTrackId === null || !openPlaylist || !pendingOrder) return;
        e.preventDefault();
        dropped = true;
        draggingTrackId = null;
        if (pendingOrder.join() === openPlaylist.trackIds.join()) pendingOrder = null;
        else savePlaylist(openPlaylist, { trackIds: pendingOrder });
    }

    function onPlaylistDragEnd() {
        // A drag dropped elsewhere (or cancelled with Escape) puts everything back
        if (!dropped) pendingOrder = null;
        draggingTrackId = null;
    }

    function trackCount(n: number) {
        return `${n} track${n === 1 ? '' : 's'}`;
    }

    /** "12 tracks · 48:10" (the length left out if any track's is unknown). */
    function summary(tracks: MusicTrack[]) {
        const total = totalDuration(tracks);
        return total === null || tracks.length === 0 ? trackCount(tracks.length) : `${trackCount(tracks.length)} · ${formatMusicDuration(total)}`;
    }

    function albumSummary(group: AlbumGroup) {
        return [group.album.artist || 'Unknown Artist', group.year, summary(group.tracks)].filter(p => p !== null).join(' · ');
    }

    // ---- Music presets ----

    // A preset as edited: playlists by id, '' for none. A `phase` row is an ambient adaptive playlist (a playlist per
    // phase), a `countdown` row a day & night playlist; otherwise just `playlistId`.
    type PresetKind = 'single' | 'phase' | 'countdown';
    type PresetRow = {
        id: string, name: string, kind: PresetKind, playlistId: string,
        phase: Record<TimeOfDay, string>, countdown: Record<CountdownPhase, string>
    };

    /** A day & night playlist's two playlists, as the settings name them. */
    const COUNTDOWN_LIST_LABELS: Record<CountdownPhase, string> = { day: 'Day', night: 'Night' };
    const PRESET_KIND_LABELS: Record<PresetKind, string> = { single: 'Ambient Playlist', phase: 'Ambient Adaptive Playlist', countdown: 'Day & Night Playlist' };

    function newPresetId() {
        return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    }

    function emptyPhase(): Record<TimeOfDay, string> {
        return Object.fromEntries(TIMES_OF_DAY.map(t => [t, ''])) as Record<TimeOfDay, string>;
    }

    function emptyCountdown(): Record<CountdownPhase, string> {
        return Object.fromEntries(COUNTDOWN_PHASES.map(p => [p, ''])) as Record<CountdownPhase, string>;
    }

    function newPresetRow(kind: PresetKind): PresetRow {
        return { id: newPresetId(), name: '', kind, playlistId: '', phase: emptyPhase(), countdown: emptyCountdown() };
    }

    function toPresetRow(p: MusicPreset): PresetRow {
        const row = newPresetRow('single');
        row.id = p.id;
        row.name = p.name;
        if (isMusicAdaptivePreset(p)) {
            row.kind = 'phase';
            row.phase = Object.fromEntries(TIMES_OF_DAY.map(t => [t, p.phasePlaylistIds[t] ?? ''])) as Record<TimeOfDay, string>;
        } else if (isMusicCountdownPreset(p)) {
            row.kind = 'countdown';
            row.countdown = Object.fromEntries(COUNTDOWN_PHASES.map(c => [c, p.countdownPlaylistIds[c] ?? ''])) as Record<CountdownPhase, string>;
        } else {
            row.playlistId = p.playlistId;
        }
        return row;
    }

    let presetRows: PresetRow[] = $state(untrack(() => data.musicPresets.map(toPresetRow)));
    let presetsSnapshot = $state(untrack(() => JSON.stringify(presetRows)));
    const presetsDirty = $derived(JSON.stringify(presetRows) !== presetsSnapshot);
    let savingPresets = $state(false);

    // Follow the saved presets (a playlist deleted here takes itself out of them) unless there are unsaved edits
    $effect(() => {
        const fresh = data.musicPresets;
        untrack(() => {
            if (presetsDirty) return;
            presetRows = fresh.map(toPresetRow);
            presetsSnapshot = JSON.stringify(presetRows);
        });
    });

    const playlistIds = $derived(new Set(data.library.playlists.map(p => p.id)));

    /** A picked playlist that still exists, or null. */
    function picked(id: string): string | null {
        return id !== '' && playlistIds.has(id) ? id : null;
    }

    async function savePresets() {
        const presets: MusicPreset[] = [];
        for (const row of presetRows) {
            const label = row.name.trim() || '(unnamed)';
            if (row.kind === 'phase') {
                const phasePlaylistIds = Object.fromEntries(TIMES_OF_DAY.map(t => [t, picked(row.phase[t])])) as Record<TimeOfDay, string | null>;
                if (TIMES_OF_DAY.every(t => phasePlaylistIds[t] === null)) return alert(`"${label}" needs a playlist for at least one phase.`);
                presets.push({ id: row.id, name: row.name.trim() || PRESET_KIND_LABELS.phase, phasePlaylistIds });
            } else if (row.kind === 'countdown') {
                const countdownPlaylistIds = Object.fromEntries(COUNTDOWN_PHASES.map(c => [c, picked(row.countdown[c])])) as Record<CountdownPhase, string | null>;
                if (COUNTDOWN_PHASES.every(c => countdownPlaylistIds[c] === null)) return alert(`"${label}" needs a playlist for the day or the night.`);
                presets.push({ id: row.id, name: row.name.trim() || PRESET_KIND_LABELS.countdown, countdownPlaylistIds });
            } else {
                const playlistId = picked(row.playlistId);
                if (playlistId === null) return alert(`"${label}" needs a playlist.`);
                const name = row.name.trim() || data.library.playlists.find(p => p.id === playlistId)?.name || PRESET_KIND_LABELS.single;
                presets.push({ id: row.id, name, playlistId });
            }
        }
        savingPresets = true;
        try {
            const r = await sendJson('/api/musicPresets', 'POST', presets);
            if (!r.ok) return await failed(r, 'save the presets');
            presetRows = presets.map(toPresetRow);
            presetsSnapshot = JSON.stringify(presetRows);
            await invalidateAll();
        } finally {
            savingPresets = false;
        }
    }
</script>

<svelte:window
    onpointerdown={(e) => { if (addMenu && !(e.target as Element).closest?.('.add-menu, .add-menu-trigger')) closeAddMenu(); }}
    onkeydown={(e) => { if (addMenu && e.key === 'Escape') closeAddMenu(true); }}
    onresize={() => closeAddMenu()}
/>

<datalist id="music-artists">{#each knownArtists as artist}<option value={artist}></option>{/each}</datalist>
<datalist id="music-albums">{#each knownAlbumTitles as title}<option value={title}></option>{/each}</datalist>

{#snippet artwork(album: MusicAlbum | null, size: 'small' | 'large')}
    {@const url = artworkUrl(album)}
    <div class="artwork {size}">
        {#if url}
            <img src={url} alt="" loading="lazy"/>
        {:else}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
        {/if}
    </div>
{/snippet}

{#snippet playButton(track: MusicTrack, from: MusicTrack[])}
    {@const rowPlaying = isPlaying(track)}
    <!-- (Component names are the other way round: PlayIcon draws the pause bars, PauseIcon the triangle.) -->
    <button class="play-button" onclick={(e) => { e.stopPropagation(); togglePlay(track, from); }}
        aria-label="{rowPlaying ? 'Pause' : 'Play'} {track.title}" title={rowPlaying ? 'Pause' : 'Play'}>
        {#if rowPlaying}<PlayIcon size={18}/>{:else}<PauseIcon size={18}/>{/if}
    </button>
{/snippet}

{#snippet loudnessCell(track: MusicTrack)}
    <td class="loudness-cell" title={track.loudness === undefined ? 'Loudness not measured yet' : track.loudness === null ? "Loudness couldn't be measured" : 'Loudness'}>
        {#if track.loudness === undefined}…{:else if track.loudness === null}–{:else}{track.loudness.toFixed(1)} LUFS{/if}
    </td>
{/snippet}

{#snippet trackRows(tracks: MusicTrack[], options: { numbers?: boolean, artist?: boolean | ((t: MusicTrack) => boolean), album?: boolean })}
    {#each tracks as track (track.id)}
        {@const showArtist = typeof options.artist === 'function' ? options.artist(track) : options.artist}
        {@const album = albumOf(track)}
        <tr class="track-row" class:selected={playingId === track.id} onclick={() => togglePlay(track, tracks)}>
            <td class="play-cell">{@render playButton(track, tracks)}</td>
            {#if options.numbers}<td class="number-cell">{track.trackNumber ?? ''}</td>{/if}
            <td class="duration-cell">{formatMusicDuration(track.duration)}</td>
            <td class="title-cell">
                <span class="track-title">{track.title}</span>
                {#if showArtist || options.album}
                    <span class="track-sub">{[showArtist ? (track.artist || 'Unknown Artist') : null, options.album ? album?.title : null].filter(Boolean).join(' · ')}</span>
                {/if}
            </td>
            {@render loudnessCell(track)}
            <td class="row-actions">
                <button class="icon-button add-menu-trigger" class:active={addMenuFor(track)} onclick={(e) => openAddMenu(e, [track], track.title)}
                    aria-label="Add {track.title} to a playlist" aria-haspopup="dialog" aria-expanded={addMenuFor(track)} title="Add to playlist">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>
                </button>
                <button class="icon-button edit-button" class:active={detailsId === track.id} onclick={(e) => { e.stopPropagation(); toggleDetails(track); }}
                    aria-label="Edit {track.title}" aria-expanded={detailsId === track.id} title="Edit details"><PencilIcon size={16}/></button>
                <button class="icon-button delete-button" onclick={(e) => { e.stopPropagation(); deleteTrack(track); }} aria-label="Delete {track.title}" title="Delete"><BinIcon size={18}/></button>
            </td>
        </tr>
        {#if detailsId === track.id}
            <tr class="details-row">
                <td colspan={options.numbers ? 6 : 5}>
                    <form class="details-form" onsubmit={(e) => { e.preventDefault(); saveDetails(track); }}>
                        <label class="details-field wide"><span>Title</span>
                            <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} bind:value={detailsDraft.title} required/></label>
                        <label class="details-field"><span>Artist</span>
                            <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} list="music-artists" bind:value={detailsDraft.artist}/></label>
                        <label class="details-field"><span>Album</span>
                            <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} list="music-albums" placeholder="(none)" bind:value={detailsDraft.album}/></label>
                        <label class="details-field narrow"><span>Year</span>
                            <input type="number" min="0" max={MUSIC_NUMBER_MAX} bind:value={detailsDraft.year}/></label>
                        <label class="details-field narrow"><span>Track #</span>
                            <input type="number" min="0" max={MUSIC_NUMBER_MAX} bind:value={detailsDraft.trackNumber}/></label>
                        <label class="details-field narrow" title="Integrated loudness, measured when the track was uploaded. Loudness levelling turns the track up or down from this; blank, it isn't levelled."><span>Loudness (LUFS)</span>
                            <span class="loudness-input">
                                <input type="number" min={MUSIC_LOUDNESS_MIN} max={MUSIC_LOUDNESS_MAX} step="0.1" bind:value={detailsDraft.loudness}
                                    placeholder={track.loudness === undefined || remeasuringId === track.id ? 'Measuring...' : 'Unknown'}
                                    disabled={remeasuringId === track.id}/>
                                <button type="button" class="icon-button remeasure-button" class:spinning={remeasuringId === track.id}
                                    disabled={remeasuringId !== null} onclick={() => remeasureLoudness(track)}
                                    aria-label="Re-measure the loudness" title="Re-measure the loudness">↻</button>
                            </span></label>
                        <div class="details-actions">
                            <button type="button" onclick={() => detailsId = null}>Cancel</button>
                            <button type="submit" class="save" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                        </div>
                    </form>
                </td>
            </tr>
        {/if}
    {/each}
{/snippet}

{#snippet trackTable(tracks: MusicTrack[], options: { numbers?: boolean, artist?: boolean | ((t: MusicTrack) => boolean), album?: boolean })}
    <div class="data-table-scroll">
        <table class="data-table track-table">
            <tbody>{@render trackRows(tracks, options)}</tbody>
        </table>
    </div>
{/snippet}

{#snippet albumBlock(group: AlbumGroup)}
    {@const album = group.album}
    <div class="album-block">
        <div class="album-header">
            {@render artwork(album, 'small')}
            <div class="album-heading">
                <div class="album-title">{album.title}</div>
                <div class="album-sub">{albumSummary(group)}</div>
            </div>
            <div class="album-actions">
                <button class="small-button add-menu-trigger" onclick={(e) => openAddMenu(e, group.tracks, album.title)} aria-haspopup="dialog"
                    title="Add the album's tracks to a playlist">+ Playlist</button>
                <button class="icon-button edit-button" class:active={albumEditId === album.id} onclick={() => toggleAlbumEdit(album)}
                    aria-label="Edit album {album.title}" aria-expanded={albumEditId === album.id} title="Edit album"><PencilIcon size={16}/></button>
            </div>
        </div>
        {#if albumEditId === album.id}
            <form class="album-form" onsubmit={(e) => { e.preventDefault(); saveAlbum(album); }}>
                <div class="album-form-artwork">
                    {@render artwork(album, 'large')}
                    <div class="artwork-buttons">
                        <label class="small-button upload-label" class:disabled={artworkBusy}>
                            {artworkBusy ? 'Working...' : album.artwork ? 'Replace artwork' : 'Upload artwork'}
                            <input type="file" accept={acceptedImageExtensions.join(',')} disabled={artworkBusy}
                                onchange={(e) => { uploadArtwork(album, e.currentTarget.files?.[0]); e.currentTarget.value = ''; }}/>
                        </label>
                        {#if album.artwork}<button type="button" class="small-button" disabled={artworkBusy} onclick={() => removeArtwork(album)}>Remove artwork</button>{/if}
                    </div>
                </div>
                <div class="album-form-fields">
                    <label class="details-field"><span>Album title</span>
                        <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} bind:value={albumDraft.title} required/></label>
                    <label class="details-field"><span>Album artist</span>
                        <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} list="music-artists" bind:value={albumDraft.artist}/></label>
                    <p class="form-note">Tracks credited to the album's artist follow a change of artist. Giving it the title and artist of another album merges the two.</p>
                    <div class="details-actions">
                        <button type="button" onclick={() => albumEditId = null}>Close</button>
                        <button type="submit" class="save" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                    </div>
                </div>
            </form>
        {/if}
        <!-- A track's artist is only shown where it differs from the album's (a compilation, say) -->
        {@render trackTable(group.tracks, { numbers: true, artist: (t) => musicNameKey(t.artist) !== musicNameKey(album.artist) })}
    </div>
{/snippet}

<div class="music-page">

<div class="tab-bar" role="tablist" aria-label="Music">
    {#each TABS as t}
        <button role="tab" id="music-tab-button-{t.tab}" aria-controls="music-tab-{t.tab}" aria-selected={tab === t.tab} class:selected={tab === t.tab} onclick={() => tab = t.tab}>
            {t.label}{#if t.count}<span class="tab-count">{t.count()}</span>{/if}
        </button>
    {/each}
</div>

<div class="tab-content" onscroll={() => closeAddMenu()}>
<div
    class="panel library tab-panel"
    id="music-tab-library"
    hidden={tab !== 'library'}
    class:drop-active={dragDepth > 0}
    role="tabpanel"
    tabindex="0"
    aria-labelledby="music-tab-button-library"
    ondragenter={(e) => { if (isFileDrag(e)) dragDepth++; }}
    ondragleave={(e) => { if (isFileDrag(e)) dragDepth = Math.max(0, dragDepth - 1); }}
    ondragover={(e) => { if (isFileDrag(e)) e.preventDefault(); }}
    ondrop={onLibraryDrop}
>
    <div class="panel-header">
        <h2>Library</h2>
        <label class="add-upload" class:disabled={uploadProgress !== null}>
            {uploadProgress ? `Uploading ${Math.min(uploadProgress.done + 1, uploadProgress.total)} of ${uploadProgress.total}...` : '+ Upload Tracks'}
            <input type="file" accept={acceptedAudioExtensions.join(',')} multiple disabled={uploadProgress !== null}
                onchange={(e) => { upload(Array.from(e.currentTarget.files ?? [])); e.currentTarget.value = ''; }}/>
        </label>
    </div>
    <p class="description">Upload tracks here, or drop them onto this panel. Each is filled in from its file's tags where it has them (title, artist, album, year, track number and cover art), and goes on its album, which keeps the artwork for all its tracks. Edit a track's album to move it to another; an album left with no tracks goes.</p>

    <div class="library-controls">
        <div class="view-tabs" role="tablist">
            {#each VIEWS as v}
                <button role="tab" aria-selected={view === v.view} class:highlight={view === v.view} onclick={() => { view = v.view; openAlbumId = null; }}>{v.label}</button>
            {/each}
        </div>
        <input class="search" type="search" placeholder="Search title, artist or album" bind:value={search}/>
    </div>

    {#if data.library.tracks.length === 0}
        <p class="empty">No music uploaded yet.</p>
    {:else if visibleTracks.length === 0}
        <p class="empty">Nothing matches "{search}".</p>
    {:else if view === 'artists'}
        {#each artistGroups as group (group.key)}
            <details class="artist-group" open={searching || !collapsedArtists.has(group.key)}
                ontoggle={(e) => { if (!searching) { if (e.currentTarget.open) collapsedArtists.delete(group.key); else collapsedArtists.add(group.key); } }}>
                <summary>
                    <span class="artist-name">{group.name || 'Unknown Artist'}</span>
                    <span class="artist-sub">{[group.albums.length > 0 ? `${group.albums.length} album${group.albums.length === 1 ? '' : 's'}` : null, trackCount(group.albums.reduce((n, a) => n + a.tracks.length, 0) + group.singles.length)].filter(Boolean).join(' · ')}</span>
                </summary>
                {#each group.albums as albumGroup (albumGroup.album.id)}
                    {@render albumBlock(albumGroup)}
                {/each}
                {#if group.singles.length > 0}
                    <div class="album-block">
                        <div class="album-header">
                            <div class="album-heading"><div class="album-title">Not on an album</div><div class="album-sub">{summary(group.singles)}</div></div>
                        </div>
                        {@render trackTable(group.singles, {})}
                    </div>
                {/if}
            </details>
        {/each}
    {:else if view === 'albums'}
        {#if openAlbumId === null}
            <div class="album-grid">
                {#each albumGroups as group (group.album.id)}
                    <button class="album-card" onclick={() => openAlbumId = group.album.id}>
                        {@render artwork(group.album, 'large')}
                        <span class="album-title">{group.album.title}</span>
                        <span class="album-sub">{[group.album.artist || 'Unknown Artist', group.year].filter(p => p !== null).join(' · ')}</span>
                    </button>
                {/each}
                {#if singles.length > 0}
                    <button class="album-card" onclick={() => openAlbumId = 'singles'}>
                        {@render artwork(null, 'large')}
                        <span class="album-title">Not on an album</span>
                        <span class="album-sub">{trackCount(singles.length)}</span>
                    </button>
                {/if}
            </div>
        {:else}
            <button class="small-button back" onclick={() => openAlbumId = null}>&larr; All albums</button>
            {#if openAlbumId === 'singles'}
                <div class="album-block">
                    <div class="album-header">
                        <div class="album-heading"><div class="album-title">Not on an album</div><div class="album-sub">{summary(singles)}</div></div>
                    </div>
                    {@render trackTable(singles, { artist: true })}
                </div>
            {:else if openAlbumGroup}
                {@render albumBlock(openAlbumGroup)}
            {:else}
                <p class="empty">That album has no tracks matching the search.</p>
            {/if}
        {/if}
    {:else}
        <div class="tracks-view-actions">
            <button class="small-button add-menu-trigger" onclick={(e) => openAddMenu(e, allTracksSorted, searching ? `${trackCount(allTracksSorted.length)} matching "${search.trim()}"` : `all ${trackCount(allTracksSorted.length)}`)}
                aria-haspopup="dialog">+ All {searching ? 'matching ' : ''}to a playlist</button>
        </div>
        {@render trackTable(allTracksSorted, { artist: true, album: true })}
    {/if}
</div>

<div class="panel playlists tab-panel" id="music-tab-playlists" role="tabpanel" tabindex="0" aria-labelledby="music-tab-button-playlists" hidden={tab !== 'playlists'}>
    <div class="panel-header">
        <h2>Playlists</h2>
    </div>
    <p class="description">Add tracks to playlists on the Library tab, with the + by each track (or "+ Playlist" by an album), which can make a new playlist too. Open one here to see its tracks; drag them (or use the arrows) to change the order.</p>
    <div class="playlists-columns">
    <div class="playlists-side">
    <form class="new-playlist" onsubmit={(e) => { e.preventDefault(); createPlaylist(); }}>
        <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} placeholder="New playlist name" bind:value={newPlaylistName}/>
        <button type="submit" class="add">+ Playlist</button>
    </form>
    <div class="playlist-list">
        {#each sortedPlaylists as playlist (playlist.id)}
            <button class="playlist-item" class:highlight={openPlaylistId === playlist.id} aria-pressed={openPlaylistId === playlist.id}
                onclick={() => openPlaylistById(openPlaylistId === playlist.id ? null : playlist.id)}>
                <span class="playlist-name">{playlist.name}</span>
                <span class="playlist-sub">{summary(tracksOf(playlist))}</span>
            </button>
        {:else}
            <p class="empty">No playlists yet.</p>
        {/each}
    </div>

    </div>
    {#if openPlaylist}
        {@const playlist = openPlaylist}
        <div class="playlist-editor">
            <div class="playlist-editor-header">
                <input class="playlist-name-input" type="text" aria-label="Playlist name" maxlength={MUSIC_TEXT_MAX_LENGTH} bind:value={playlistNameDraft}
                    onblur={() => renamePlaylist(playlist)}
                    onkeydown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        else if (e.key === 'Escape') { playlistNameDraft = playlist.name; e.currentTarget.blur(); }
                    }}/>
                <button class="small-button" disabled={openPlaylistTracks.length === 0} onclick={() => play(openPlaylistTracks[0], openPlaylistTracks)}>Play</button>
                <button class="icon-button delete-button" onclick={() => deletePlaylist(playlist)} aria-label="Delete playlist {playlist.name}" title="Delete playlist"><BinIcon size={18}/></button>
            </div>
            {#if openPlaylistTracks.length === 0}
                <p class="empty">Empty. Add tracks on the Library tab, with the + by each track.</p>
            {:else}
                <div class="data-table-scroll">
                    <table class="data-table track-table">
                        <tbody>
                            {#each openPlaylistTracks as track, i (track.id)}
                                <tr class="track-row" class:selected={playingId === track.id} class:dragging={draggingTrackId === track.id}
                                    draggable="true"
                                    ondragstart={(e) => onPlaylistDragStart(e, track)}
                                    ondragover={(e) => onPlaylistDragOver(e, track)}
                                    ondrop={onPlaylistDrop}
                                    ondragend={onPlaylistDragEnd}
                                    onclick={() => togglePlay(track, openPlaylistTracks)}>
                                    <td class="play-cell">{@render playButton(track, openPlaylistTracks)}</td>
                                    <td class="duration-cell">{formatMusicDuration(track.duration)}</td>
                                    <td class="title-cell">
                                        <span class="track-title">{track.title}</span>
                                        <span class="track-sub">{track.artist || 'Unknown Artist'}</span>
                                    </td>
                                    {@render loudnessCell(track)}
                                    <td class="row-actions">
                                        <button class="icon-button" disabled={i === 0} onclick={(e) => { e.stopPropagation(); movePlaylistTrack(playlist, i, -1); }} aria-label="Move {track.title} up" title="Move up">
                                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7.4 15.4 12 10.8l4.6 4.6L18 14l-6-6-6 6z"/></svg>
                                        </button>
                                        <button class="icon-button" disabled={i === openPlaylistTracks.length - 1} onclick={(e) => { e.stopPropagation(); movePlaylistTrack(playlist, i, 1); }} aria-label="Move {track.title} down" title="Move down">
                                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6z"/></svg>
                                        </button>
                                        <button class="icon-button delete-button" onclick={(e) => { e.stopPropagation(); removeFromOpenPlaylist(track); }} aria-label="Remove {track.title} from the playlist" title="Remove from playlist">
                                            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>
    {/if}
    {#if !openPlaylist && sortedPlaylists.length > 0}
        <p class="empty playlist-placeholder">Pick a playlist to see and change its tracks.</p>
    {/if}
    </div>
</div>

{#snippet playlistSelect(value: string, onchange: (id: string) => void, emptyLabel: string, label: string)}
    {@const missing = value !== '' && !playlistIds.has(value)}
    <select class="playlist-select" class:invalid={missing} aria-label={label} {value} onchange={(e) => onchange(e.currentTarget.value)}>
        <option value="">{missing ? '(deleted playlist)' : emptyLabel}</option>
        {#each sortedPlaylists as playlist (playlist.id)}
            <option value={playlist.id}>{playlist.name} ({trackCount(playlist.trackIds.length)})</option>
        {/each}
    </select>
{/snippet}

<div class="panel presets-panel tab-panel" id="music-tab-presets" role="tabpanel" tabindex="0" aria-labelledby="music-tab-button-presets" hidden={tab !== 'presets'}>
    <div class="panel-header">
        <h2>Music Presets</h2>
        <button class="save" disabled={!presetsDirty || savingPresets} onclick={savePresets}>{savingPresets ? 'Saving...' : 'Save changes'}</button>
    </div>
    <p class="description">Playlists shown on the music strip in the mixer, in place of Spotify's when the music player is running there. Each always plays shuffled, and remembers its place in the shuffle: switching back to a playlist carries on with tracks it hasn't played yet, rather than repeating ones it has, until it's been through them all.<br/>An ambient adaptive playlist has a playlist for each phase: it plays the one for the current phase, and fades out to the next phase's whenever the games' phase changes. Leave a phase empty to keep playing whatever was on through it.<br/>A day &amp; night playlist has a playlist for the day and one for the night. The day one only plays while a game's countdown is running; the rest of the day (the morning before it's started, a pause, and dusk) is silent, and it picks up again by itself when the countdown starts or night falls. Leave one empty to keep that time silent too.</p>
    {#if data.library.playlists.length === 0}
        <p class="empty">Make a playlist on the Playlists tab first.</p>
    {/if}
    <div class="data-table-scroll">
        <table class="data-table presets-table">
            <tbody>
                <tr class="presets-header">
                    <th>Name</th>
                    <th></th>
                    <th>Playlist</th>
                    <th></th>
                </tr>
                {#each presetRows as row, i (row.id)}
                    <tr class="preset-row">
                        <td class="preset-name-cell">
                            <input class="preset-name-input" type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} bind:value={row.name} placeholder={PRESET_KIND_LABELS[row.kind]}/>
                        </td>
                        <td class="phase-icons">
                            {#if row.kind !== 'single'}
                                <div class="phase-stack">
                                    {#each row.kind === 'phase' ? TIMES_OF_DAY : COUNTDOWN_PHASES as t}
                                        <span class="phase-icon" title={row.kind === 'phase' ? TIME_OF_DAY_LABELS[t as TimeOfDay] : COUNTDOWN_LIST_LABELS[t as CountdownPhase]}><TimeOfDayIcon timeOfDay={t}/></span>
                                    {/each}
                                </div>
                            {/if}
                        </td>
                        <td class="preset-playlists">
                            {#if row.kind === 'phase'}
                                <div class="phase-stack">
                                    {#each TIMES_OF_DAY as t}
                                        {@render playlistSelect(row.phase[t], (id) => row.phase[t] = id, '(no change)', `${TIME_OF_DAY_LABELS[t]} playlist`)}
                                    {/each}
                                </div>
                            {:else if row.kind === 'countdown'}
                                <div class="phase-stack">
                                    {#each COUNTDOWN_PHASES as c}
                                        {@render playlistSelect(row.countdown[c], (id) => row.countdown[c] = id, '(silent)', `${COUNTDOWN_LIST_LABELS[c]} playlist`)}
                                    {/each}
                                </div>
                            {:else}
                                {@render playlistSelect(row.playlistId, (id) => row.playlistId = id, '(pick a playlist)', 'Playlist')}
                            {/if}
                        </td>
                        <td class="row-actions"><button class="icon-button delete-button" onclick={() => presetRows.splice(i, 1)} aria-label="Delete preset" title="Delete"><BinIcon size={18}/></button></td>
                    </tr>
                {/each}
                <tr class="presets-add-row">
                    <td colspan="4">
                        <div class="add-buttons">
                            <button class="add" onclick={() => presetRows.push(newPresetRow('single'))}>Add {PRESET_KIND_LABELS.single}</button>
                            <button class="add" onclick={() => presetRows.push(newPresetRow('phase'))}>Add {PRESET_KIND_LABELS.phase}</button>
                            <button class="add" onclick={() => presetRows.push(newPresetRow('countdown'))}>Add {PRESET_KIND_LABELS.countdown}</button>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>

<div class="tab-panel" id="music-tab-spotify" role="tabpanel" tabindex="0" aria-labelledby="music-tab-button-spotify" hidden={tab !== 'spotify'}>
    <SpotifyPresetsEditor/>
</div>
</div>

{#if addMenu}
    {@const menu = addMenu}
    <div class="add-menu" class:above={menu.above} style:left="{menu.left}px" style:top="{menu.top}px"
        role="dialog" aria-label="Add {menu.label} to a playlist" tabindex="-1" bind:this={addMenuEl}>
        <div class="add-menu-title">Add <strong>{menu.label}</strong> to</div>
        <div class="add-menu-list" role="group" aria-label="Playlists">
            {#each sortedPlaylists as playlist (playlist.id)}
                {@const state = membership(playlist, menu.trackIds)}
                <button class="add-menu-item" role="checkbox" aria-checked={state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false'}
                    onclick={() => toggleMembership(playlist, menu.trackIds)}
                    title={state === 'all' ? `Take ${menu.trackIds.length === 1 ? 'it' : 'them'} off ${playlist.name}` : `Add to ${playlist.name}`}>
                    <span class="checkbox" class:checked={state === 'all'} class:mixed={state === 'some'} aria-hidden="true">
                        {#if state === 'all'}
                            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>
                        {:else if state === 'some'}
                            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M5 11h14v2H5z"/></svg>
                        {/if}
                    </span>
                    <span class="add-menu-name">{playlist.name}</span>
                    <span class="add-menu-count">{playlistTrackIds(playlist).length}</span>
                </button>
            {:else}
                <p class="add-menu-empty">No playlists yet. Make one:</p>
            {/each}
        </div>
        <form class="add-menu-new" onsubmit={(e) => { e.preventDefault(); createPlaylistFromMenu(menu.trackIds); }}>
            <input type="text" maxlength={MUSIC_TEXT_MAX_LENGTH} placeholder="New playlist" aria-label="New playlist name" bind:value={menuPlaylistName} disabled={menuCreating}/>
            <button type="submit" class="save" disabled={menuCreating} title="Make a new playlist with {menu.trackIds.length === 1 ? 'this track' : 'these tracks'} on it">{menuCreating ? '...' : 'Create'}</button>
        </form>
    </div>
{/if}

<!-- Outside the tabs, so it stays (and keeps playing) whichever tab is showing -->
<div class="now-playing">
    {@render artwork(playingTrack ? albumOf(playingTrack) : null, 'small')}
    <div class="now-playing-body">
        <div class="now-playing-title">
            {#if playingTrack}
                <span class="track-title">{playingTrack.title}</span>
                <span class="track-sub">{[playingTrack.artist || 'Unknown Artist', albumOf(playingTrack)?.title].filter(Boolean).join(' · ')}</span>
            {:else}
                <span class="track-sub">Nothing playing</span>
            {/if}
        </div>
        <div class="now-playing-controls">
            <button class="skip" onclick={() => step(-1)} disabled={queueIndex <= 0} aria-label="Previous track" title="Previous">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
            </button>
            <div class="player"><MusicPreviewPlayer bind:this={player} url={playingTrack ? `/api/resources/${playingTrack.file}` : null} gainDb={playingGainDb} onended={() => step(1)}/></div>
            <button class="skip" onclick={() => step(1)} disabled={queueIndex < 0 || queueIndex >= queue.length - 1} aria-label="Next track" title="Next">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
        </div>
    </div>
</div>

</div>


<style>
    /* ---- Music presets ---- */

    input.preset-name-input {
        width: 100%;
        min-width: 10em;
        box-sizing: border-box;
    }

    select.playlist-select {
        width: 100%;
        min-width: 14em;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    select.playlist-select.invalid {
        border-color: #d55;
    }

    td.preset-playlists {
        width: 50%;
    }

    /* The icons and the selects are stacked in neighbouring cells; the same item height keeps each icon level with its select. */
    .phase-stack {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .phase-stack > * {
        height: 2rem;
        box-sizing: border-box;
    }

    td.phase-icons {
        width: 1px; /* Shrink to the icons */
        padding-left: 0;
        padding-right: 0;
    }

    .phase-icon {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .add-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .add-buttons button {
        flex: 1;
    }

    /* The tabs along the top, the showing tab scrolling in the space between, and the player along the bottom */
    .music-page {
        height: 100%;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .tab-bar {
        flex-shrink: 0;
        display: flex;
        gap: 0.25rem;
        padding: 0.75rem 1.5rem 0;
        border-bottom: 1px solid var(--theme-bg-tertiary);
        overflow-x: auto;
    }

    .tab-bar button {
        display: flex;
        align-items: center;
        gap: 0.5em;
        padding: 0.6em 1.2em;
        font-size: 1rem;
        background: none;
        color: var(--theme-on-bg);
        border: none;
        border-bottom: 3px solid transparent;
        border-radius: 6px 6px 0 0;
        opacity: 0.7;
        white-space: nowrap;
    }

    .tab-bar button:hover {
        opacity: 1;
        background-color: var(--theme-bg-secondary);
    }

    .tab-bar button.selected {
        opacity: 1;
        border-bottom-color: var(--theme-highlight);
        font-weight: bold;
    }

    .tab-count {
        font-size: 0.75em;
        font-weight: normal;
        padding: 0.1em 0.55em;
        border-radius: 999px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    .tab-content {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding: 1.5rem;
    }

    /* (Hidden rather than taken out, so a tab keeps its scroll, open forms and the like while another shows) */
    .tab-panel[hidden] {
        display: none;
    }

    /* Focusable, for keyboard users moving on from the tabs; a click needs no ring round the whole panel */
    .tab-panel:focus:not(:focus-visible) {
        outline: none;
    }

    /* The playlists on one side, the one that's open on the other */
    .playlists-columns {
        display: grid;
        grid-template-columns: minmax(14rem, 22rem) minmax(0, 1fr);
        gap: 1.5rem;
        align-items: start;
    }

    .playlist-placeholder {
        margin: 0;
        padding: 2rem 1rem;
        text-align: center;
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        min-width: 0;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .panel.drop-active {
        border: 2px dashed var(--theme-highlight);
    }

    .panel-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem 1.5rem;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .empty {
        font-style: italic;
        opacity: 0.7;
    }

    input, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus {
        outline: 2px solid var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button.highlight {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    button.save {
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    button.add {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add:hover {
        border-color: var(--theme-highlight);
    }

    .small-button {
        font-size: 0.85em;
        padding: 0.3em 0.7em;
        white-space: nowrap;
    }

    /* Looks like the other "+" buttons; it's a label so clicking it opens the (hidden) file picker. */
    label.add-upload {
        padding: 0.4em 1em;
        border: 2px dashed var(--theme-slider-trim);
        border-radius: 4px;
        cursor: pointer;
        color: var(--theme-on-bg-secondary);
    }

    label.add-upload:hover {
        border-color: var(--theme-highlight);
    }

    label.add-upload.disabled, label.upload-label.disabled {
        opacity: 0.5;
        cursor: progress;
    }

    label.add-upload input, label.upload-label input {
        display: none;
    }

    label.upload-label {
        display: inline-block;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        cursor: pointer;
        text-align: center;
    }

    label.upload-label:hover {
        border-color: var(--theme-highlight);
    }

    /* ---- Now playing ---- */

    .now-playing {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border-top: 1px solid var(--theme-bg-tertiary);
        box-shadow: 0 -6px 24px var(--theme-shadow);
    }

    .now-playing-body {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
    }

    .now-playing-title {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .now-playing-controls {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .now-playing-controls .player {
        flex: 1;
        min-width: 0;
    }

    button.skip {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        flex-shrink: 0;
    }

    /* ---- Artwork ---- */

    .artwork {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
    }

    .artwork.small {
        width: 3.5rem;
        height: 3.5rem;
    }

    .artwork.large {
        width: 100%;
        aspect-ratio: 1;
    }

    .artwork img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .artwork svg {
        width: 45%;
        height: 45%;
        opacity: 0.5;
    }

    /* ---- Library ---- */

    .library-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .view-tabs {
        display: flex;
    }

    .view-tabs button {
        border-radius: 0;
    }

    .view-tabs button:first-child {
        border-radius: 4px 0 0 4px;
    }

    .view-tabs button:last-child {
        border-radius: 0 4px 4px 0;
    }

    .view-tabs button + button {
        border-left: none;
    }

    input.search {
        flex: 1;
        min-width: 10em;
    }

    .artist-group {
        border-top: 1px solid var(--theme-bg-tertiary);
        padding: 0.4rem 0;
    }

    .artist-group summary {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 0.2em 0.8em;
        padding: 0.4rem 0;
        cursor: pointer;
        list-style: none;
    }

    .artist-group summary::-webkit-details-marker {
        display: none;
    }

    .artist-group summary::before {
        content: '▸';
        display: inline-block;
        width: 1em;
        transition: transform 0.15s;
    }

    .artist-group[open] summary::before {
        transform: rotate(90deg);
    }

    .artist-name {
        font-size: 1.15rem;
        font-weight: bold;
        color: var(--theme-on-bg);
    }

    .artist-sub, .album-sub, .playlist-sub, .track-sub {
        font-size: 0.85em;
        opacity: 0.7;
    }

    .album-block {
        margin: 0.5rem 0 1.25rem;
    }

    .album-header {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        margin-bottom: 0.5rem;
    }

    .album-heading {
        flex: 1;
        min-width: 0;
    }

    .album-title {
        font-weight: bold;
        overflow-wrap: anywhere;
    }

    .album-actions {
        display: flex;
        align-items: center;
        gap: 0.4rem;
    }

    .album-form {
        display: grid;
        grid-template-columns: 10rem 1fr;
        gap: 1rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
        border-radius: 8px;
        background-color: var(--theme-bg-tertiary);
    }

    .album-form-artwork {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .artwork-buttons {
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }

    .album-form-fields {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
    }

    .form-note {
        margin: 0;
        font-size: 0.85em;
        font-style: italic;
        opacity: 0.8;
    }

    .album-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
        gap: 1rem;
    }

    button.album-card {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.2rem;
        padding: 0.5rem;
        text-align: left;
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border-color: transparent;
        border-radius: 8px;
    }

    button.album-card:hover {
        border-color: var(--theme-highlight);
    }

    button.album-card .artwork {
        margin-bottom: 0.3rem;
    }

    button.back {
        margin-bottom: 0.75rem;
    }

    .tracks-view-actions {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.5rem;
    }

    /* ---- Track tables ---- */

    .track-row {
        cursor: pointer;
    }

    /* The track loaded in the player: its title in the app's highlight colour */
    tr.track-row.selected .track-title {
        color: var(--theme-highlight);
    }

    tr.track-row.dragging td {
        opacity: 0.4;
    }

    .title-cell {
        overflow-wrap: anywhere;
    }

    .title-cell .track-sub {
        display: block;
    }

    .now-playing-title .track-title, .now-playing-title .track-sub {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .now-playing-title .track-title {
        font-weight: bold;
    }

    td.play-cell, td.number-cell, td.duration-cell, td.loudness-cell {
        width: 1px; /* Shrink to the content */
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
    }

    td.number-cell, td.duration-cell, td.loudness-cell {
        text-align: right;
        opacity: 0.8;
    }

    td.loudness-cell {
        font-size: 0.85em;
        opacity: 0.6;
    }

    button.play-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.1em;
        border: none;
        outline: none;
        background: none;
        color: inherit;
        vertical-align: middle;
    }

    button.play-button:focus-visible {
        outline: 2px solid var(--theme-highlight); /* Keep a focus ring for keyboard users */
    }

    .row-actions {
        width: 1px;
        white-space: nowrap;
        text-align: right;
    }

    button.icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.3em;
        vertical-align: middle;
    }

    .row-actions button.icon-button + button.icon-button {
        margin-left: 0.3em;
    }

    button.icon-button.delete-button:hover {
        border-color: var(--theme-error);
        color: var(--theme-error);
    }

    button.icon-button.edit-button.active {
        border-color: var(--theme-highlight);
        color: var(--theme-highlight);
    }

    tr.details-row td {
        background-color: var(--theme-bg-tertiary);
    }

    .details-form {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12em, 1fr));
        gap: 0.6em 1em;
        padding: 0.3em 0;
    }

    .details-field {
        display: flex;
        flex-direction: column;
        gap: 0.2em;
        font-size: 0.9em;
    }

    .details-field.wide {
        grid-column: 1 / -1;
    }

    .details-field input {
        width: 100%;
        box-sizing: border-box;
    }

    .loudness-input {
        display: flex;
        gap: 0.3em;
    }

    .loudness-input input {
        flex: 1;
        min-width: 0;
    }

    .remeasure-button {
        flex: none;
        width: 2.2em;
        line-height: 1;
    }

    .remeasure-button.spinning {
        animation: remeasure-spin 1s linear infinite;
    }

    @keyframes remeasure-spin {
        to { transform: rotate(360deg); }
    }

    .details-actions {
        grid-column: 1 / -1;
        display: flex;
        justify-content: flex-end;
        gap: 0.5em;
    }

    /* ---- The "add to playlist" popup ---- */

    .add-menu {
        position: fixed;
        z-index: 500;
        width: 272px; /* Keep in step with ADD_MENU_WIDTH_PX */
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.75rem;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 10px;
        box-shadow: 0 8px 28px var(--theme-shadow), 0 2px 6px #0006;
    }

    /* Opened above its button: anchored by its bottom edge */
    .add-menu.above {
        transform: translateY(-100%);
    }

    .add-menu:focus {
        outline: none;
    }

    .add-menu-title {
        font-size: 0.85em;
        opacity: 0.8;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .add-menu-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 14rem;
        overflow-y: auto;
    }

    button.add-menu-item {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.45em 0.5em;
        text-align: left;
        background: none;
        color: inherit;
        border: 1px solid transparent;
        border-radius: 6px;
    }

    button.add-menu-item:hover, button.add-menu-item:focus-visible {
        background-color: var(--theme-bg-tertiary);
        border-color: transparent;
    }

    .checkbox {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.1rem;
        height: 1.1rem;
        border: 2px solid var(--theme-slider-trim);
        border-radius: 4px;
    }

    .checkbox.checked, .checkbox.mixed {
        background-color: var(--theme-highlight);
        border-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .add-menu-name {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .add-menu-count {
        font-size: 0.8em;
        opacity: 0.6;
        font-variant-numeric: tabular-nums;
    }

    .add-menu-empty {
        margin: 0.2rem 0;
        font-size: 0.9em;
        font-style: italic;
        opacity: 0.7;
    }

    .add-menu-new {
        display: flex;
        gap: 0.4rem;
        padding-top: 0.5rem;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    .add-menu-new input {
        flex: 1;
        min-width: 0;
    }

    .add-menu-new button.save {
        padding: 0.3em 0.8em;
    }

    button.icon-button.add-menu-trigger.active {
        border-color: var(--theme-highlight);
        color: var(--theme-highlight);
    }

    /* ---- Playlists ---- */

    .new-playlist {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .new-playlist input {
        flex: 1;
        min-width: 0;
    }

    .playlist-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    button.playlist-item {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1em;
        text-align: left;
        border-radius: 0;
    }

    .playlist-name {
        overflow-wrap: anywhere;
    }

    .playlist-sub {
        white-space: nowrap;
    }

    .playlist-editor {
        min-width: 0;
    }

    .playlist-editor-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
    }

    input.playlist-name-input {
        flex: 1;
        min-width: 0;
        font-size: 1.1rem;
        font-weight: bold;
    }

    @media (max-width: 900px) {
        /* Stacked: the open playlist under the list */
        .playlists-columns {
            grid-template-columns: minmax(0, 1fr);
        }
        .playlist-placeholder {
            display: none;
        }
    }

    @media (max-width: 560px) {
        .tab-content {
            padding: 0.75rem;
        }
        .tab-bar {
            padding: 0.5rem 0.75rem 0;
        }
        .tab-bar button {
            flex: 1;
            justify-content: center;
            padding: 0.6em 0.5em;
        }
        .panel {
            padding: 1rem;
        }
        .now-playing {
            padding: 0.6rem 0.75rem;
            gap: 0.75rem;
        }
        .description {
            margin-bottom: 1rem;
        }
        .album-form {
            grid-template-columns: 1fr;
        }
        .album-form-artwork {
            flex-direction: row;
            align-items: flex-start;
        }
        .album-form-artwork .artwork.large {
            width: 7rem;
        }

        /* Each preset becomes a card: the name and delete button on top, then its playlist(s) full width below */
        .presets-table tbody {
            display: block;
        }
        .presets-header {
            display: none;
        }
        tr.preset-row {
            display: grid;
            grid-template-columns: auto 1fr auto;
            grid-template-areas:
                "name name actions"
                "icons lists lists";
        }
        tr.preset-row td {
            border-top: none;
        }
        tr.preset-row td.preset-name-cell, tr.preset-row td.row-actions {
            border-top: 1px solid var(--theme-bg-tertiary);
        }
        tr.preset-row td.preset-name-cell {
            grid-area: name;
        }
        tr.preset-row td.row-actions {
            grid-area: actions;
            width: auto;
        }
        tr.preset-row td.phase-icons {
            grid-area: icons;
            width: auto;
            padding-left: 0.3em;
        }
        tr.preset-row td.preset-playlists {
            grid-area: lists;
            width: auto;
        }
        tr.presets-add-row, tr.presets-add-row td {
            display: block;
        }
        input.preset-name-input, select.playlist-select {
            min-width: 0;
        }
    }
</style>
