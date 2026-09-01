import { getDefaultTimerOptions, isTimerOption, type TimerOption } from "$lib/common/timerOption";
import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, getResourceData, saveResource } from "./resources";

const resId = encodeResourceId('appconfig', 'timer_options', getMimeTypeForExtension('.json'));

export function saveTimerOptions(options: TimerOption[]){
    const data = Buffer.from(JSON.stringify(options), 'utf-8');
    saveResource(resId, data);
}

export function getTimerOptions(): TimerOption[]{
    const res = findResourceById(resId);
    if(res){
        let data = getResourceData(res);
        if(data){
            const parsed = JSON.parse(data.toString('utf-8'));
            if(Array.isArray(parsed) && parsed.every(option=>isTimerOption(option))) {
                return parsed;
            } else {
                console.warn('Failed to parse timer options from resource - invalid data');
            }
        }
    }
    return getDefaultTimerOptions();
}