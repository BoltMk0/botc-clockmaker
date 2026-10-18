import { get_grimoire_state_history_resource_for_clock, set_grimoire_state_history_resource_for_clock, delete_grimoire_state_history_resource_for_clock } from '$lib/resources/server/grimoire-state.js';
import { json } from '@sveltejs/kit';
import { isGrimoireStateHistory } from '$lib/resources/common/grimoireState';
import { recordPresetVictory } from '$lib/resources/server/presets';

export async function GET({params}){
    const data = get_grimoire_state_history_resource_for_clock(params.clockid);
    if(!data){
        return json({error: "Grimoire state not found"}, {status: 404});
    }
    return json(data);
}

// The body is the whole grimoire, its `revision` the one it was based on. If someone else has saved since (it's no
// longer the current revision), it's refused with a 409 carrying the current state, for the client to merge its
// changes into and send again (null if the grimoire has been deleted). A grimoire with no revision (a brand new one, from setup) is always accepted.
// The `X-Grim-Client` header names the grim page saving it, so it can ignore its own save when it's broadcast.
export async function POST({params, request}){
    try{
        const body = await request.json();
        const valid = isGrimoireStateHistory(body);
        if(!valid){
            return json({error: "Invalid grimoire state history data"}, {status: 400});
        }

        const current = get_grimoire_state_history_resource_for_clock(params.clockid);
        // (Including when it's since been deleted: a save from a device still open on it mustn't bring it back.)
        if(body.revision !== undefined && current?.revision !== body.revision){
            return json({error: "The grimoire has changed since this was based on it", current}, {status: 409});
        }

        const revision = set_grimoire_state_history_resource_for_clock(params.clockid, body, request.headers.get('X-Grim-Client'));

        console.log("Saved grimoire state history for clock", params.clockid);
        return json({message: "Grimoire state history saved successfully", revision});
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
