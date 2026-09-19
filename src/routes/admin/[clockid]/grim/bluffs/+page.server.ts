import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { getCharacterById } from '$lib/resources/server/characters';
import type { Character } from '$lib/resources/common/gameData';

export async function load({ params }) {
    const history = get_grimoire_state_history_resource_for_clock(params.clockid);
    const bluffIds: string[] = history?.loadedPreset?.bluff_ids ?? [];
    const bluffs = bluffIds
        .map(id => getCharacterById(id))
        .filter((c): c is Character => c !== null);
    return { clockid: params.clockid, bluffs };
}
