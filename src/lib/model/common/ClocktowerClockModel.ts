import { isTimeOfDay, type TimeOfDay } from "../client/types";

export type ClocktowerClockTimeModel =  {
    duration: number;
    ringBellWhen?: number;
    serverStartTime: number|null; // Start time of the clock relative to the server. if null, then the clock is not running.
    /** The timer as last set up (duration and ringBellWhen), so the day can be set up again after it's ended. */
    setupDuration?: number;
    setupRingBellWhen?: number;
};

function isClocktowerClockTimeModel(data: any): data is ClocktowerClockTimeModel {
    if(typeof data.duration !== 'number') return false;
    if(typeof data.serverStartTime !== 'number' && data.serverStartTime !== null) {
        return false;
    }
    for(const key of ['ringBellWhen', 'setupDuration', 'setupRingBellWhen']){
        if(data[key] !== undefined && typeof data[key] !== 'number') return false;
    }
    return true;
}

export type ClocktowerClockModel = {
    readonly clockId: string;
    numPlayers: number;
    time: ClocktowerClockTimeModel;
    day: number;
    /**
     * The current phase. Set directly, or automatically: morning when a timer is set up or paused, day while it runs,
     * dusk when it runs out.
     */
    timeOfDay: TimeOfDay;
};

export function isClocktowerClockModel(data: any): data is ClocktowerClockModel {
    if(typeof data.clockId !== 'string') return false;
    if(typeof data.numPlayers !== 'number') return false;
    if(typeof data.day !== 'number') return false;
    if(!isTimeOfDay(data.timeOfDay)) return false;
    if(!isClocktowerClockTimeModel(data.time)){
        console.log("clock.time")
        return false;
    }
    console.log("clock is good")
    return true;
}