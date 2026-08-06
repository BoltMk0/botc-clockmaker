import {produce, type Unsafe} from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { AmbienceEngineHelper, getAmbienceEngineHelperInstance } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';


export type emit_cb = (eventName: string, data: string)=>Unsafe<void, Error>;

class AmbienceEngineListener extends SSEClientManager {
    emit_cbs = new Set<emit_cb>();
    constructor(readonly ambienceEngine: AmbienceEngineHelper){
        super();
        ambienceEngine.on('engineUpdate', (model)=>{
            this.broadcast({
                type: 'ambienceEngineUpdate',
                model
            })
        });
        ambienceEngine.on('trackUpdate', (index, model)=>{
            this.broadcast({
                type: 'ambienceTrackUpdate',
                index,
                model
            });
        })
    }
}

let ambienceEngineListenerInstance: AmbienceEngineListener|undefined = undefined;

function getManager(){
    if(!ambienceEngineListenerInstance){
        ambienceEngineListenerInstance = new AmbienceEngineListener(getAmbienceEngineHelperInstance());
    }
    return ambienceEngineListenerInstance;
}

export function POST({params}) {
    console.log("SSE client connecting...");
    const id = v7();
    const mgr = getManager();
    let unregisterClient: ()=>void;
    try {
        return produce(
            function start({emit}) {
                console.log("Client connected.", id);
                unregisterClient = mgr.addClient(emit);
                return ()=>{
                    unregisterClient();
                }
            },
            { 
                ping: 4000,
                stop(){
                    unregisterClient();
                    console.log("Client disconnected.", id)
                }
            },
        )
    } catch (err) {
        return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
    }
}