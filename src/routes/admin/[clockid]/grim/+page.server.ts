import { redirect } from '@sveltejs/kit';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { getTextOptions } from '$lib/resources/server/textOptions';
import { getMessagePresets } from '$lib/resources/server/messagePresets';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { isGrimoireStateHistory, type GrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { getMusicPresets } from '$lib/resources/server/musicPresets';
import { getSpotifyPresets } from '$lib/resources/server/spotifyPresets';

export async function load({ params }) {
    const clockid = params.clockid;
    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    const timerOptions = getTimerOptions();

    const rawGrimoireState = get_grimoire_state_history_resource_for_clock(clockid) as GrimoireStateHistory | null;
    const grimoireState = isGrimoireStateHistory(rawGrimoireState) ? rawGrimoireState : null;

    // A deleted grim must not be reachable (e.g. via browser back); send them to pick what to do next.
    if (!grimoireState) throw redirect(302, `/play`);

    return {
        clockid,
        model: clock.model,
        grimoireState,
        timerOptions,
        textOptions: getTextOptions(),
        messagePresets: getMessagePresets(),
        musicPresets: getMusicPresets(),
        spotifyPresets: getSpotifyPresets()
    };
}
