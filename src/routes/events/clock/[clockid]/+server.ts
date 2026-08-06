import {produce, type Unsafe} from 'sveltekit-sse';
import { getBOTCTClockInstanceManager, InstanceNotFoundError } from "$lib/model/server/model";
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import type { AudioParams } from '$lib/common/AudioParams';
import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel.js';
import type { ClocktowerAudioTrackModel } from '$lib/audio/common/model/clocktowerAudioTrackModel.svelte.js';
import type { WSMessage } from '$lib/common/comms';
import type { BOTCTClock } from '$lib/model/server/BOTCClock';

export type emit_cb = (eventName: string, data: string)=>Unsafe<void, Error>;

class ClockInstanceCallbackHelper {
    private emitters: Map<string, emit_cb> = new Map();
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(public instanceId: string, private instance: BOTCTClock){
        console.log("Setting up instance callback manager for clock: ", instance.id)
        instance.on('modelUpdated', this.handleStateChanged.bind(this));
        // instance.on('dayChanged', this.handleDayChanged.bind(this));
        instance.on('bellRingRequest', this.handleBellRingRequest.bind(this));
        instance.on('audio', this.handleAudioParamsChanged.bind(this));
        this.syncInterval = setInterval(()=>{
            this.broadcast({type: 'sync', serverTime: Date.now() } as WSMessage);
        }, 500);
    }

    handleStateChanged(model: ClocktowerModel) {
        console.log("Model state changed");
        this.broadcast({
            type: 'clock',
            model: model
        });
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

    handleBellRingRequest() {
        this.broadcast({
            type: 'bellRingRequest',
            bell: 'final'
        });
    }

    handleAudioParamsChanged(model: ClocktowerAudioTrackModel) {
        console.log("Audio state changed");
        this.broadcast({
            type: 'clockAudioModel',
            model
        });
    }

    addEmitter(id: string, emit: emit_cb) {
        if(this.emitters.has(id)){
            console.warn(`Emitter with id ${id} already exists, overwriting.`);
        }
        this.emitters.set(id, emit)

        function send(msg: WSMessage){
            emit('message', JSON.stringify(msg));
        }

        // Send initial state to new emitter
        send({
            type: 'clock',
            model: this.instance.model
        });

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
    const {error} = emit('message', JSON.stringify({type: 'sync', serverTime: Date.now() }));
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