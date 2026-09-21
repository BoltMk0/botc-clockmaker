import { getMimeTypeForExtension } from "../common/util";
import { DEFAULT_QR_POSITION, isQrCode, type QrCode } from "../common/qrCodes";
import { encodeResourceId, findResourceById, getResourceData, saveResource } from "./resources";

// Re-exported for existing server-side imports; these are pure/common (no
// `fs`), and also live in ../common/qrCodes so client code (which can't pull
// in this file - see resources.ts's `fs` usage) can use them too.
export { type QrCode, isQrCode } from "../common/qrCodes";

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
