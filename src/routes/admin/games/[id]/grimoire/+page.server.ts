import { getGameSetupWithCharacters } from '$lib/server/database/games';
import { getBOTCTClockInstanceManager } from '$lib/server/model.js';
import { findResourceById, generateResourceId, getResourceData, parseResourceId, saveResource } from '$lib/server/resources.js';
import { validateGrimoireState } from './types.js';

export async function load({params}){
    const id = Number(params.id);
    const gameStateResourceId = generateResourceId("grimoirestate", `game-${params.id}`);
    const resource = findResourceById(gameStateResourceId);
    let gameState = null;
    if(resource){
        const data = getResourceData(resource);
        if(data){
            try{
                gameState = JSON.parse(data.toString());
                if(!gameState || typeof gameState !== "object"){
                    console.error(`Game state data is not an object for resource ${gameStateResourceId}`);
                    gameState = null;
                }
                if(validateGrimoireState(gameState)){
                    console.log(`Successfully loaded and validated game state for game ${params.id}`);
                } else {
                    console.error(`Game state data failed validation for resource ${gameStateResourceId}`);
                    gameState = null;
                }
            }catch(e){
                console.error(`Error parsing game state resource ${gameStateResourceId}:`, e);
            }
        }
    }
    if(!Number.isInteger(id)){
        console.error(`Invalid game ID: ${params.id}`);
        return {game: null, error: "Invalid Id"}
    }
    const game = await getGameSetupWithCharacters(id);
    if(game === null){
        console.error(`Game not found with ID: ${id}`);
        return {game: null, error: "Game not found"}
    }
    console.log("Loaded game state for game", id, ":", gameState);
    const availableClocks = getBOTCTClockInstanceManager().listInstances();
    return {gameid: id, game, gameState, availableClocks, error: null}
}


export const actions = {
    saveGrimoireState: async ({request, params}) => {
        const gameStateResourceId = generateResourceId("grimoirestate", `game-${params.id}`);
        try{
            const data = await request.json();
            saveResource(gameStateResourceId, Buffer.from(JSON.stringify(data)));
        }catch(e){
            return {success: false, error: "Tokens must be valid JSON"}
        }
    }
}