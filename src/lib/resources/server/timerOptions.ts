import { getDefaultTimerOptions, isTimerOption, type TimerOption } from "$lib/common/timerOption";
import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, getResourceData } from "./resources";
import { JSONSingletonResourceManager } from "./jsonResourceManager";

function isTimerOptionList(data: any): data is TimerOption[] {
    return Array.isArray(data) && data.every(isTimerOption);
}

const TIMER_OPTIONS_MANAGER = new JSONSingletonResourceManager<TimerOption[]>('timer_options', isTimerOptionList);

// One-time migration from the old flat-file appconfig resource, so existing timer options aren't lost.
if (TIMER_OPTIONS_MANAGER.value === null) {
    const legacyId = encodeResourceId('appconfig', 'timer_options', getMimeTypeForExtension('.json'));
    const legacyResource = findResourceById(legacyId);
    const legacyData = legacyResource && getResourceData(legacyResource);
    if (legacyData) {
        try {
            const options = JSON.parse(legacyData.toString('utf-8'));
            if (isTimerOptionList(options)) {
                TIMER_OPTIONS_MANAGER.save(options);
                console.log("Migrated legacy timer options");
            }
        } catch (e) {
            console.warn("Failed to migrate legacy timer options resource", e);
        }
    }
}

export function saveTimerOptions(options: TimerOption[]) {
    TIMER_OPTIONS_MANAGER.save(options);
}

export function getTimerOptions(): TimerOption[] {
    return TIMER_OPTIONS_MANAGER.value ?? getDefaultTimerOptions();
}
