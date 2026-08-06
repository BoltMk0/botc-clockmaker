import { isAudioResourceTrackModel, type AudioResourceTrackModel } from "./audioResourceTrackModel";

export interface AmbienceTrackModel extends AudioResourceTrackModel{
    activeInDay: boolean;
    activeAtNight: boolean;
}

export function isAmbienceTrackModel(data: any): data is AmbienceTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.activeInDay !== 'boolean') return false;
    if(typeof data.activeAtNight !== 'boolean') return false;
    if(!isAudioResourceTrackModel(data)) return false;
    return true;
}
