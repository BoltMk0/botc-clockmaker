import { isTimeOfDay, type TimeOfDay } from "$lib/model/client/types";
import { isAmbienceTrackModel, type AmbienceTrackModel } from "./ambienceTrackModel";
import { isAudioTrackGroupModel, type AudioTrackGroupModel } from "./audioTrackGroupModel.svelte";


export interface AmbienceEngineModel extends AudioTrackGroupModel<AmbienceTrackModel>{
    timeOfDay: TimeOfDay;
    playing: boolean;
}

export function isAmbienceEngineModel(data: any): data is AmbienceEngineModel {
    if(typeof data !== 'object') return false;
    if(!isTimeOfDay(data.timeOfDay)) return false;
    if(!isAudioTrackGroupModel(data, isAmbienceTrackModel)) return false;
    return true;
}

export function newAmbienceEngineModel(nTracks: number = 4): AmbienceEngineModel {
    return {
        playing: false,
        tracks: Array.from({length: nTracks}, ()=>({
            gain: 1, 
            pan: 0, 
            loadedResourceId: null,
            activeAtNight: true,
            activeInDay: true
        })),
        timeOfDay: 'day',
        gain: 1,
        pan: 0
    }
}