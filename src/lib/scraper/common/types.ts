
export type ScrapeResult = {
    status: 'exists' | 'scraped' | 'not_found' | 'error';
    error?: string;
};

export type WikiCharacterListing = {
    name: string;
    wikiPath: string;
    exists: boolean;
    iconExists: boolean;
};

export type CharacterScrapeResult = {
    status: 'created' | 'updated' | 'error';
    error?: string;
    iconStatus?: 'exists' | 'scraped' | 'not_found' | 'error';
    iconError?: string;
};

export type BaseScriptEntry = {
    name: string;
    wikiPath: string;
    hue: string;
};

export type ScriptScrapeResult = {
    status: 'created' | 'updated' | 'error';
    error?: string;
    scriptId?: string;
    missingCharacters?: string[];
};
