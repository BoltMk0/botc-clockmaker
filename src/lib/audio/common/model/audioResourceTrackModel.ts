import { isResource, type Resource } from "$lib/resources/common/types";
import { isAudioTrackModel, type AudioTrackModel } from "./audioTrackModel.svelte";

export interface AudioResourceTrackModel extends AudioTrackModel{
    loadedResourceId: string|null;
}

export function isAudioResourceTrackModel(data: any): data is AudioResourceTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.loadedResourceId === 'string' || data.loadedResourceId === null ) return false;
    if(!isAudioTrackModel(data)) return false;
    return true;
}