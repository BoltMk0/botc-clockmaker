import { getCharacterById } from '$lib/resources/server/characters';
import { isMessageElement, type MessageElement } from '$lib/common/message';

export function load({ params, url }) {
    const raw = url.searchParams.get('elements');
    let elements: MessageElement[] = [];
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) elements = parsed.filter(isMessageElement);
        } catch {
            elements = [];
        }
    }

    const characterIds = new Set<string>();
    for (const element of elements) {
        if (element.type === 'character') {
            for (const id of element.value) characterIds.add(id);
        }
    }

    const characters = Object.fromEntries(
        [...characterIds].map(id => [id, getCharacterById(id)]).filter(([, c]) => c !== null)
    );

    return {
        clockid: params.clockid,
        elements,
        characters
    };
}
