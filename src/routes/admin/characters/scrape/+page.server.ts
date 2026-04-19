import { listCharacters } from "$lib/server/database/characters";

export async function load(){
    const characters = await listCharacters();
    return { characters };
}