import { NO_CLOCK_SFX } from "$lib/audio/common/clockSfxPreset";
import type { LegacyResourceMapping } from "$lib/common/config";
import { isClocktowerModel, type ClocktowerModel } from "$lib/model/common/ClocktowerModel";
import { migrateLegacyClockSfx } from "./clock-sfx-presets";
import { JSONMultiResourceManager } from "./jsonResourceManager";
import { listResources, getResourceData } from "./resources";

/**
 * Upgrades, in place, a saved model from before clock SFX presets (when each clock picked its own bells via
 * config.resourceMapping), or from before the day/night phase was stored, so it validates. The upgraded model is written back on the clock's next autosave.
 */
function migrateLegacyModel(data: any) {
    if(typeof data !== 'object' || data === null) return;
    const config = data.config;
    if(typeof config === 'object' && config !== null && config.clockSfxPresetId === undefined){
        const mapping: Partial<LegacyResourceMapping> | undefined = config.resourceMapping;
        config.clockSfxPresetId = migrateLegacyClockSfx(
            mapping?.finalBell?.resource_id ?? null,
            mapping?.reminderBell?.resource_id ?? null
        );
        delete config.resourceMapping;
    }
    const audio = data.audio;
    if(typeof audio === 'object' && audio !== null && audio.sfx === undefined){
        audio.sfx = { ...NO_CLOCK_SFX }; // Filled in from the preset when the clock is loaded
        delete audio.resources;
    }
    if(typeof audio?.sfx === 'object' && audio.sfx !== null && audio.sfx.startUrl === undefined){
        audio.sfx.startUrl = null; // From before the start of day sound; also filled in when the clock is loaded
    }
    const clock = data.clock;
    if(typeof clock === 'object' && clock !== null && clock.timeOfDay === undefined){
        // From before the phase was stored: it was night once the timer had run out (or been ended)
        const time = clock.time;
        const ended = time?.duration === 0 ||
            (typeof time?.serverStartTime === 'number' && Date.now() - time.serverStartTime >= time.duration * 1000);
        clock.timeOfDay = ended ? 'night' : 'day';
    }
}

function isClocktowerModelMigrating(data: unknown): data is ClocktowerModel {
    migrateLegacyModel(data);
    return isClocktowerModel(data);
}

export const CLOCK_CONFIG_MANAGER = new JSONMultiResourceManager<ClocktowerModel>(
    'clock-config',
    isClocktowerModelMigrating,
    (m) => m.clock.clockId
);

// One-time migration from the old flat-file clockconfig resources, so existing clock instances aren't lost.
if (CLOCK_CONFIG_MANAGER.values.length === 0) {
    for (const resource of listResources('clockconfig')) {
        const data = getResourceData(resource);
        if (!data) continue;
        try {
            const model = JSON.parse(data.toString('utf-8'));
            if (isClocktowerModelMigrating(model)) {
                CLOCK_CONFIG_MANAGER.add(model);
                console.log(`Migrated legacy clock config for instance ${model.clock.clockId}`);
            }
        } catch (e) {
            console.warn(`Failed to migrate legacy clock config resource ${resource.id}`, e);
        }
    }
}
