import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { isGrimoireStateHistory, type GrimoireStateHistory } from '$lib/resources/common/grimoireState';

export async function load({ params }) {
    const clockid = params.clockid;
    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    const timerOptions = getTimerOptions();

    const rawGrimoireState = get_grimoire_state_history_resource_for_clock(clockid) as GrimoireStateHistory | null;
    const grimoireState = isGrimoireStateHistory(rawGrimoireState) ? rawGrimoireState : null;

    return {
        clockid,
        model: clock.model,
        grimoireState,
        timerOptions
    };
}
