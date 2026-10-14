import { isClocktowerAudioTrackModel, type ClocktowerAudioTrackModel } from "$lib/audio/common/model/clocktowerAudioTrackModel.svelte";
import { NO_CLOCK_SFX } from "$lib/audio/common/clockSfxPreset";
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

/** The timer (in seconds) a new game's first morning is set up with. */
export const NEW_GAME_TIMER_DURATION = 5 * 60;

export function newClocktowerModel(id: string): ClocktowerModel {
    return {
        clock: {
            clockId: id,
            day: 0,
            timeOfDay: 'dusk',
            numPlayers: 8,
            time: {
                duration: 0,
                serverStartTime: null,
                setupDuration: NEW_GAME_TIMER_DURATION
            }
        },
        audio: {
            pan: 0,
            gain: 1,
            balance: 0,
            sfx: { ...NO_CLOCK_SFX }
        },
        config: getDefaultConfig()
    }
}