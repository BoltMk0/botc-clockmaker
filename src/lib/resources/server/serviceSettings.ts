import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { env } from "$env/dynamic/private";

/**
 * Credentials of the outside services (Spotify, Turnstile, Gmail), set either as environment variables or in
 * the settings (Spotify's in Music Library, the feedback form's in Feedback). Those set in the settings are kept in one file in the data directory, encrypted with a key
 * from the SECRETS_KEY environment variable, so a copy of the data directory alone doesn't give them away.
 * An environment variable wins over the same setting saved in the settings.
 *
 * Secret values never leave this module except to the code that uses them: the settings page only learns whether
 * each is set.
 */

export const SERVICE_SETTINGS = [
    { name: 'SPOTIFY_CLIENT_ID', secret: false },
    { name: 'SPOTIFY_CLIENT_SECRET', secret: true },
    { name: 'TURNSTILE_SITE_KEY', secret: false },
    { name: 'TURNSTILE_SECRET_KEY', secret: true },
    { name: 'GMAIL_USER', secret: false },
    { name: 'GMAIL_APP_PASSWORD', secret: true },
    { name: 'FEEDBACK_TO_EMAILS', secret: false }
] as const;

export type ServiceSettingName = typeof SERVICE_SETTINGS[number]['name'];

export function isServiceSettingName(name: string): name is ServiceSettingName {
    return SERVICE_SETTINGS.some(s => s.name === name);
}

export function isSecretSetting(name: ServiceSettingName): boolean {
    return SERVICE_SETTINGS.find(s => s.name === name)!.secret;
}

type Stored = Partial<Record<ServiceSettingName, string>>;

type EncryptedFile = {
    version: 1;
    /** For deriving the encryption key from SECRETS_KEY. */
    salt: string;
    iv: string;
    tag: string;
    data: string;
};

function isEncryptedFile(value: unknown): value is EncryptedFile {
    const v = value as EncryptedFile;
    return typeof v === 'object' && v !== null && v.version === 1 &&
        typeof v.salt === 'string' && typeof v.iv === 'string' && typeof v.tag === 'string' && typeof v.data === 'string';
}

const RESOURCE_DATA_DIR = process.env.RESOURCE_DATA_DIR || "data/resources";
const FILEPATH = join(RESOURCE_DATA_DIR, 'secrets', 'services.enc.json');

let stored: Stored = {};
/** The file exists but couldn't be read with the current SECRETS_KEY (or at all). */
let unreadable = false;
let loaded = false;

const derivedKeys = new Map<string, Buffer>();

function deriveKey(passphrase: string, salt: string): Buffer {
    const cacheKey = `${salt}:${passphrase}`;
    let key = derivedKeys.get(cacheKey);
    if (!key) {
        key = scryptSync(passphrase, Buffer.from(salt, 'hex'), 32);
        derivedKeys.clear();
        derivedKeys.set(cacheKey, key);
    }
    return key;
}

function secretsKey(): string | null {
    return env.SECRETS_KEY || null;
}

export function canStoreSecrets(): boolean {
    return secretsKey() !== null;
}

function load(): void {
    if (loaded) return;
    loaded = true;
    if (!existsSync(FILEPATH)) return;

    const passphrase = secretsKey();
    if (!passphrase) {
        unreadable = true;
        console.warn(`${FILEPATH} exists but SECRETS_KEY isn't set, so the services' settings in it are ignored`);
        return;
    }
    try {
        const file = JSON.parse(readFileSync(FILEPATH, 'utf-8'));
        if (!isEncryptedFile(file)) throw new Error('Unrecognised format');
        const decipher = createDecipheriv('aes-256-gcm', deriveKey(passphrase, file.salt), Buffer.from(file.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(file.tag, 'base64'));
        const plain = Buffer.concat([decipher.update(Buffer.from(file.data, 'base64')), decipher.final()]).toString('utf-8');
        const parsed = JSON.parse(plain);
        stored = {};
        for (const [name, value] of Object.entries(parsed)) {
            if (isServiceSettingName(name) && typeof value === 'string') stored[name] = value;
        }
    } catch {
        unreadable = true;
        console.warn(`Couldn't decrypt ${FILEPATH} - SECRETS_KEY may have changed. The services' settings in it are ignored.`);
    }
}

function save(values: Stored): void {
    const passphrase = secretsKey();
    if (!passphrase) throw new Error('SECRETS_KEY is not set');

    const salt = randomBytes(16).toString('hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(values), 'utf-8'), cipher.final()]);
    const file: EncryptedFile = {
        version: 1,
        salt,
        iv: iv.toString('base64'),
        tag: cipher.getAuthTag().toString('base64'),
        data: data.toString('base64')
    };

    mkdirSync(dirname(FILEPATH), { recursive: true, mode: 0o700 });
    const tmp = `${FILEPATH}.tmp`;
    writeFileSync(tmp, JSON.stringify(file), { encoding: 'utf-8', mode: 0o600 });
    renameSync(tmp, FILEPATH);

    stored = values;
    unreadable = false;
    for (const listener of listeners) listener();
}

/** A service's setting: its environment variable if set, otherwise what was saved in the settings. */
export function getServiceSetting(name: ServiceSettingName): string | undefined {
    load();
    return env[name] || stored[name] || undefined;
}

export type ServiceSettingStatus = {
    name: ServiceSettingName;
    secret: boolean;
    /** Set as an environment variable, so it can't be changed in the settings. */
    fromEnv: boolean;
    isSet: boolean;
    /** Only for settings that aren't secret. */
    value?: string;
};

/** What the settings page may know. Never includes a secret's value. */
export function serviceSettingsStatus(): { canStore: boolean; unreadable: boolean; settings: ServiceSettingStatus[] } {
    load();
    return {
        canStore: canStoreSecrets(),
        unreadable,
        settings: SERVICE_SETTINGS.map(({ name, secret }) => {
            const fromEnv = !!env[name];
            const value = getServiceSetting(name);
            return {
                name,
                secret,
                fromEnv,
                isSet: !!value,
                ...(secret ? {} : { value: value ?? '' })
            };
        })
    };
}

/**
 * Saves settings: a string replaces the saved value (an empty one clears it), undefined keeps it. Settings set by
 * environment variables are left alone.
 */
export function updateServiceSettings(changes: Partial<Record<ServiceSettingName, string | undefined>>): void {
    load();
    const next: Stored = unreadable ? {} : { ...stored };
    for (const [name, value] of Object.entries(changes) as [ServiceSettingName, string | undefined][]) {
        if (value === undefined || env[name]) continue;
        const trimmed = value.trim();
        if (trimmed) next[name] = trimmed;
        else delete next[name];
    }
    save(next);
}

const listeners = new Set<() => void>();

/** Called after the settings are saved. */
export function onServiceSettingsChanged(listener: () => void): void {
    listeners.add(listener);
}
