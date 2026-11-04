import { getBOTCTClockInstanceManager } from '$lib/model/server/model';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { getTextOptions } from '$lib/resources/server/textOptions';
import { getMessagePresets } from '$lib/resources/server/messagePresets';
import { get_or_create_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state';
import { isGrimoireStateHistory, newGrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { listScripts } from '$lib/resources/server/scripts';
import { listCharacters } from '$lib/resources/server/characters';
import { getMusicPresets } from '$lib/resources/server/musicPresets';
import { getSpotifyPresets } from '$lib/resources/server/spotifyPresets';

export async function load({ params }) {
    const clockid = params.clockid;
    const clock = getBOTCTClockInstanceManager().getInstance(clockid);
    const timerOptions = getTimerOptions();

    // Every game has a grim: an empty one with no script until a game is set up.
    const rawGrimoireState = get_or_create_grimoire_state_history_resource_for_clock(clockid);
    const grimoireState = isGrimoireStateHistory(rawGrimoireState) ? rawGrimoireState : newGrimoireStateHistory(clockid);

    return {
        clockid,
        model: clock.model,
        grimoireState,
        // Without a script, the token tray lists every character by the scripts they're on.
        // Every character in the library, read afresh on each load so the token tray always has the current list.
        characters: listCharacters(),
        scripts: listScripts().map(s => ({ id: s.id, name: s.name, characterIds: s.characters.map(c => c.characterId) })),
        timerOptions,
        textOptions: getTextOptions(),
        messagePresets: getMessagePresets(),
        musicPresets: getMusicPresets(),
        spotifyPresets: getSpotifyPresets()
    };
}
