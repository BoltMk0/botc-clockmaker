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

/** What the remote sets every light Lightscapes sets to, in place of following the game. */
export type LightOverride = {
    color: { kind: 'rgb'; hex: string } | { kind: 'temp'; mireds: number };
    /** 1-254, as Zigbee lights take it. */
    brightness: number;
};

export function isLightOverride(data: any): data is LightOverride {
    if(typeof data !== 'object' || data === null) return false;
    if(typeof data.brightness !== 'number' || data.brightness < 1 || data.brightness > 254) return false;
    const color = data.color;
    if(typeof color !== 'object' || color === null) return false;
    if(color.kind === 'rgb') return typeof color.hex === 'string' && /^#[0-9a-f]{6}$/i.test(color.hex);
    if(color.kind === 'temp') return typeof color.mireds === 'number' && color.mireds > 0;
    return false;
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
    /** Set from the remote, the lights show this instead of following the game (bells included), until it's cleared. */
    lightOverride?: LightOverride;
};

export function isClocktowerClockModel(data: any): data is ClocktowerClockModel {
    if(typeof data.clockId !== 'string') return false;
    if(typeof data.numPlayers !== 'number') return false;
    if(typeof data.day !== 'number') return false;
    if(!isTimeOfDay(data.timeOfDay)) return false;
    if(data.lightOverride !== undefined && !isLightOverride(data.lightOverride)) return false;
    if(!isClocktowerClockTimeModel(data.time)){
        console.log("clock.time")
        return false;
    }
    console.log("clock is good")
    return true;
}