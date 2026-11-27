import { error } from '@sveltejs/kit';
import { backUrlFrom } from '$lib/common/backUrl';
import { getPresetPlay } from '$lib/resources/server/presets';
import { playSnapshotUrl } from '$lib/resources/common/presetPlays';

// A logged game's timing stats, going back to its grim snapshot by default
export async function load({ params, url }) {
    const play = getPresetPlay(params.presetId, params.playId);
    if (!play) error(404, 'Game not found');
    if (!play.grim?.phase_log?.length) error(404, 'This game has no timing stats');
    return { play, phaseLog: play.grim.phase_log, backUrl: backUrlFrom(url) ?? playSnapshotUrl(play) };
}
