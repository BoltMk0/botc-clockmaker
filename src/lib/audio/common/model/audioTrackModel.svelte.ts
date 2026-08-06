export interface AudioTrackModel {
    gain: number;
    pan: number;
}

export function isAudioTrackModel(data: any): data is AudioTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.gain !== 'number') return false;
    if(typeof data.pan !== 'number') return false;
    return true;
}
