import {produce, type Unsafe} from 'sveltekit-sse';
import type { AudioParamsMessage, BellRingRequestMessage, ClockMessage, DayMessage, PlayerCountMessage, WSMessage } from '$lib/common/comms';

import { BOTCTClock, getBOTCTClockInstanceManager, InstanceNotFoundError } from "$lib/model/server/model";
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import type { AudioParams } from '$lib/common/AudioParams';

export type emit_cb = (eventName: string, data: string)=>Unsafe<void, Error>;

class ClockInstanceCallbackHelper {
    private emitters: Map<string, emit_cb> = new Map();
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(public instanceId: string, private instance: BOTCTClock){
        instance.on('stateChanged', this.handleStateChanged.bind(this));
        instance.on('dayChanged', this.handleDayChanged.bind(this));
        instance.on('bellRingRequest', this.handleBellRingRequest.bind(this));
        instance.on('audioParamsChanged', this.handleAudioParamsChanged.bind(this));
        instance.on('playerCountChanged', this.handlePlayerCountChanged.bind(this));
        this.syncInterval = setInterval(()=>{
            this.broadcast({type: 'sync', serverTime: Date.now() } as WSMessage);
        }, 500);
    }

    handleStateChanged(state: ClockMessage) {
        this.broadcast(state);
    }

    broadcast(message: WSMessage) {
        const messageStr = JSON.stringify(message);
        for(const id of this.emitters.keys()){
            const emitter = this.emitters.get(id);
            if(emitter){
                const {error} = emitter('message', messageStr);
                if(error){
                    console.error("Error emitting to client:", error);
                    this.emitters.delete(id);
                    console.log("Client disconnected.", id);
                }
            }
        }
    }

    handleDayChanged(dayInfo: {day: number; max: number}) {
        const message: DayMessage = {
            type: 'day',
            day: dayInfo.day,
            max: dayInfo.max
        };
        this.broadcast(message);
    }

    handleBellRingRequest() {
        const message: BellRingRequestMessage = {
            type: 'bellRingRequest',
            atTime: Date.now() + 200 // add slight delay to account for network latency
        };
        this.broadcast(message);
    }

    handleAudioParamsChanged(params: AudioParams) {
        const message: AudioParamsMessage = {
            type: 'audioParams',
            gain: params.gain,
            pan: params.pan
        };
        this.broadcast(message);
    }

    handlePlayerCountChanged(playerCount: number){
        const message: PlayerCountMessage = {
            type: 'playerCount',
            playerCount: playerCount
        }
        this.broadcast(message);
    }

    addEmitter(id: string, emit: emit_cb) {
        if(this.emitters.has(id)){
            console.warn(`Emitter with id ${id} already exists, overwriting.`);
        }
        this.emitters.set(id, emit);
        // Send initial state to new emitter
        emit('message', JSON.stringify(this.instance.getState()));
        emit('message', JSON.stringify({type: 'day', ...this.instance.day_info}));
        emit('message', JSON.stringify({type: 'audioParams', ...this.instance.audioSettings}));
        emit('message', JSON.stringify({type: 'playerCount', playerCount: this.instance.playerCount}));
        console.log(`Added emitter with id: ${id}`);
    }

    removeEmitter(id: string) {
        console.log(`Removing emitter with id: ${id}`);
        this.emitters.delete(id);
    }
}

var helpers: Map<string, ClockInstanceCallbackHelper> = new Map();

function getHelperForInstance(instanceId: string): ClockInstanceCallbackHelper {
    if(!helpers.has(instanceId)){
        const instance = getBOTCTClockInstanceManager().getInstance(instanceId);
        helpers.set(instanceId, new ClockInstanceCallbackHelper(instanceId, instance));
    }
    return helpers.get(instanceId)!;
}

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

export function POST({params}) {
    console.log("SSE client connecting...");
    const id = v7();
    try {
        const helper = getHelperForInstance(params.clockid);
        return produce(
            function start({emit}) {
                console.log("Client connected.", id);
                helper.addEmitter(id, emit);
                sendSyncBurst(emit, 5, 50);
            },
            { 
                ping: 4000,
                stop(){
                    helper.removeEmitter(id);
                    console.log("Client disconnected.", id)
                }
            },
        )
    } catch (err) {
        if(err instanceof InstanceNotFoundError) {
            return error(404, `Clock instance not found: ${params.clockid}`);
        } else {
            return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
}