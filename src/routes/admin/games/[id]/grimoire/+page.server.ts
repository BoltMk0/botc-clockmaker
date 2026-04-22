import { getFullGame } from '$lib/database/server/games.js';
import { get_grimoire_state_history_resource_for_game, set_grimoire_state_history_resource_for_game } from '$lib/server/grimoire_resource_helper.js';
import { getBOTCTClockInstanceManager } from '$lib/server/model.js';
import { findResourceById, encodeResourceId, getResourceData, parseResourceId, saveResource } from '$lib/resources/server/resources.js';
import { validateGrimoireState, validateGrimoireStateHistory } from './types.js';

export async function load({params}){
    const id = Number(params.id);
    const gameStateResourceId = encodeResourceId("grimoirestate", `game-${params.id}`);
    let gameState = get_grimoire_state_history_resource_for_game(id);
    
    if(!Number.isInteger(id)){
        console.error(`Invalid game ID: ${params.id}`);
        return {game: null, error: "Invalid Id"}
    }
    const game = await getFullGame(id);
    if(game === null){
        console.error(`Game not found with ID: ${id}`);
        return {game: null, error: "Game not found"}
    }
    const availableClocks = getBOTCTClockInstanceManager().listInstances();
    return {gameid: id, game, gameState, availableClocks, error: null}
}


export const actions = {
    saveGrimoireState: async ({request, params}) => {
        try{
            const data = await request.json();
            set_grimoire_state_history_resource_for_game(Number(params.id), data);
        }catch(e){
            return {success: false, error: "Tokens must be valid JSON"}
        }
    }
}