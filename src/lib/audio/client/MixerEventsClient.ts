import type { WSMessage } from "$lib/common/comms";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

/**
 * Shared SSE connection for every "global" (not per-clock) mixer channel - ambience engine, sting engine,
 * Spotify, the music player, audio dim - each of which used to open its own connection via its own SSEClient. That's one
 * more long-lived connection per feature, which combined with one connection per clock could exhaust the
 * browser's ~6-connections-per-origin limit and start starving every stream (on this tab and any other tab
 * sharing the origin). All four now share this single `/api/mixer/events` connection instead, demuxed by
 * each message's own `type` field - see the server route for the other half of this.
 *
 * Reference-counted: the underlying connection opens on the first subscriber and closes once the last one
 * unsubscribes, so closing e.g. just the sting engine doesn't take ambience/Spotify/dim down with it.
 */

type Listener = (msg: WSMessage) => void;

/**
 * Messages that each carry a channel's whole state, so the latest one is all a newcomer needs. The server only sends
 * the current state when the connection opens, so without replaying these, anything subscribing once the connection
 * is already up (e.g. the grim's clock controls popup, after the grim itself connected) would never hear it until
 * the next change. The ambience/sting engines aren't here: their track updates are deltas on top of the engine
 * snapshot, so an old snapshot alone could be staler than the page data those engines start from.
 */
const REPLAYED_TYPES = new Set<WSMessage['type']>([
    'spotifyUpdate', 'spotifyDeviceVolume', 'musicUpdate', 'audioDimUpdate', 'timeOfDayTrimUpdate', 'mixerMastersUpdate'
]);

let client: SSEClient | null = null;
let listeners: Set<Listener> | null = null;
let latest: Map<WSMessage['type'], WSMessage> | null = null;

export function subscribeMixerEvents(listener: Listener): () => void {
    if (!client || !listeners || !latest) {
        const activeListeners = listeners = new Set<Listener>();
        const latestMessages = latest = new Map();
        client = new SSEClient('/api/mixer/events', (msg) => {
            if (REPLAYED_TYPES.has(msg.type)) latestMessages.set(msg.type, msg);
            for (const l of [...activeListeners]) l(msg);
        });
    }
    listeners.add(listener);

    let unsubscribed = false;
    // Catch up on the current state. After the subscriber has finished setting up, as it's usually still in its constructor.
    const replay = [...latest.values()];
    if (replay.length > 0) {
        queueMicrotask(() => {
            for (const msg of replay) {
                if (unsubscribed) return;
                listener(msg);
            }
        });
    }

    return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        listeners?.delete(listener);
        if (listeners && listeners.size === 0) {
            client?.close();
            client = null;
            listeners = null;
            latest = null;
        }
    };
}
