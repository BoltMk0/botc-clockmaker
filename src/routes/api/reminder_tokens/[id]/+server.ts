import { deleteReminderToken, getReminderTokenById, updateReminderToken } from "$lib/server/database/reminder_tokens";
import { json } from "@sveltejs/kit";

export async function GET({ params }: { params: { id: string } }) {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return json({ error: 'Invalid ID' }, { status: 400 });
    }
    try {
        const token = await getReminderTokenById(id);
        if (!token) {
            return json({ error: 'Reminder token not found' }, { status: 404 });
        }
        return json(token, { status: 200 });
    } catch (error) {
        console.error('Error fetching reminder token:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE({ params }: { params: { id: string } }) {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return json({ error: 'Invalid ID' }, { status: 400 });
    }
    try {
        const success = await deleteReminderToken(id);
        if(!success) {
            return json({ error: 'Reminder token not found' }, { status: 404 });
        }
        return json({ message: 'Reminder token deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error('Error deleting reminder token:', error);
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST({ params, request }: { params: { id: string }, request: Request }) {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
        return json({ error: 'Invalid ID' }, { status: 400 });
    }
    try {
        const data = await request.json();
        const updatedToken = await updateReminderToken(id, data);
        if (!updatedToken) {
            return json({ error: 'Reminder token not found' }, { status: 404 });
        }
        return json(updatedToken, { status: 200 });
    } catch (error) {
        console.error('Error updating reminder token:', error);
        if(error instanceof Error) {
            return json({ error: error.message }, { status: 500 });
        }
        return json({ error: 'An unknown error occurred' }, { status: 500 });
    }
}