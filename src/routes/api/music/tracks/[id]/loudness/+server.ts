import { error, json } from '@sveltejs/kit';
import { getMusicTrack } from '$lib/resources/server/musicLibrary';
import { FfmpegUnavailableError, remeasureMusicLoudness } from '$lib/resources/server/musicLoudness';

/** Measures the track's loudness again (ahead of any others waiting) and records it. Returns { loudness } (LUFS, or null if it couldn't be measured). */
export async function POST({ params }){
    if(!getMusicTrack(params.id)) return error(404, { message: 'Track not found' });
    try {
        return json({ loudness: await remeasureMusicLoudness(params.id) });
    } catch(e) {
        if(e instanceof FfmpegUnavailableError) return error(503, { message: e.message });
        return error(404, { message: e instanceof Error ? e.message : String(e) });
    }
}
