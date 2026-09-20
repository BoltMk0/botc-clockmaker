import { produce } from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { getAudioDimHelperInstance, type AudioDimHelper } from '$lib/model/server/AudioDim/AudioDimHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';

class AudioDimListener extends SSEClientManager {
    constructor(readonly dim: AudioDimHelper) {
        super();
        dim.on('update', (model) => {
            this.broadcast({ type: 'audioDimUpdate', model });
        });
    }
}

let listenerInstance: AudioDimListener | undefined = undefined;

function getManager() {
    if (!listenerInstance) {
        listenerInstance = new AudioDimListener(getAudioDimHelperInstance());
    }
    return listenerInstance;
}

export function POST() {
    const id = v7();
    const mgr = getManager();
    let unregisterClient: () => void;
    try {
        return produce(
            function start({ emit }) {
                console.log("Audio dim SSE client connected.", id);
                // Send the current state straight away so a (re)connecting client resyncs
                unregisterClient = mgr.setupClient(emit, (send) => {
                    send({ type: 'audioDimUpdate', model: mgr.dim.model });
                });
                return () => {
                    unregisterClient();
                }
            },
            {
                ping: 4000,
                stop() {
                    unregisterClient();
                    console.log("Audio dim SSE client disconnected.", id)
                }
            },
        )
    } catch (err) {
        return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
    }
}
