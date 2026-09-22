import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "fs";

export const FEEDBACK_DIR = process.env.FEEDBACK_DATA_DIR || "data/feedback";
if (!existsSync(FEEDBACK_DIR)) mkdirSync(FEEDBACK_DIR, { recursive: true });

export type FeedbackEntry = {
    filename: string;
    /** ISO timestamp the entry was written, from the file's mtime. */
    timestamp: string;
    text: string;
};

const FEEDBACK_FILENAME_PATTERN = /^[\w.-]+\.txt$/;

export function listFeedback(): FeedbackEntry[] {
    const files = existsSync(FEEDBACK_DIR) ? readdirSync(FEEDBACK_DIR).filter(f => f.endsWith('.txt')) : [];
    return files.map((filename): FeedbackEntry => {
        const filepath = `${FEEDBACK_DIR}/${filename}`;
        return {
            filename,
            timestamp: statSync(filepath).mtime.toISOString(),
            text: readFileSync(filepath, 'utf8')
        };
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function deleteFeedback(filename: string): boolean {
    if (!FEEDBACK_FILENAME_PATTERN.test(filename)) return false;
    const filepath = `${FEEDBACK_DIR}/${filename}`;
    if (!existsSync(filepath)) return false;
    unlinkSync(filepath);
    return true;
}
