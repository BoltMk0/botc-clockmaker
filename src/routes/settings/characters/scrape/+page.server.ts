import { listCharacters } from "$lib/resources/server/characters";

export async function load(){
    const characters = listCharacters();
    return { characters };
}

