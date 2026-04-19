import { findResourceById, generateResourceId, getResourceData, saveResource } from '$lib/server/resources';
import { json } from '@sveltejs/kit';

export async function GET({params}){
    const gameStateResourceId = generateResourceId("grimoirestate", `game-${params.id}`);
    const resource = findResourceById(gameStateResourceId);
    if(!resource){
        console.error(`Game state resource not found for game ${params.id} (expected ID: ${gameStateResourceId})`);
        return json({error: "Game state not found"}, {status: 404});
    }
    const data = getResourceData(resource);
    if(!data){
        console.error(`Game state data not found for resource ${gameStateResourceId}`);
        return json({error: "Game state data not found"}, {status: 404});
    }
    return json(JSON.parse(data.toString()));
}


export async function POST({request, params}){
    const gameStateResourceId = generateResourceId("grimoirestate", `game-${params.id}`);
    try{
        const data = await request.json();
        saveResource(gameStateResourceId, Buffer.from(JSON.stringify(data)));
        console.log(`Saved grimoire state for game ${params.id}:`, data);
        return json({success: true});
    }catch(e){
        console.error(`Failed to save grimoire state for game ${params.id}:`, e);
        return json({success: false, error: "Tokens must be valid JSON"}, {status: 400});
    }
}
