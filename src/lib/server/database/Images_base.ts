type imageGroupName = 'characters' | 'reminder_tokens';

import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import type { Character } from '$lib/common/database/types';

const IMAGE_DIR = join(process.cwd(), 'data', 'images');

const MIME_TO_EXT: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
};

const EXT_TO_MIME: Record<string, string> = Object.fromEntries(
    Object.entries(MIME_TO_EXT).map(([mime, ext]) => [ext, mime])
);

function getImagePath(group: imageGroupName, id: number|string, ext: string, createIfNotFound: boolean = false): string {
    const dirpath = join(IMAGE_DIR, group);
    if (createIfNotFound && !existsSync(dirpath)) {
        mkdirSync(dirpath, { recursive: true });
    }
    return join(dirpath, `${id}.${ext}`);
}

function findImagePath(group: imageGroupName, id: number|string): { path: string; mimetype: string } | null {
    for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
        const path = getImagePath(group, id, ext);
        if (existsSync(path)) return { path, mimetype: mime };
    }
    return null;
}

function clearExistingImage(group: imageGroupName, id: number|string): void    {
    const existing = findImagePath(group, id);
    if (existing) unlinkSync(existing.path);
}

function formatCharacterNameToFilename(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}










///////////////////////// CHARACTER IMAGES /////////////////////////


export interface CharacterImage {
    data: Buffer;
    mimetype: string;
}

export function getCharacterImage(character: Character): CharacterImage | null {
    const found = findImagePath('characters', formatCharacterNameToFilename(character.name));
    if (!found) return null;
    return { data: readFileSync(found.path), mimetype: found.mimetype };
}

export function setCharacterImage(character: Character, data: Buffer, mimetype: string): void {
    const characterId = formatCharacterNameToFilename(character.name);
    clearExistingImage('characters', characterId);
    const ext = MIME_TO_EXT[mimetype];
    if (!ext) throw new Error(`Unsupported MIME type: ${mimetype}`);
    const path = getImagePath('characters', characterId, ext, true);
    writeFileSync(path, data);
}

export function deleteCharacterImage(character: Character): boolean {
    const characterId = formatCharacterNameToFilename(character.name);
    const existing = findImagePath('characters', characterId);
    if (!existing) return false;
    unlinkSync(existing.path);
    return true;
}











///////////////////////// REMINDER TOKEN IMAGES /////////////////////////


export interface ReminderTokenImage {
    data: Buffer;
    mimetype: string;
}

export function getReminderTokenImage(tokenId: number): ReminderTokenImage | null {
    const found = findImagePath('reminder_tokens', tokenId,);
    if (!found) return null;
    return { data: readFileSync(found.path), mimetype: found.mimetype };
}

export function setReminderTokenImage(tokenId: number, data: Buffer, mimetype: string): void {
    clearExistingImage('reminder_tokens', tokenId);
    const ext = MIME_TO_EXT[mimetype];
    if (!ext) throw new Error(`Unsupported MIME type: ${mimetype}`);
    const path = getImagePath('reminder_tokens', tokenId, ext, true);
    writeFileSync(path, data);
}

export function deleteReminderTokenImage(tokenId: number): boolean {
    const existing = findImagePath('reminder_tokens', tokenId);
    if (!existing) return false;
    unlinkSync(existing.path);
    return true;
}
