import { redirect } from '@sveltejs/kit';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { getCustomMessages } from '$lib/resources/server/customMessages';
import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { isGrimoireStateHistory, type GrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { listResources } from '$lib/resources/server/resources';

export async function load({ params }) {
    const clockid = params.clockid;
    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    const timerOptions = getTimerOptions();
    const customMessages = getCustomMessages();
    const hasStings = listResources('sting').length > 0;

    const rawGrimoireState = get_grimoire_state_history_resource_for_clock(clockid) as GrimoireStateHistory | null;
    const grimoireState = isGrimoireStateHistory(rawGrimoireState) ? rawGrimoireState : null;

    // A deleted grim must not be reachable (e.g. via browser back); send them to pick what to do next.
    if (!grimoireState) throw redirect(302, `/admin/${clockid}/storytell`);

    return {
        clockid,
        model: clock.model,
        grimoireState,
        timerOptions,
        customMessages,
        hasStings
    };
}
