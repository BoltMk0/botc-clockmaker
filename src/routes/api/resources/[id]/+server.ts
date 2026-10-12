import { deleteResource, findResourceById, getResourceData, getResourceStats } from '$lib/resources/server/resources';
import { fileResponse } from '$lib/resources/server/fileResponse';

export async function GET({params, request}){
    const resource =findResourceById(params.id);
    if (!resource) {
        console.warn(`Resource with id ${params.id} not found`);
        return new Response("Resource not found", { status: 404 });
    }
    const stats = getResourceStats(resource);
    if (!stats) {
        console.warn(`Resource ${resource.name} found but data is missing`);
        return new Response("Resource data not found", { status: 404 });
    }
    return fileResponse(request, stats, () => getResourceData(resource), resource.mimetype, resource.name);
}

export async function DELETE({params}){
    const success = deleteResource(params.id);
    if (!success) {
        return new Response("Failed to delete resource", { status: 500 });
    }
    return new Response(null, { status: 204 });
}
