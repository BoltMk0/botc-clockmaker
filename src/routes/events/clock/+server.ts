import {produce, type Unsafe} from 'sveltekit-sse';
import type { BellRingRequestMessage, ClockMessage, DayMessage, WSMessage } from '$lib/common/comms';

import { getBOTCTClockInstance } from "$lib/server/model";
import { v7 } from 'uuid';

export type emit_cb = (eventName: string, data: string)=>Unsafe<void, Error>;

console.log("Setting up SSE for clock...");

var emitters = new Map<string, emit_cb>();


function broadcast(message: WSMessage) {
    // console.log(`Broadcasting ${message.type} message to ${emitters.size} clients.`);
    const messageStr = JSON.stringify(message);
    for(const id of emitters.keys()){
        const emitter = emitters.get(id);
        if(emitter){
            const {error} = emitter('message', messageStr);
            if(error){
                console.error("Error emitting to client:", error);
                emitters.delete(id);
                console.log("Client disconnected.", id);
            }
        }
    }
}

getBOTCTClockInstance().on('stateChanged', (state: ClockMessage) => {
    broadcast(state);
});

getBOTCTClockInstance().on('dayChanged', (dayInfo: {day: number; max: number}) => {
    const message: DayMessage = {
        type: 'day',
        day: dayInfo.day,
        max: dayInfo.max
    };
    broadcast(message);
});

getBOTCTClockInstance().on('bellRingRequest', () => {
    const message: BellRingRequestMessage = {
        type: 'bellRingRequest',
        atTime: Date.now() + 500 // add slight delay to account for network latency
    };
    broadcast(message);
});

setInterval(()=>{
    broadcast({type: 'sync', serverTime: Date.now() } as WSMessage);
}, 500);

console.log("Hello from SSE server endpoint");

function sendSyncBurst(emit: emit_cb, count: number, interval: number = 100) {
    const {error} = emit('message', JSON.stringify({type: 'sync', serverTime: Date.now() } as WSMessage));
    if(error){
        console.error("Error emitting sync burst to client:", error);
        return;
    }
    if(count > 1){
        setTimeout(()=>{
            sendSyncBurst(emit, count - 1, interval);
        }, interval);
    }
}


export function POST() {
    console.log("SSE client connecting...");
    const id = v7();
    return produce(
        function start({emit}) {
            console.log("Client connected.", id);
            emitters.set(id, emit);
            emit('message', JSON.stringify(getBOTCTClockInstance().getState()));
            emit('message', JSON.stringify({type: 'day', ...getBOTCTClockInstance().day_info}));
            sendSyncBurst(emit, 5, 50);
        },
        { 
            ping: 4000,
            stop(){
                emitters.delete(id);
                console.log("Client disconnected.", id)
            }
        },
    )
}