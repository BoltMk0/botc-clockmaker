import { isClockSfxPlayback, type ClockSfxPlayback } from "../clockSfxPreset";
import { isAudioTrackModel, type AudioTrackModel } from "./audioTrackModel.svelte";


export interface ClocktowerAudioTrackModel extends AudioTrackModel {
    balance: number;
    /** Resolved by the server from the clock's SFX preset; clients never set it. */
    sfx: ClockSfxPlayback;
}

export function isClocktowerAudioTrackModel(data: any): data is ClocktowerAudioTrackModel {
    if(typeof data !== 'object') return false;
    if(typeof data.balance !== 'number') return false;
    if(!isClockSfxPlayback(data.sfx)) return false;
    if(!isAudioTrackModel(data)) return false;
    return true;
}
