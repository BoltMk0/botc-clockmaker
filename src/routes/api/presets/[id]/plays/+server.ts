import { json } from '@sveltejs/kit';
import { isPlayDate, isPresetWinner } from '$lib/resources/common/presetPlays';
import { getPreset, listPresetPlays, recordPresetVictory, summarisePresetPlay } from '$lib/resources/server/presets';

// The preset's logged plays, most recent first, without their grim snapshots.
export async function GET({ params }) {
    if (!getPreset(params.id)) return json({ error: 'Preset not found' }, { status: 404 });
    return json(listPresetPlays(params.id).map(summarisePresetPlay));
}

// Logs a game by hand: `{ date: 'YYYY-MM-DD', winner: 'good' | 'evil' }`. There's no grim snapshot for these.
export async function POST({ params, request }) {
    const body = await request.json().catch(() => null);
    if (!body) return json({ error: 'Invalid JSON body' }, { status: 400 });
    if (!isPlayDate(body.date)) return json({ error: 'date must be a YYYY-MM-DD date' }, { status: 400 });
    if (!isPresetWinner(body.winner)) return json({ error: 'winner must be "good" or "evil"' }, { status: 400 });

    const recorded = recordPresetVictory(params.id, body.winner, { date: body.date });
    if (!recorded) return json({ error: 'Preset not found' }, { status: 404 });
    return json({ preset: recorded.preset, play: summarisePresetPlay(recorded.play) }, { status: 201 });
}
