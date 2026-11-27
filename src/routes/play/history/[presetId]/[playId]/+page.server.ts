import { error } from '@sveltejs/kit';
import { backUrlFrom } from '$lib/common/backUrl';
import { getPresetPlay } from '$lib/resources/server/presets';

// A logged game's grim snapshot, going back to the list it was opened from (the game history by default)
export async function load({ params, url }) {
    const play = getPresetPlay(params.presetId, params.playId);
    if (!play) error(404, 'Game not found');
    if (!play.grim) error(404, 'This game has no grim snapshot');
    return { play, backUrl: backUrlFrom(url) ?? '/play/history' };
}
