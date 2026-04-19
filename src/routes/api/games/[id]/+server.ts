import { deleteGameSetup, getGameSetupById, getGameSetupWithCharacters } from '$lib/server/database/games.js';
import { error, json } from '@sveltejs/kit';

export async function GET({ params, url }) {
    const id = Number(params.id);
    if(!Number.isInteger(id)) return json({erorr: "invalid id"}, {status: 400});
    const withCharacters = url.searchParams.get('characters') === 'true';
    if(withCharacters){
        const game = await getGameSetupWithCharacters(id);
        if(game === null){
            return json({error: `Game setup with id "${id}" not found`}, {status: 404});
        }
        return json(game);
    }
    const game = await getGameSetupById(id);
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
    return new Response(null, {status: 204});
}