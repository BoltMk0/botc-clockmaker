import { fileFitsMimeType, getExtensionForMimeType, getMimeTypeForExtension, getMimeTypeForFilename } from "$lib/common/util";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";


const DATA_DIR = process.env.DATA_DIR || './data';

if(!existsSync(DATA_DIR)){
    mkdirSync(DATA_DIR, { recursive: true });
}

export function listLocalResources(relativeDir: string, opts: {mimeType?: string, checkExists?: boolean} = {}): {filepath: string, mimeType: string}[] {
    const dirpath = path.join(DATA_DIR, relativeDir);
    if(!existsSync(dirpath)){
        if(opts.checkExists){
            throw new Error(`Directory does not exist: ${dirpath}`);
        }
        return [];
    }
    const files = readdirSync(dirpath);
    const resources: {filepath: string, mimeType: string}[] = [];
    for(const file of files){
        const filepath = path.join(dirpath, file);
        if(opts.mimeType){
            if(fileFitsMimeType(file, opts.mimeType)){
                resources.push({filepath, mimeType: getMimeTypeForFilename(file)});
            }
        } else {
            resources.push({filepath, mimeType: getMimeTypeForFilename(file)});
        }
    }
    return resources;
}

export function getLocalResource(relativePath: string, opts: {isDir?: boolean, makeDirs?: boolean, checkExists?: boolean, mimeType?: string} = {checkExists: true, isDir: false}): string {
    if(opts.mimeType){
        const ext = getExtensionForMimeType(opts.mimeType);
        if(ext && !relativePath.endsWith(ext)){
            console.log(relativePath, ext);
            relativePath += ext;
        }
    }

    const fullpath = path.join(DATA_DIR, relativePath);
    const dirpath = (opts.isDir ?? false) ? fullpath : path.dirname(fullpath);
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


export function filepathToResourcePath(filepath: string): string {
    return path.relative(DATA_DIR, filepath).replace(/\\/g, '/');
}