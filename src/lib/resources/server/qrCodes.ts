import { getMimeTypeForExtension } from "../common/util";
import { DEFAULT_QR_POSITION, isQrPosition, type QrPosition } from "../common/qrCodes";
import { encodeResourceId, findResourceById, getResourceData, saveResource } from "./resources";

export type QrCode = {
    url: string;
    title: string;
    position: QrPosition;
};

export function isQrCode(value: unknown): value is QrCode {
    return typeof value === 'object' && value !== null &&
        'url' in value && typeof (value as QrCode).url === 'string' &&
        'title' in value && typeof (value as QrCode).title === 'string' &&
        'position' in value && isQrPosition((value as QrCode).position);
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
            if (Array.isArray(parsed)) {
                // Entries saved before positions existed get the default position.
                const codes = parsed.map(c => (typeof c === 'object' && c !== null && !('position' in c))
                    ? { ...c, position: DEFAULT_QR_POSITION } : c);
                if (codes.every(isQrCode)) {
                    return codes;
                }
            }
        }
    }
    return [];
}
