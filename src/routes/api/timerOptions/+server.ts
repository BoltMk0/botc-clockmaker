import { getDefaultTimerOptions, isTimerOption, type TimerOption } from "$lib/common/timerOption";
import { getMimeTypeForExtension } from "$lib/common/util";
import { encodeResourceId, findResourceById, getResourceData, saveResource } from "$lib/resources/server/resources";
import { error, json } from "@sveltejs/kit";

const resId = encodeResourceId('appconfig', 'timer_options', getMimeTypeForExtension('.json'));

function saveTimerOptions(options: TimerOption[]){
    const data = Buffer.from(JSON.stringify(options), 'utf-8');
    saveResource(resId, data);
}

function loadTimerOptions(): TimerOption[] | null{
    const res = findResourceById(resId);
    if(res){
        let data = getResourceData(res);
        if(data){
            return JSON.parse(data.toString('utf-8'));
        }
    }
    return null;
}

export async function GET(){
    const timerOptions = loadTimerOptions();
    if(timerOptions){
        return json(timerOptions)
    } else {
        const newTimerOptions = getDefaultTimerOptions();
        saveTimerOptions(newTimerOptions);
        return json(newTimerOptions);
    }
}

export async function POST({request}){
    const data = await request.json();
    if(Array.isArray(data)){
        for(const item of data){
            if(!isTimerOption(item)) return error(400, {message: 'Invalid data - not valid timer options'});
        }
    }
    saveTimerOptions(data);
    return new Response();
}

