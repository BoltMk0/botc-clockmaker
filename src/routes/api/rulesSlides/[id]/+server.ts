import { error } from '@sveltejs/kit';
import { deleteResource, findResourceById } from '$lib/resources/server/resources';

export async function DELETE({ params }){
    const resource = findResourceById(params.id);
    if(!resource || resource.type !== 'rules-slide') return error(404, { message: 'Rules slide not found' });
    if(!deleteResource(resource)) return error(500, { message: 'Failed to delete rules slide' });
    return new Response(null, { status: 204 });
}
