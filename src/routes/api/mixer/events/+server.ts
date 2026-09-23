import { produce, type Unsafe } from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { getAmbienceEngineHelperInstance, type AmbienceEngineHelper } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { getStingEngineHelperInstance, type StingEngineHelper } from '$lib/model/server/StingEngine/StingEngineHelper.js';
import { getSpotifyHelperInstance, type SpotifyHelper } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { getAudioDimHelperInstance, type AudioDimHelper } from '$lib/model/server/AudioDim/AudioDimHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';

export type emit_cb = (eventName: string, data: string) => Unsafe<void, Error>;

/**
 * One shared SSE connection carrying every "global" (not per-clock) mixer channel - ambience engine,
 * sting engine, Spotify and audio dim - which each used to open their own long-lived SSE connection.
 * Combined with one connection per clock, that could add up past the browser's ~6-connections-per-origin
 * limit and starve every stream on the page (and on any other tab sharing the origin). Messages are
 * demuxed client-side by their own `type` field, same as the clock route already does for its several
 * message types over one connection.
 */
class MixerListener extends SSEClientManager {
    constructor(
        readonly ambienceEngine: AmbienceEngineHelper,
        readonly stingEngine: StingEngineHelper,
        readonly spotify: SpotifyHelper,
        readonly audioDim: AudioDimHelper
    ) {
        super();
        ambienceEngine.on('engineUpdate', (model) => this.broadcast({ type: 'ambienceEngineUpdate', model }));
        ambienceEngine.on('trackUpdate', (index, model) => this.broadcast({ type: 'ambienceTrackUpdate', index, model }));
        stingEngine.on('engineUpdate', (model) => this.broadcast({ type: 'stingEngineUpdate', model }));
        stingEngine.on('trackUpdate', (index, model) => this.broadcast({ type: 'stingTrackUpdate', index, model }));
        stingEngine.on('trigger', (slot) => this.broadcast({ type: 'stingTrigger', slot }));
        spotify.on('update', (model) => this.broadcast({ type: 'spotifyUpdate', model }));
        audioDim.on('update', (model) => this.broadcast({ type: 'audioDimUpdate', model }));
    }
}

let mixerListenerInstance: MixerListener | undefined = undefined;

function getManager() {
    if (!mixerListenerInstance) {
        mixerListenerInstance = new MixerListener(
            getAmbienceEngineHelperInstance(),
            getStingEngineHelperInstance(),
            getSpotifyHelperInstance(),
            getAudioDimHelperInstance()
        );
    }
    return mixerListenerInstance;
}

export function POST() {
    console.log("Mixer events SSE client connecting...");
    const id = v7();
    const mgr = getManager();
    let unregisterClient: () => void;
    try {
        return produce(
            function start({ emit }) {
                console.log("Mixer events client connected.", id);
                // Send the current state of every channel straight away so a (re)connecting client resyncs.
                unregisterClient = mgr.setupClient(emit, (send) => {
                    send({ type: 'ambienceEngineUpdate', model: mgr.ambienceEngine.model });
                    send({ type: 'stingEngineUpdate', model: mgr.stingEngine.model });
                    send({ type: 'spotifyUpdate', model: mgr.spotify.model });
                    send({ type: 'audioDimUpdate', model: mgr.audioDim.model });
                });
                return () => {
                    unregisterClient();
                }
            },
            {
                ping: 4000,
                stop() {
                    unregisterClient();
                    console.log("Mixer events client disconnected.", id)
                }
            },
        )
    } catch (err) {
        return error(500, `Internal server error: ${err instanceof Error ? err.message : String(err)}`);
    }
}
