import { isAudioTrackModel, type AudioTrackModel } from "./audioTrackModel.svelte";

export interface AudioTrackGroupModel<T extends AudioTrackModel = AudioTrackModel> extends AudioTrackModel {
    tracks: T[];
}

export function isAudioTrackGroupModel<T extends AudioTrackModel = AudioTrackModel>(data: any, trackCompareFn: (data: any)=>boolean = isAudioTrackModel): data is AudioTrackGroupModel<T> {
    if(typeof data !== 'object') return false;
    if(!Array.isArray(data.tracks)) return false;
    for(const t of data.tracks){
        if(!trackCompareFn(t)) return false;
    }
    if(!isAudioTrackModel(data)) return false;
    return true;
}
