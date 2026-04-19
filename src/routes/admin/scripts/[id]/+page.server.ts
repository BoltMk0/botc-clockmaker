import { listCharacters } from '$lib/server/database/characters';
import { getScriptById, getScriptWithCharacters } from '$lib/server/database/scripts';

export async function load({params}){
    const id = Number(params.id);
    if (!Number.isInteger(id)) {
        throw new Error('Invalid script id');
    }
    const script = await getScriptWithCharacters(id);
    if (!script) {
        throw new Error('Script not found');
    }
    const characters = await listCharacters();
    return { script, characters};
}