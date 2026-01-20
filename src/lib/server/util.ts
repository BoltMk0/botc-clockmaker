import { redirect } from "@sveltejs/kit";
import { findLocalResource, saveLocalResource } from "./localfiles";
import { readFileSync, unlinkSync } from "node:fs";

export function makeResourceRESTAPI(resourcePath: string, acceptedMimeTypes: string[], operations: {GET: boolean, POST: boolean, DELETE: boolean}, redirectIfNotFound: string|null = null) {
    async function GET(){
        console.log(`GET resource ${resourcePath} requested`);
        const filedata = findLocalResource(resourcePath);
        if(!filedata){
            console.log("No custom final bell sound found, redirecting to default");
            if(redirectIfNotFound){
                return redirect(301, redirectIfNotFound);
            } else {
                return new Response('Resource not found', {status: 404});
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
            return new Response('No file uploaded', {status: 400});
        }
        if(!acceptedMimeTypes.includes(file.type)){
            return new Response('Uploaded file has an unexpected MIME type', {status: 400});
        }
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
    
        const localFilepath = saveLocalResource(resourcePath, buffer, file.type);
        console.log("Saved uploaded bell sound to", localFilepath);
        
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