import { slugify } from "$lib/resources/common/util";
import { getCharacterByName } from "$lib/resources/server/characters";
import { createScript, getScriptById, setScriptCharacters } from "$lib/resources/server/scripts";
import { decodeHtmlEntities, fetchWikiPage } from "./wiki";
import type { BaseScriptEntry, ScriptScrapeResult } from "../common/types";

export const BASE_SCRIPTS: BaseScriptEntry[] = [
    { name: 'Trouble Brewing', wikiPath: 'Trouble_Brewing', hue: '#c45d5d' },
    { name: 'Bad Moon Rising', wikiPath: 'Bad_Moon_Rising', hue: '#b8860b' },
    { name: 'Sects & Violets', wikiPath: 'Sects_%26_Violets', hue: '#7c3aed' }
];

// Each edition's page lists its full roster in a fixed `edition-details-characters`
// table, one row per category, e.g:
// <table id="edition-details-characters"><tr><td>Townsfolk</td><td><a href="/Washerwoman" ...>Washerwoman</a><br/>...</td></tr>...</table>
async function fetchRosterNames(wikiPath: string): Promise<string[]> {
    const html = await fetchWikiPage(wikiPath);

    const tableMatch = html.match(/<table id="edition-details-characters">([\s\S]*?)<\/table>/);
    if (!tableMatch) {
        throw new Error('Could not find character roster table on wiki page');
    }

    const names: string[] = [];
    const linkRegex = /<a href="\/[^"]+" title="[^"]*">([^<]+)<\/a>/g;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(tableMatch[1])) !== null) {
        names.push(decodeHtmlEntities(match[1]).trim());
    }
    return names;
}

export async function previewScriptRoster(entry: BaseScriptEntry): Promise<{ name: string; exists: boolean }[]> {
    const names = await fetchRosterNames(entry.wikiPath);
    return names.map(name => ({ name, exists: !!getCharacterByName(name) }));
}

export async function scrapeScript(entry: BaseScriptEntry): Promise<ScriptScrapeResult> {
    console.log("Scraping script", entry.name);
    try {
        const names = await fetchRosterNames(entry.wikiPath);

        const characterIds: string[] = [];
        const missingCharacters: string[] = [];
        for (const name of names) {
            const character = getCharacterByName(name);
            if (character) {
                characterIds.push(character.id);
            } else {
                missingCharacters.push(name);
            }
        }

        const id = slugify(entry.name);
        const existing = getScriptById(id);
        const script = existing ?? createScript({ name: entry.name, hue: entry.hue });

        setScriptCharacters(script.id, characterIds.map(characterId => ({
            characterId,
            firstNightOrder: null,
            otherNightOrder: null
        })));

        return {
            status: existing ? 'updated' : 'created',
            scriptId: script.id,
            missingCharacters: missingCharacters.length ? missingCharacters : undefined
        };
    } catch (er: any) {
        console.error(`Failed to scrape script ${entry.name}:`, er);
        return { status: 'error', error: er.message };
    }
}
