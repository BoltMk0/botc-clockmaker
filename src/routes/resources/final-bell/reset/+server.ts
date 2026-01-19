import { findLocalResource } from "$lib/server/localfiles";
import { unlinkSync } from "fs";

export async function POST(){
    // Delete custom bell sound file
    const filedata = findLocalResource('sounds/final-bell', {checkExists: false});
    if(filedata){
        // Delete existing file
        const filepath = filedata.filepath;
        unlinkSync(filepath);
        console.log("Deleted custom final bell sound at", filepath);
    } else {
        console.log("No custom final bell sound to delete");
    }
    return new Response('Custom final bell sound reset', {status: 200});
}
