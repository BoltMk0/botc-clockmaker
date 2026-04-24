import { listCharacters } from "$lib/database/server/characters";

export async function load(){
    const characters = await listCharacters();
    return { characters };
}

