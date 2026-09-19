import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state.js';

export async function load({ params }) {
    const instance = getBOTCTClockInstanceManager().getInstance(params.clockid);
    return {
        clockid: params.clockid,
        name: instance.model.config.teamName ?? params.clockid,
        hasGrim: get_grimoire_state_history_resource_for_clock(params.clockid) !== null
    };
}
