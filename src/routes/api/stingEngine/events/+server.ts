import { produce } from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { StingEngineHelper, getStingEngineHelperInstance } from '$lib/model/server/StingEngine/StingEngineHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';

class StingEngineListener extends SSEClientManager {
    constructor(readonly stingEngine: StingEngineHelper) {
        super();
        stingEngine.on('engineUpdate', (model) => {
            this.broadcast({
                type: 'stingEngineUpdate',
                model
            });
        });
        stingEngine.on('trackUpdate', (index, model) => {
            this.broadcast({
                type: 'stingTrackUpdate',
                index,
                model
            });
        });
        stingEngine.on('trigger', (slot) => {
            this.broadcast({
                type: 'stingTrigger',
                slot
            });
        });
    }
}

let stingEngineListenerInstance: StingEngineListener | undefined = undefined;

function getManager() {
    if (!stingEngineListenerInstance) {
        stingEngineListenerInstance = new StingEngineListener(getStingEngineHelperInstance());
    }
    return stingEngineListenerInstance;
}

export function POST({ params }) {
    console.log("Sting engine SSE client connecting...");
    const id = v7();
    const mgr = getManager();
    let unregisterClient: () => void;
    try {
        return produce(
            function start({ emit }) {
                console.log("Client connected.", id);
                // Send the current state straight away so a (re)connecting client resyncs
                unregisterClient = mgr.setupClient(emit, (send) => {
                    send({ type: 'stingEngineUpdate', model: mgr.stingEngine.model });
                });
                return () => {
                    unregisterClient();
                }
            },
            {
                ping: 4000,
                stop() {
                    unregisterClient();
                    console.log("Client disconnected.", id)
                }
            },
        )
    } catch (err) {
        return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
    }
}
