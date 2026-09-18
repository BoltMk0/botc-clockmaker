import { get_grimoire_state_history_resource_for_game, set_grimoire_state_history_resource_for_game } from '$lib/resources/server/grimoire-state.js';
import { json } from '@sveltejs/kit';
import { isGrimoireStateHistory } from '../types';

export async function GET({params}){
    const data = get_grimoire_state_history_resource_for_game(params.id);
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

        set_grimoire_state_history_resource_for_game(params.id, body);
        console.log("Saved grimoire state history for game", params.id);
        return json({message: "Grimoire state history saved successfully"});
    }catch(e){
        console.error("Error saving grimoire state history:", e);
        return json({error: "Invalid JSON data"}, {status: 400});
    }
}