import { produce } from 'sveltekit-sse';
import { get_grimoire_state_history_resource_for_clock, onGrimoireStateChanged } from '$lib/resources/server/grimoire-state';
import type { WSMessage } from '$lib/common/comms';

// Every save of this clock's grimoire, for the grim pages open on it to keep each other up to date. Separate from the
// clock's events, which the town square and player pages listen to as well: the grimoire is the storyteller's alone.
export function POST({ params }) {
    return produce(
        function start({ emit }) {
            const send = (msg: WSMessage) => emit('message', JSON.stringify(msg));
            // The current state first, so a page that reconnects catches up on whatever it missed.
            send({ type: 'grimoireState', history: get_grimoire_state_history_resource_for_clock(params.clockid), origin: null });
            const unsubscribe = onGrimoireStateChanged(params.clockid, (history, origin) => {
                const { error } = send({ type: 'grimoireState', history, origin });
                if (error) unsubscribe();
            });
            return unsubscribe;
        },
        { ping: 4000 }
    );
}
