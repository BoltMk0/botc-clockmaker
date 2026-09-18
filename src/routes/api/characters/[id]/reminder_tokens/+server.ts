import { addReminderToken, getReminderTokensForCharacter } from '$lib/resources/server/characters';
import { json } from '@sveltejs/kit';

export async function GET({ params }) {
    try {
        const data = getReminderTokensForCharacter(params.id);
        return json(data);
    } catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}

export async function POST({ params, request }) {
    try {
        const data = await request.json();
        const newToken = addReminderToken(params.id, data);
        return json(newToken, { status: 201 });
    } catch (error) {
        console.error(error);
        if (error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}
