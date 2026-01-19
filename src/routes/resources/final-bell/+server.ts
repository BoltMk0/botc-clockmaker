import { getExtensionForMimeType } from "$lib/common/util.js";
import { findLocalResource, getLocalResource, saveLocalResource } from "$lib/server/localfiles";
import { redirect } from "@sveltejs/kit";
import { readFileSync, writeFileSync } from "node:fs";

export async function GET(){
    // Read bell sound file from disk and return it
    console.log("GET /resources/final-bell requested");
    const filedata = findLocalResource('sounds/final-bell');
    if(!filedata){
        console.log("No custom final bell sound found, redirecting to default");
        return redirect(301, '/bell.mp3');
    }

    const data = readFileSync(filedata.filepath);
    return new Response(data, {
        headers: {
            'Content-Type': filedata.mimeType,
            'Content-Length': data.length.toString()
        }
    });
}

export async function POST({request}){
    // Save uploaded bell sound file to disk
    const dataDir = getLocalResource('sounds', {makeDirs: true});
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if(!file){
        return new Response('No file uploaded', {status: 400});
    }
    if(!file.type.startsWith('audio/')){
        return new Response('Uploaded file is not an audio file', {status: 400});
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const localFilepath = saveLocalResource('sounds/final-bell', buffer, file.type);
    console.log("Saved uploaded bell sound to", localFilepath);

    return new Response('File uploaded successfully', {status: 200});
}
