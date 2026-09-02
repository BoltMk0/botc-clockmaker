import { getMimeTypeForExtension } from "../common/util";
import { encodeResourceId, findResourceById, getResourceData, saveResource } from "./resources";

export type QrCode = {
    url: string;
    title: string;
};

export function isQrCode(value: unknown): value is QrCode {
    return typeof value === 'object' && value !== null &&
        'url' in value && typeof (value as QrCode).url === 'string' &&
        'title' in value && typeof (value as QrCode).title === 'string';
}

const resId = encodeResourceId('appconfig', 'qr_codes', getMimeTypeForExtension('.json'));

export function saveQrCodes(codes: QrCode[]) {
    const data = Buffer.from(JSON.stringify(codes), 'utf-8');
    saveResource(resId, data);
}

export function getQrCodes(): QrCode[] {
    const res = findResourceById(resId);
    if (res) {
        const data = getResourceData(res);
        if (data) {
            const parsed = JSON.parse(data.toString('utf-8'));
            if (Array.isArray(parsed) && parsed.every(isQrCode)) {
                return parsed;
            }
        }
    }
    return [];
}
