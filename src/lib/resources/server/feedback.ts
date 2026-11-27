import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "fs";
import { JSONSingletonResourceManager } from "./jsonResourceManager";
import { getServiceSetting } from "./serviceSettings";

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

type FeedbackOptions = {
    /** Whether the feedback form accepts submissions. Off until turned on in Settings → Feedback. */
    enabled: boolean;
};

function isFeedbackOptions(value: unknown): value is FeedbackOptions {
    return typeof value === 'object' && value !== null && typeof (value as FeedbackOptions).enabled === 'boolean';
}

const FEEDBACK_OPTIONS_MANAGER = new JSONSingletonResourceManager<FeedbackOptions>('feedback_options', isFeedbackOptions);

export function isFeedbackEnabled(): boolean {
    return FEEDBACK_OPTIONS_MANAGER.value?.enabled ?? false;
}

export function setFeedbackEnabled(enabled: boolean): void {
    FEEDBACK_OPTIONS_MANAGER.save({ enabled });
}

/** The form is checked with Turnstile only when there's a secret key to verify its tokens with. */
export function isTurnstileEnabled(): boolean {
    return !!getServiceSetting('TURNSTILE_SECRET_KEY');
}
