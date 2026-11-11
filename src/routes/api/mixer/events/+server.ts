import { produce, type Unsafe } from 'sveltekit-sse';
import { v7 } from 'uuid';
import { error } from '@sveltejs/kit';
import { getAmbienceEngineHelperInstance, type AmbienceEngineHelper } from '$lib/model/server/AmbienceEngine/AmbienceEngineHelper.js';
import { getStingEngineHelperInstance, type StingEngineHelper } from '$lib/model/server/StingEngine/StingEngineHelper.js';
import { getSpotifyHelperInstance, type SpotifyHelper } from '$lib/model/server/Spotify/SpotifyHelper.js';
import { getMusicHelperInstance, type MusicHelper } from '$lib/model/server/Music/MusicHelper.js';
import { getAudioDimHelperInstance, type AudioDimHelper } from '$lib/model/server/AudioDim/AudioDimHelper.js';
import { getTimeOfDayTrimHelperInstance, type TimeOfDayTrimHelper } from '$lib/model/server/TimeOfDayTrim/TimeOfDayTrimHelper.js';
import { getMixerMastersHelperInstance, type MixerMastersHelper } from '$lib/model/server/MixerMasters/MixerMastersHelper.js';
import { SSEClientManager } from '../../../events/sseClientManager';
import type { WSMessage } from '$lib/common/comms';

export type emit_cb = (eventName: string, data: string) => Unsafe<void, Error>;

/**
 * One shared SSE connection carrying every "global" (not per-clock) mixer channel - ambience engine,
 * sting engine, Spotify, the music player and audio dim - which each used to open their own long-lived SSE connection.
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
        readonly music: MusicHelper,
        readonly audioDim: AudioDimHelper,
        readonly timeOfDayTrim: TimeOfDayTrimHelper,
        readonly mixerMasters: MixerMastersHelper
    ) {
        super();
        ambienceEngine.on('engineUpdate', (model) => this.broadcast({ type: 'ambienceEngineUpdate', model }));
        ambienceEngine.on('trackUpdate', (index, model) => this.broadcast({ type: 'ambienceTrackUpdate', index, model }));
        ambienceEngine.on('trackRemoved', (index) => this.broadcast({ type: 'ambienceTrackRemoved', index }));
        stingEngine.on('engineUpdate', (model) => this.broadcast({ type: 'stingEngineUpdate', model }));
        stingEngine.on('trackUpdate', (index, model) => this.broadcast({ type: 'stingTrackUpdate', index, model }));
        stingEngine.on('trigger', (slot) => this.broadcast({ type: 'stingTrigger', slot }));
        spotify.on('update', (model) => this.broadcast({ type: 'spotifyUpdate', model }));
        spotify.on('deviceVolume', (hostClientId, volume) => this.broadcast({ type: 'spotifyDeviceVolume', hostClientId, volume }));
        music.on('update', (model) => this.broadcast({ type: 'musicUpdate', model }));
        audioDim.on('update', (model) => this.broadcast({ type: 'audioDimUpdate', model }));
        timeOfDayTrim.on('update', (model) => this.broadcast({ type: 'timeOfDayTrimUpdate', model }));
        mixerMasters.on('update', (model) => this.broadcast({ type: 'mixerMastersUpdate', model }));
        // The server's clock, for counting on from the players' progress reports (stamped with it)
        setInterval(() => this.broadcast({ type: 'sync', serverTime: Date.now() }), SYNC_INTERVAL_MS).unref?.();
    }
}

/** How often every client is sent the server's time, and how many times a newcomer is at the start, a little apart. */
const SYNC_INTERVAL_MS = 2000;
const SYNC_BURST = 5;
const SYNC_BURST_INTERVAL_MS = 100;

/** A few of the server's time in quick succession, so a newcomer has a good idea of it straight away. */
function sendSyncBurst(send: (msg: WSMessage) => void, count = SYNC_BURST) {
    send({ type: 'sync', serverTime: Date.now() });
    if (count > 1) setTimeout(() => sendSyncBurst(send, count - 1), SYNC_BURST_INTERVAL_MS);
}

let mixerListenerInstance: MixerListener | undefined = undefined;

function getManager() {
    if (!mixerListenerInstance) {
        mixerListenerInstance = new MixerListener(
            getAmbienceEngineHelperInstance(),
            getStingEngineHelperInstance(),
            getSpotifyHelperInstance(),
            getMusicHelperInstance(),
            getAudioDimHelperInstance(),
            getTimeOfDayTrimHelperInstance(),
            getMixerMastersHelperInstance()
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
                    sendSyncBurst(send);
                    send({ type: 'ambienceEngineUpdate', model: mgr.ambienceEngine.model });
                    send({ type: 'stingEngineUpdate', model: mgr.stingEngine.model });
                    send({ type: 'spotifyUpdate', model: mgr.spotify.model });
                    // A host reconnecting may have missed volume changes while it was away
                    const deviceVolume = mgr.spotify.deviceVolume;
                    if (deviceVolume) send({ type: 'spotifyDeviceVolume', ...deviceVolume });
                    send({ type: 'musicUpdate', model: mgr.music.model });
                    send({ type: 'audioDimUpdate', model: mgr.audioDim.model });
                    send({ type: 'timeOfDayTrimUpdate', model: mgr.timeOfDayTrim.model });
                    send({ type: 'mixerMastersUpdate', model: mgr.mixerMasters.model });
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
