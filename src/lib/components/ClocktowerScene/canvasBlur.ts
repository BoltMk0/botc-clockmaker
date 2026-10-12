// Safari (at least through recent versions) silently ignores
// CanvasRenderingContext2D's `filter` property when set to a `blur(...)`
// value - shapes drawn under it come out perfectly crisp instead of soft,
// which is very visible on the clouds/mist sprites that rely on a heavy
// blur to read as billowy rather than as hard-edged discs. `shadowBlur`,
// unlike `filter`, has been supported everywhere (including old Safari) for
// as long as canvas has existed, so this fakes a blurred fill by drawing the
// real shape far outside the canvas and using `shadowOffsetX` to shift only
// its (blurred) shadow back into view - the actual crisp shape itself never
// lands inside the visible canvas area, only its blur does.
export function fillBlurredCircle(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    blurPx: number,
    color: string
) {
    const OFFSET = 10000;
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = blurPx;
    ctx.shadowOffsetX = OFFSET;
    ctx.beginPath();
    ctx.arc(cx - OFFSET, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
