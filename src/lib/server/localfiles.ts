import { getMimeTypeForExtension, getMimeTypeForFilename } from "$lib/common/util";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";


const DATA_DIR = process.env.DATA_DIR || './data';

if(!existsSync(DATA_DIR)){
    mkdirSync(DATA_DIR, { recursive: true });
}

export function getLocalResource(relativePath: string, opts: {makeDirs?: boolean, checkExists?: boolean, mimeType?: string} = {checkExists: true}): string {
    if(opts.mimeType){
        const ext = getMimeTypeForExtension(opts.mimeType);
        if(ext && !relativePath.endsWith(ext)){
            relativePath += ext;
        }
    }

    const fullpath = path.join(DATA_DIR, relativePath);
    const dirpath = path.dirname(fullpath);
    if(!existsSync(dirpath)){
        if(opts.makeDirs){
            mkdirSync(dirpath, { recursive: true });
        } else if(opts.checkExists){
            throw new Error(`Directory does not exist: ${dirpath}`);
        }
    }
    if(opts.checkExists && !existsSync(fullpath)){
        throw new Error(`File does not exist: ${fullpath}`);
    }
    return fullpath;
}

export function findLocalResource(relativePathBasename: string, opts: {checkExists?: boolean} = {}): {filepath: string, mimeType: string}|null {
    const fullpath = path.join(DATA_DIR, relativePathBasename);
    const dirpath = path.dirname(fullpath);
    const baseFilename = path.basename(fullpath);

    if(!existsSync(dirpath)){
        if(opts.checkExists){
            throw new Error(`Directory does not exist: ${dirpath}`);
        } else {
            return null;
        }
    }

    for(const file of readdirSync(dirpath)){
        if(file.startsWith(baseFilename + '.')){
            return {filepath: path.join(dirpath, file), mimeType: getMimeTypeForFilename(file)};
        }
    }
    return null;
}

export function saveLocalResource(relativePathBasename: string, data: Buffer, mimeType: string): string {
    const existing = findLocalResource(relativePathBasename, {checkExists: false});
    if(existing){
        // Delete existing file
        const filepath = existing.filepath;
        unlinkSync(filepath);
    }
    const filepath = getLocalResource(relativePathBasename, {makeDirs: true, mimeType, checkExists: false});
    writeFileSync(filepath, data);
    return filepath;
}
