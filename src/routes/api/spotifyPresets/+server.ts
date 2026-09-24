import { isSpotifyPreset } from "$lib/audio/common/spotifyPreset";
import { getSpotifyPresets, saveSpotifyPresets } from "$lib/resources/server/spotifyPresets";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getSpotifyPresets());
}

export async function POST({ request }) {
    const data = await request.json().catch(() => null);
    if (!Array.isArray(data) || !data.every(isSpotifyPreset)) {
        return error(400, { message: 'Invalid data - not a list of Spotify presets (each needs an id, name and either an album/playlist URI or day and night URIs)' });
    }
    saveSpotifyPresets(data);
    return new Response();
}
