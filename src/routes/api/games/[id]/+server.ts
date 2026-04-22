import { deleteGameSetup, getGameSetup, getFullGame } from '$lib/database/server/games.js';
import { delete_grimoire_state_history_resource_for_game } from '$lib/resources/server/grimoire-state.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, url }) {
    const id = Number(params.id);
    if(!Number.isInteger(id)) return json({erorr: "invalid id"}, {status: 400});
    const withCharacters = url.searchParams.get('characters') === 'true';
    if(withCharacters){
        const game = await getFullGame(id);
        if(game === null){
            return json({error: `Game setup with id "${id}" not found`}, {status: 404});
        }
        return json(game);
    }
    const game = await getGameSetup(id);
    if(game === null){
        return json({error: `Game setup with id "${id}" not found`}, {status: 404});
    }
    return json(game);
}

export async function DELETE({params}){
    const id = Number(params.id);
    if(!Number.isInteger(id)) return json({erorr: "invalid id"}, {status: 400});

    const success = await deleteGameSetup(id);
    if(!success){
        return json({error: `Game setup with id "${id}" not found`}, {status: 400});
    }
    delete_grimoire_state_history_resource_for_game(id);

    return new Response(null, {status: 204});
}