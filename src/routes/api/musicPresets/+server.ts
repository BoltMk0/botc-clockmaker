import { isMusicPreset } from "$lib/audio/common/musicPreset";
import { getMusicPresets, saveMusicPresets } from "$lib/resources/server/musicPresets";
import { error, json } from "@sveltejs/kit";

export async function GET() {
    return json(getMusicPresets());
}

export async function POST({ request }) {
    const data = await request.json().catch(() => null);
    if (!Array.isArray(data) || !data.every(isMusicPreset)) {
        return error(400, { message: 'Invalid data - not a list of music presets (each needs an id, name and either a playlistId, or phasePlaylistIds (an ambient adaptive playlist) or countdownPlaylistIds (a day & night playlist) with at least one playlist)' });
    }
    saveMusicPresets(data);
    return new Response();
}
