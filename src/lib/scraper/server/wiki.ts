export const WIKI_ORIGIN = 'https://wiki.bloodontheclocktower.com';

const NAMED_HTML_ENTITIES: Record<string, string> = {
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    nbsp: ' '
};

export function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (match, entity) => {
        if (entity[0] === '#') {
            const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return String.fromCharCode(code);
        }
        return NAMED_HTML_ENTITIES[entity.toLowerCase()] ?? match;
    });
}

export async function fetchWikiPage(wikiPath: string): Promise<string> {
    const response = await fetch(`${WIKI_ORIGIN}/${wikiPath}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch wiki page ${wikiPath}: ${response.statusText} (${response.status})`);
    }
    return await response.text();
}
