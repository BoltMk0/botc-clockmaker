import { get_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { getCharacterById } from '$lib/resources/server/characters';
import { bluffSetsOf, type Character } from '$lib/resources/common/gameData';

export async function load({ params, url }) {
    const history = get_grimoire_state_history_resource_for_clock(params.clockid);
    const sets = history?.loadedPreset ? bluffSetsOf(history.loadedPreset) : [];
    const setIndex = Number(url.searchParams.get('set') ?? 0);
    const bluffIds = sets[Number.isInteger(setIndex) ? setIndex : 0] ?? [];
    const bluffs = bluffIds
        .map(id => getCharacterById(id))
        .filter((c): c is Character => c !== null);
    return { clockid: params.clockid, bluffs };
}
