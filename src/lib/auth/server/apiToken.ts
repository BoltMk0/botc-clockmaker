import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { JSONSingletonResourceManager } from "$lib/resources/server/jsonResourceManager";

/**
 * The one API token, for programs (like Lightscapes) calling the API and following a clock's events without a
 * session. Only its hash is kept, so it's shown once when created and can't be read back.
 */
type ApiTokenConfig = {
    hash: string;
    createdAt: number;
};

function isApiTokenConfig(value: unknown): value is ApiTokenConfig {
    return typeof value === 'object' && value !== null &&
        typeof (value as ApiTokenConfig).hash === 'string' &&
        typeof (value as ApiTokenConfig).createdAt === 'number';
}

const API_TOKEN_MANAGER = new JSONSingletonResourceManager<ApiTokenConfig>('api-token', isApiTokenConfig);

function hashToken(token: string): Buffer {
    return createHash('sha256').update(token).digest();
}

/** When the current token was created, or null if there isn't one. */
export function apiTokenCreatedAt(): number | null {
    return API_TOKEN_MANAGER.value?.createdAt ?? null;
}

/** Creates a new token, replacing any there was. Returns it: the only time it can be seen. */
export function createApiToken(): string {
    const token = randomBytes(32).toString('base64url');
    API_TOKEN_MANAGER.save({ hash: hashToken(token).toString('hex'), createdAt: Date.now() });
    return token;
}

export function revokeApiToken(): void {
    API_TOKEN_MANAGER.clear();
}

export function isValidApiToken(token: string | undefined): boolean {
    const config = API_TOKEN_MANAGER.value;
    if (!config || !token) return false;
    const expected = Buffer.from(config.hash, 'hex');
    return timingSafeEqual(expected, hashToken(token));
}

/** The token from a request's `Authorization: Bearer <token>` header, if it has one. */
export function bearerToken(request: Request): string | undefined {
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '');
    return match?.[1];
}
