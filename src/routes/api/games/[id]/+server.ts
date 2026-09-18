import { deleteGameSetup, getGameSetup, getFullGame } from '$lib/resources/server/games.js';
import { delete_grimoire_state_history_resource_for_game } from '$lib/resources/server/grimoire-state.js';
import { json } from '@sveltejs/kit';

export async function GET({ params, url }) {
    const id = params.id;
    const withCharacters = url.searchParams.get('characters') === 'true';
    if(withCharacters){
        const game = getFullGame(id);
        if(game === null){
            return json({error: `Game setup with id "${id}" not found`}, {status: 404});
        }
        return json(game);
    }
    const game = getGameSetup(id);
    if(game === null){
        return json({error: `Game setup with id "${id}" not found`}, {status: 404});
    }
    return json(game);
}

export async function DELETE({params}){
    const id = params.id;

    const success = deleteGameSetup(id);
    if(!success){
        return json({error: `Game setup with id "${id}" not found`}, {status: 400});
    }
    delete_grimoire_state_history_resource_for_game(id);

    return new Response(null, {status: 204});
}