import { deleteFeedback } from '$lib/resources/server/feedback';

export async function DELETE({ params }) {
    const success = deleteFeedback(params.filename);
    if (!success) {
        return new Response("Failed to delete feedback", { status: 500 });
    }
    return new Response(null, { status: 204 });
}
