import { error, redirect } from "@sveltejs/kit";
import { findLocalResource, saveLocalResource } from "./localfiles";
import { readFileSync, unlinkSync } from "node:fs";

export function makeResourceRESTAPI(resourcePath: string, acceptedMimeTypes: string[], operations: {GET: boolean, POST: boolean, DELETE: boolean}, redirectIfNotFound: string|null = null) {
    async function GET(){
        console.log(`GET resource ${resourcePath} requested`);
        const filedata = findLocalResource(resourcePath);
        if(!filedata){
            if(redirectIfNotFound){
                console.log(`Resource ${resourcePath} not found, redirecting to ${redirectIfNotFound}`);
                return redirect(301, redirectIfNotFound);
            } else {
                console.log(`Resource ${resourcePath} not found, returning 404`);
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

    async function POST({request}: {request: Request}){
        // Save uploaded bell sound file to disk
        const formData = await request.formData();
        const file = formData.get('file') as File;
        if(!file){
            console.error('No file uploaded in POST request');
            return error(400, 'No file uploaded');
        }
        if(!acceptedMimeTypes.includes(file.type)){
            const message = `Uploaded ${resourcePath} file has unacceptable MIME type: ${file.type}. Expected one of: ${acceptedMimeTypes.join(', ')}`;
            console.error(message);
            return error(400, message);
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
    
        const localFilepath = saveLocalResource(resourcePath, buffer, file.type);
        console.log(`Saved uploaded resource ${resourcePath} (${file.type}) to`, localFilepath);
        
        return new Response('File uploaded successfully', {status: 200});
    }

    async function DELETE(){
        // Delete custom bell sound file
        const filedata = findLocalResource(resourcePath, {checkExists: false});
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