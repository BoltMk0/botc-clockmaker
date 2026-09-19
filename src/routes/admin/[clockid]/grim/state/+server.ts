import { get_grimoire_state_history_resource_for_clock, set_grimoire_state_history_resource_for_clock, delete_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state.js';
import { json } from '@sveltejs/kit';
import { isGrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { getCharactersForScript } from '$lib/resources/server/scripts.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model.js';

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
        if (body.scriptId) {
            const playerCountByCharacterId = new Map(
                getCharactersForScript(body.scriptId).map(c => [c.id, c.player_count])
            );
            const playerCount = body.present.placedTokens.reduce(
                (sum: number, token: { characterId: string }) => sum + (playerCountByCharacterId.get(token.characterId) ?? 0),
                0
            );
            const clock = getBOTCTClockInstanceManager().getInstance(params.clockid);
            if (clock) clock.playerCount = playerCount;
        }

        console.log("Saved grimoire state history for clock", params.clockid);
        return json({message: "Grimoire state history saved successfully"});
    }catch(e){
        console.error("Error saving grimoire state history:", e);
        return json({error: "Invalid JSON data"}, {status: 400});
    }
}

export async function DELETE({params}){
    delete_grimoire_state_history_resource_for_clock(params.clockid);
    console.log("Deleted grimoire state history for clock", params.clockid);
    return json({message: "Grimoire state history deleted successfully"});
}
