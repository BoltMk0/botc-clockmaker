import { getCharacterById } from '$lib/resources/server/characters';

export function load({ params, url }) {
    const characterId = url.searchParams.get('character');
    const subtitleCharacterId = url.searchParams.get('subtitleCharacter');
    return {
        clockid: params.clockid,
        character: characterId ? getCharacterById(characterId) : null,
        subtitleCharacter: subtitleCharacterId ? getCharacterById(subtitleCharacterId) : null
    };
}
