export const QR_POSITIONS = [
    'top-left', 'top', 'top-right',
    'left', 'right',
    'bottom-left', 'bottom', 'bottom-right',
] as const;

export type QrPosition = typeof QR_POSITIONS[number];

export const DEFAULT_QR_POSITION: QrPosition = 'bottom-left';

export function isQrPosition(value: unknown): value is QrPosition {
    return typeof value === 'string' && (QR_POSITIONS as readonly string[]).includes(value);
}

export const QR_POSITION_LABELS: Record<QrPosition, string> = {
    'top-left': 'Top left',
    'top': 'Top',
    'top-right': 'Top right',
    'left': 'Left',
    'right': 'Right',
    'bottom-left': 'Bottom left',
    'bottom': 'Bottom',
    'bottom-right': 'Bottom right',
};
