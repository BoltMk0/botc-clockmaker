import { getFullGame } from '$lib/database/server/games.js';
import { get_grimoire_state_history_resource_for_game, set_grimoire_state_history_resource_for_game } from '$lib/resources/server/grimoire-state.js';
import { getBOTCTClockInstanceManager } from '$lib/server/model.js';
import { isGrimoireStateHistory } from './types.js';

export async function load({params}){
    const id = Number(params.id);

    if(!Number.isInteger(id)){
        console.error(`Invalid game ID: ${params.id}`);
        return {game: null, error: "Invalid Id"}
    }

    let gameState = get_grimoire_state_history_resource_for_game(id);
    if(gameState !== null && !isGrimoireStateHistory(gameState)){
        console.warn(`No valid grimoire state history found for game ${id}, initializing new state`);
        gameState = null;
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