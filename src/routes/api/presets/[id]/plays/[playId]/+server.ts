import { json } from '@sveltejs/kit';
import { deletePresetPlay, getPresetPlay } from '$lib/resources/server/presets';

// The whole play, including its grim snapshot if it has one.
export async function GET({ params }) {
    const play = getPresetPlay(params.id, params.playId);
    if (!play) return json({ error: 'Play not found' }, { status: 404 });
    return json(play);
}

// Deletes the play and takes its win back off the preset's counts; responds with the updated preset.
export async function DELETE({ params }) {
    const preset = deletePresetPlay(params.id, params.playId);
    if (!preset) return json({ error: 'Play not found' }, { status: 404 });
    return json(preset);
}
