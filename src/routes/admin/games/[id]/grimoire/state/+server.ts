import { get_grimoire_state_history_resource_for_game, set_grimoire_state_history_resource_for_game } from '$lib/server/grimoire_resource_helper.js';
import { findResourceById, encodeResourceId, getResourceData, saveResource } from '$lib/resources/server/resources';
import { json } from '@sveltejs/kit';
import { validateGrimoireStateHistory } from '../types';

export async function GET({params}){
    const data = get_grimoire_state_history_resource_for_game(Number(params.id));
    if(!data){
        return json({error: "Grimoire state not found"}, {status: 404});
    }
    return json(JSON.parse(data.toString()));
}

export async function POST({params, request}){
    try{
        const body = await request.json();
        const valid = validateGrimoireStateHistory(body);
        if(!valid){
            return json({error: "Invalid grimoire state history data"}, {status: 400});
        }
        
        set_grimoire_state_history_resource_for_game(Number(params.id), body);
        console.log("Saved grimoire state history for game", params.id);
        return json({message: "Grimoire state history saved successfully"});
    }catch(e){
        console.error("Error saving grimoire state history:", e);
        return json({error: "Invalid JSON data"}, {status: 400});
    }
}