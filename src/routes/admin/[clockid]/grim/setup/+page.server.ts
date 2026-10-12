import { listScriptsWithCharacters } from '$lib/resources/server/scripts';

export async function load({ params }) {
    return {
        clockid: params.clockid,
        scripts: listScriptsWithCharacters()
    };
}
