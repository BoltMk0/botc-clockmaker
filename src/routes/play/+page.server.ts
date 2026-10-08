import { getBOTCTClockInstanceManager } from "$lib/model/server/model";
import { get_grimoire_state_history_resource_for_clock } from "$lib/resources/server/grimoire-state";
import { getScriptById } from "$lib/resources/server/scripts";
import { listClockSfxPresets } from "$lib/resources/server/clock-sfx-presets";

export async function load(){
    const manager = getBOTCTClockInstanceManager();
    const instances = manager.listInstances().map(instance => {
        const grim = get_grimoire_state_history_resource_for_clock(instance.clock.clockId);
        const script = grim?.scriptId ? getScriptById(grim.scriptId) : null;
        return { instance, scriptId: script?.id ?? null, scriptName: script?.name ?? null, hasGrim: grim !== null };
    });
    return { games: instances, clockSfxPresets: listClockSfxPresets() };
}
