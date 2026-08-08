import { isClocktowerAudioTrackModel, type ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
import { getDefaultConfig, isConfig, type Config } from "$lib/common/config";
import { isClocktowerClockModel, type ClocktowerClockModel } from "./ClocktowerClockModel";

export type ClocktowerModel = {
    clock: ClocktowerClockModel;
    audio: ClocktowerAudioTrackModel;
    config: Config;
};

export function isClocktowerModel(data: any): data is ClocktowerModel {
    if(!isConfig(data.config)) { 
        return false; 
    }
    if(!isClocktowerClockModel(data.clock)){
        return false;
    }
    if(!isClocktowerAudioTrackModel(data.audio)){
        console.log("bad audio track");
        return false;
    }
    return true;
}

export function newClocktowerModel(id: string): ClocktowerModel {
    return {
        clock: {
            clockId: id,
            day: 0,
            numPlayers: 8,
            time: {
                duration: 60,
                serverStartTime: null
            }
        },
        audio: {
            pan: 0,
            gain: 1,
            balance: 0,
            resources: {
                finalBell: null,
                reminderBell: null
            }
        },
        config: getDefaultConfig()
    }
}