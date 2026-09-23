import type { WSMessage } from "$lib/common/comms";
import { SSEClient } from "../../model/client/util/sseClient.svelte";

/**
 * Shared SSE connection for every "global" (not per-clock) mixer channel - ambience engine, sting engine,
 * Spotify, audio dim - each of which used to open its own connection via its own SSEClient. That's one
 * more long-lived connection per feature, which combined with one connection per clock could exhaust the
 * browser's ~6-connections-per-origin limit and start starving every stream (on this tab and any other tab
 * sharing the origin). All four now share this single `/api/mixer/events` connection instead, demuxed by
 * each message's own `type` field - see the server route for the other half of this.
 *
 * Reference-counted: the underlying connection opens on the first subscriber and closes once the last one
 * unsubscribes, so closing e.g. just the sting engine doesn't take ambience/Spotify/dim down with it.
 */

type Listener = (msg: WSMessage) => void;

let client: SSEClient | null = null;
let listeners: Set<Listener> | null = null;

export function subscribeMixerEvents(listener: Listener): () => void {
    if (!client || !listeners) {
        const activeListeners = listeners = new Set<Listener>();
        client = new SSEClient('/api/mixer/events', (msg) => {
            for (const l of [...activeListeners]) l(msg);
        });
    }
    listeners.add(listener);

    let unsubscribed = false;
    return () => {
        if (unsubscribed) return;
        unsubscribed = true;
        listeners?.delete(listener);
        if (listeners && listeners.size === 0) {
            client?.close();
            client = null;
            listeners = null;
        }
    };
}
