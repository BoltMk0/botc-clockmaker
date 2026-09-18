import { getFullGame } from '$lib/resources/server/games.js';
import { get_grimoire_state_history_resource_for_game, set_grimoire_state_history_resource_for_game } from '$lib/resources/server/grimoire-state.js';
import { getBOTCTClockInstanceManager } from '$lib/model/server/model.js';
import { getTimerOptions } from '$lib/resources/server/timerOptions.js';
import { isGrimoireStateHistory } from './types.js';

export async function load({params}){
    const id = params.id;

    let gameState = get_grimoire_state_history_resource_for_game(id);
    if(gameState !== null && !isGrimoireStateHistory(gameState)){
        console.warn(`No valid grimoire state history found for game ${id}, initializing new state`);
        gameState = null;
    }

    const game = getFullGame(id);
    if(game === null){
        console.error(`Game not found with ID: ${id}`);
        return {game: null, error: "Game not found"}
    }

    const availableClocks = getBOTCTClockInstanceManager().listInstances();
    const timerOptions = getTimerOptions();
    return {gameid: id, game, gameState, availableClocks, timerOptions, error: null}
}


export const actions = {
    saveGrimoireState: async ({request, params}) => {
        try{
            const data = await request.json();
            set_grimoire_state_history_resource_for_game(params.id, data);
        }catch(e){
            return {success: false, error: "Tokens must be valid JSON"}
        }
    }
}