import { getCharacterById } from '$lib/resources/server/characters';
import { isMessageElement, type MessageElement } from '$lib/common/message';

function parseJson(raw: string | null): unknown {
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

const elementsOf = (data: unknown): MessageElement[] => Array.isArray(data) ? data.filter(isMessageElement) : [];

// Shows one message (elements) or several in turn (messages, from the communications queue), starting at message i.
export function load({ params, url }) {
    const queued = parseJson(url.searchParams.get('messages'));
    const messages = Array.isArray(queued)
        ? queued.map(elementsOf)
        : [elementsOf(parseJson(url.searchParams.get('elements')))];
    const index = Number(url.searchParams.get('i') ?? 0);
    const start = Number.isInteger(index) && index >= 0 && index < messages.length ? index : 0;

    const characterIds = new Set<string>();
    for (const element of messages.flat()) {
        if (element.type === 'character') {
            for (const id of element.value) characterIds.add(id);
        }
    }

    const characters = Object.fromEntries(
        [...characterIds].map(id => [id, getCharacterById(id)]).filter(([, c]) => c !== null)
    );

    return {
        clockid: params.clockid,
        messages,
        start,
        characters
    };
}
