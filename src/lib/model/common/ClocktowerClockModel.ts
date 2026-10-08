import { isTimeOfDay, type TimeOfDay } from "../client/types";

export type ClocktowerClockTimeModel =  {
    duration: number;
    ringBellWhen?: number;
    serverStartTime: number|null; // Start time of the clock relative to the server. if null, then the clock is not running.
};

function isClocktowerClockTimeModel(data: any): data is ClocktowerClockTimeModel {
    if(typeof data.duration !== 'number') return false;
    if(typeof data.serverStartTime !== 'number' && data.serverStartTime !== null) {
        return false;
    }
    if(data.ringBellWhen !== undefined){
        if(typeof data.ringBellWhen !== 'number'){
            return false;
        }
    }
    return true;
}

export type ClocktowerClockModel = {
    readonly clockId: string;
    numPlayers: number;
    time: ClocktowerClockTimeModel;
    day: number;
    /** The current phase. Set directly, or automatically: day when a timer is set up, night when it runs out. */
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