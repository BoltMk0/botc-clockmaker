import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

type AuthConfig = {
    salt: string;
    hash: string;
    sessionSecret: string;
};

function isAuthConfig(value: unknown): value is AuthConfig {
    return typeof value === 'object' && value !== null &&
        typeof (value as AuthConfig).salt === 'string' &&
        typeof (value as AuthConfig).hash === 'string' &&
        typeof (value as AuthConfig).sessionSecret === 'string';
}

const AUTH_MANAGER = new JSONSingletonResourceManager<AuthConfig>('auth', isAuthConfig);

export const SESSION_COOKIE = 'botc_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isPasswordSet(): boolean {
    return AUTH_MANAGER.value !== null;
}

function hashPassword(password: string, salt: string): Buffer {
    return scryptSync(password, salt, 64);
}

/** Sets the password. Refuses if one already exists. */
export function setInitialPassword(password: string): boolean {
    if (isPasswordSet()) return false;
    const salt = randomBytes(16).toString('hex');
    AUTH_MANAGER.save({
        salt,
        hash: hashPassword(password, salt).toString('hex'),
        sessionSecret: randomBytes(32).toString('hex')
    });
    return true;
}

/** Removes the password (and invalidates all sessions); the next visitor is prompted to set a new one. */
export function clearPassword(): void {
    AUTH_MANAGER.clear();
}

export function verifyPassword(password: string): boolean {
    const config = AUTH_MANAGER.value;
    if (!config) return false;
    const expected = Buffer.from(config.hash, 'hex');
    const actual = hashPassword(password, config.salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function expectedSessionToken(): string | null {
    const config = AUTH_MANAGER.value;
    if (!config) return null;
    return createHmac('sha256', config.sessionSecret).update(config.hash).digest('hex');
}

export function createSessionToken(): string {
    return expectedSessionToken() ?? '';
}

export function isValidSessionToken(token: string | undefined): boolean {
    const expected = expectedSessionToken();
    if (!expected || !token) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b);
}

/** Only allow same-site relative redirects. */
export function safeRedirectTarget(target: string | null | undefined): string {
    if (target && target.startsWith('/') && !target.startsWith('//') && !target.startsWith('/\\')) {
        return target;
    }
    return '/';
}
