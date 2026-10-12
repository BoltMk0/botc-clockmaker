import type { SyncMessage } from "$lib/common/comms";
import { BOTCTimeTypeNow, type BOTCTimeType } from "./botcTime";

export class ServerDeltaTimeManager {
    #deltaToServerTime: number[] = [];
    #avgDeltaToServerTime: number = 0;

    deltaToServerTime: number = $state(0);

    handleSyncMessage(msg: SyncMessage){
        let delta = Date.now() - msg.serverTime;

        this.#deltaToServerTime.push(delta);
        if(this.#deltaToServerTime.length > 50) {
            this.#deltaToServerTime.shift();
        }

        const avgDelta = this.#deltaToServerTime.reduce((a, b) => a + b, 0) / this.#deltaToServerTime.length;
        // Filter out anything outside of 1 standard deviation
        const mean = avgDelta;
        const stdDev = Math.sqrt(this.#deltaToServerTime.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / this.#deltaToServerTime.length);
        let filteredTimes = this.#deltaToServerTime.filter(x => Math.abs(x - mean) <= stdDev);
        this.#avgDeltaToServerTime = filteredTimes.reduce((a, b) => a + b, 0) / filteredTimes.length;
        this.deltaToServerTime = Math.min(...filteredTimes)
        // console.log("Clock sync: average delta to server time (ms):", this.avgDeltaToServerTime, " min delta (ms):", this.minDeltaToServerTime);
    }

    /** Converts any given time type to the time on the local device (client) */
    toLocalTime(t: BOTCTimeType): BOTCTimeType{
        let time = t.reference === 'server' ? t.time + this.deltaToServerTime : t.time;
        return {time: time, reference: 'local'};
    }

    /** Converts any given time type to the estimated time on the server */
    toServerTime(t: BOTCTimeType): BOTCTimeType{
        let time = t.reference === 'local' ? t.time - this.deltaToServerTime : t.time;
        return {time: time, reference: 'server'};
    }

    /** Subtracts two times (regardless of ref) to get delta */
    subtract(a: BOTCTimeType, b: BOTCTimeType): number {
        let a_time = a.reference === 'server' ? a.time + this.deltaToServerTime : a.time;
        let b_time = b.reference === 'server' ? b.time + this.deltaToServerTime : b.time;
        return a_time - b_time;
    }

    now(): BOTCTimeType {
        return BOTCTimeTypeNow();
    }

    serverNow(): BOTCTimeType {
        return this.toServerTime(BOTCTimeTypeNow());
    }

    when(time: BOTCTimeType, callback: ()=>void){
        let delay = this.subtract(time, this.now());
        const timeoutId = setTimeout(callback, delay);
        return ()=>{clearTimeout(timeoutId)}
    }
};