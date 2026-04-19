
export type ScrapeResult = {
    status: 'exists' | 'scraped' | 'not_found' | 'error';
    error?: string;
};
