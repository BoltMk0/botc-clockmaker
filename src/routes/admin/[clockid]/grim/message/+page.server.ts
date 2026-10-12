import { getCharacterById } from '$lib/resources/server/characters';
import type { MessageField } from '$lib/common/customMessage';

export function load({ params, url }) {
    const raw = url.searchParams.get('fields');
    let fields: MessageField[] = [];
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) fields = parsed;
        } catch {
            fields = [];
        }
    }

    const characterIds = new Set<string>();
    for (const field of fields) {
        if (field.type === 'character') {
            for (const id of field.value) if (id) characterIds.add(id);
        }
    }

    const characters = Object.fromEntries(
        [...characterIds].map(id => [id, getCharacterById(id)]).filter(([, c]) => c !== null)
    );

    return {
        clockid: params.clockid,
        fields,
        characters
    };
}
