import { getSpotifyHelperInstance } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { error, json } from '@sveltejs/kit';

/** An album/playlist's name and tracks, to pick one to start with: ?uri=spotify:playlist:ID. Returns { name, tracks }. */
export async function GET({ url }) {
    const uri = url.searchParams.get('uri');
    if (!uri) return error(400, { message: 'Expected ?uri' });
    try {
        const { name, tracks } = await getSpotifyHelperInstance().trackList(uri);
        return json({ name, tracks });
    } catch (e) {
        return error(502, { message: e instanceof Error ? e.message : String(e) });
    }
}
