import { get_grimoire_state_history_resource_for_clock, set_grimoire_state_history_resource_for_clock, delete_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state.js';
import { json } from '@sveltejs/kit';
import { isGrimoireStateHistory, isPlayerToken } from '$lib/resources/common/grimoireState';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model.js';
import { getCharacterById } from '$lib/resources/server/characters';
import { recordPresetVictory } from '$lib/resources/server/presets';

export async function GET({params}){
    const data = get_grimoire_state_history_resource_for_clock(params.clockid);
    if(!data){
        return json({error: "Grimoire state not found"}, {status: 404});
    }
    return json(data);
}

export async function POST({params, request}){
    try{
        const body = await request.json();
        const valid = isGrimoireStateHistory(body);
        if(!valid){
            return json({error: "Invalid grimoire state history data"}, {status: 400});
        }

        set_grimoire_state_history_resource_for_clock(params.clockid, body);

        // Keep the clock's player count in sync with the characters currently placed on the
        // board, so the storyteller doesn't have to set it by hand as they seat players.
        // Every token carrying a player name is a seated player, except travellers (who don't count towards the player count).
        const playerCount = body.present.placedTokens.filter(t => isPlayerToken(t) && (!t.characterId || !['traveler', 'loric', 'fabled'].includes(getCharacterById(t.characterId)?.category ?? ''))).length;
        const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
        if (clock) clock.playerCount = playerCount;

        console.log("Saved grimoire state history for clock", params.clockid);
        return json({message: "Grimoire state history saved successfully"});
    }catch(e){
        console.error("Error saving grimoire state history:", e);
        return json({error: "Invalid JSON data"}, {status: 400});
    }
}

// `?winner=good|evil` credits the game's result to the preset it was set up from (if any) before deleting.
export async function DELETE({params, url}){
    const winner = url.searchParams.get('winner');
    if(winner !== null && winner !== 'good' && winner !== 'evil'){
        return json({error: 'winner must be "good" or "evil"'}, {status: 400});
    }

    let presetRecorded = false;
    if(winner){
        const presetId = get_grimoire_state_history_resource_for_clock(params.clockid)?.loadedPreset?.preset_id;
        if(presetId) presetRecorded = recordPresetVictory(presetId, winner) !== null;
    }

    delete_grimoire_state_history_resource_for_clock(params.clockid);
    console.log("Deleted grimoire state history for clock", params.clockid);
    return json({message: "Grimoire state history deleted successfully", presetRecorded});
}
