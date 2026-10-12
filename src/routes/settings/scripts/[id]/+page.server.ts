import { getScriptWithCharacters } from '$lib/resources/server/scripts';

export async function load({ params }) {
    const script = getScriptWithCharacters(params.id);
    if (!script) {
        throw new Error('Script not found');
    }
    return { script };
}
