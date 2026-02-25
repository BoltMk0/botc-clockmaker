import { error, redirect } from "@sveltejs/kit";
import { findLocalResource, saveLocalResource } from "./localfiles";
import { readFileSync, unlinkSync } from "node:fs";

function formatResourceName(resourcePath: string, params: {[key: string]: string}): string {
    console.log(params);
    for(const key in params){
        resourcePath = resourcePath.replace(`[${key}]`, params[key]);
    }
    return resourcePath;
}

export function makeResourceRESTAPI(resourcePath: string, acceptedMimeTypes: string[], operations: {GET: boolean, POST: boolean, DELETE: boolean}, redirectIfNotFound: string|null = null) {
    async function GET({params}: {params: {}}){
        let formattedResourcePath = formatResourceName(resourcePath, params);
        console.log(`GET resource ${formattedResourcePath} requested`);
        const filedata = findLocalResource(formattedResourcePath);
        if(!filedata){
            if(redirectIfNotFound){
                console.log(`Resource ${formattedResourcePath} not found, redirecting to ${redirectIfNotFound}`);
                return redirect(301, redirectIfNotFound);
            } else {
                console.log(`Resource ${formattedResourcePath} not found, returning 404`);
                return error(404, 'Resource not found');
            }
        }
    
        const data = readFileSync(filedata.filepath);
        return new Response(data, {
            headers: {
                'Content-Type': filedata.mimeType,
                'Content-Length': data.length.toString()
            }
        });
    }

    async function POST({request, params}: {request: Request, params: {}}){
        let formattedResourcePath = formatResourceName(resourcePath, params);
        // Save uploaded bell sound file to disk
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if(!file){
            console.error('No file uploaded in POST request');
            return error(400, 'No file uploaded');
        }
        if(!acceptedMimeTypes.includes(file.type)){
            const message = `Uploaded ${formattedResourcePath} file has unacceptable MIME type: ${file.type}. Expected one of: ${acceptedMimeTypes.join(', ')}`;
            console.error(message);
            return error(400, message);
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
    
        const localFilepath = saveLocalResource(formattedResourcePath, buffer, file.type);
        console.log(`Saved uploaded resource ${formattedResourcePath} (${file.type}) to`, localFilepath);
        
        return new Response('File uploaded successfully', {status: 200});
    }

    async function DELETE({params}: {params: {clockid: string}}){
        // Delete custom bell sound file
        const formattedResourcePath = formatResourceName(resourcePath, params);
        const filedata = findLocalResource(formattedResourcePath, {checkExists: false});
        if(filedata){
            // Delete existing file
            const filepath = filedata.filepath;
            unlinkSync(filepath);
            console.log("Deleted custom resource at", filepath);
            return new Response('Custom resource deleted', {status: 200});
        } else {
            console.log("No custom resource to delete");
            return new Response('No custom resource to delete', {status: 200});
        }
    }

    return {
        GET: operations.GET ? GET : undefined,
        POST: operations.POST ? POST : undefined,
        DELETE: operations.DELETE ? DELETE : undefined
    }

}