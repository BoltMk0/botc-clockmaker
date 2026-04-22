import { createReminderToken, getReminderTokensForCharacter, listReminderTokensForScript } from '$lib/database/server/reminder_tokens';
import { json } from '@sveltejs/kit';

export async function GET({url}){
    const characterId = url.searchParams.get('characterId');
    const scriptId = url.searchParams.get('scriptId');

    try {
        if (characterId) {
            const data = await getReminderTokensForCharacter(Number(characterId));
            return json(data);
        }
        if (scriptId) {
            const data = await listReminderTokensForScript(Number(scriptId));
            return json(data);
        }
        return json({ error: 'Missing characterId or scriptId query parameter' }, { status: 400 });
    } catch (error) {
        console.error(error);
        if(error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}

export async function POST({ request }: { request: Request }) {
    try {
        const data = await request.json();
        // Validation can be added here if needed
        const newToken = await createReminderToken(data);
        return json(newToken, { status: 201 });
    } catch (error) {
        console.error(error);
        if(error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}
