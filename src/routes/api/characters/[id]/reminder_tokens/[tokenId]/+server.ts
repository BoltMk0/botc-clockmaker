import { deleteReminderToken, updateReminderToken } from '$lib/resources/server/characters';
import { json } from '@sveltejs/kit';

export async function DELETE({ params }) {
    try {
        const success = deleteReminderToken(params.id, params.tokenId);
        if (!success) {
            return json({ error: 'Reminder token not found' }, { status: 404 });
        }
        return json({ message: 'Reminder token deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting reminder token:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST({ params, request }) {
    try {
        const data = await request.json();
        const updatedToken = updateReminderToken(params.id, params.tokenId, data);
        if (!updatedToken) {
            return json({ error: 'Reminder token not found' }, { status: 404 });
        }
        return json(updatedToken, { status: 200 });
    } catch (error) {
        console.error('Error updating reminder token:', error);
        if (error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}
