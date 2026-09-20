import { produce } from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { getSpotifyHelperInstance, type SpotifyHelper } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';

class SpotifyListener extends SSEClientManager {
    constructor(readonly spotify: SpotifyHelper) {
        super();
        spotify.on('update', (model) => {
            this.broadcast({ type: 'spotifyUpdate', model });
        });
    }
}

let listenerInstance: SpotifyListener | undefined = undefined;

function getManager() {
    if (!listenerInstance) {
        listenerInstance = new SpotifyListener(getSpotifyHelperInstance());
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
                console.log("Spotify SSE client connected.", id);
                // Send the current state straight away so a (re)connecting client resyncs
                unregisterClient = mgr.setupClient(emit, (send) => {
                    send({ type: 'spotifyUpdate', model: mgr.spotify.model });
                });
                return () => {
                    unregisterClient();
                }
            },
            {
                ping: 4000,
                stop() {
                    unregisterClient();
                    console.log("Spotify SSE client disconnected.", id)
                }
            },
        )
    } catch (err) {
        return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
    }
}
