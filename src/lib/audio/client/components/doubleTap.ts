import type { Action } from "svelte/action";

/** Max time between the two taps. */
const DOUBLE_TAP_MS = 350;
/** How far a finger can move during one tap before it counts as a drag instead. */
const TAP_SLOP_PX = 10;
/** How far apart the two taps can land. */
const DOUBLE_TAP_DISTANCE_PX = 30;

/**
 * Calls back on a double tap from touch/pen. Mobile browsers don't reliably fire `dblclick` on touch (a range input
 * in particular swallows the taps as drags), so sliders use this alongside `ondblclick`, which still covers the mouse.
 */
export const doubleTap: Action<HTMLElement, ()=>void> = (node, onDoubleTap) => {
    let callback = onDoubleTap;
    let downX = 0, downY = 0;
    let isTap = false;
    let lastTapTime = 0, lastTapX = 0, lastTapY = 0;

    function pointerdown(ev: PointerEvent){
        if(ev.pointerType === 'mouse') return;
        downX = ev.clientX;
        downY = ev.clientY;
        isTap = true;
    }

    function pointermove(ev: PointerEvent){
        if(ev.pointerType === 'mouse' || !isTap) return;
        if(Math.hypot(ev.clientX - downX, ev.clientY - downY) > TAP_SLOP_PX) isTap = false;
    }

    function pointercancel(){
        isTap = false;
    }

    function pointerup(ev: PointerEvent){
        if(ev.pointerType === 'mouse' || !isTap) return;
        isTap = false;
        if(Math.hypot(ev.clientX - downX, ev.clientY - downY) > TAP_SLOP_PX) return;
        const now = Date.now();
        if(now - lastTapTime < DOUBLE_TAP_MS && Math.hypot(ev.clientX - lastTapX, ev.clientY - lastTapY) < DOUBLE_TAP_DISTANCE_PX){
            lastTapTime = 0; // So a third tap starts a new pair rather than firing again
            // Deferred past the input's own change event for this tap, which would otherwise land after the
            // reset and put the slider back where the finger touched it.
            setTimeout(()=>callback?.(), 0);
            return;
        }
        lastTapTime = now;
        lastTapX = ev.clientX;
        lastTapY = ev.clientY;
    }

    node.addEventListener('pointerdown', pointerdown);
    node.addEventListener('pointermove', pointermove);
    node.addEventListener('pointerup', pointerup);
    node.addEventListener('pointercancel', pointercancel);
    return {
        update(newCallback){ callback = newCallback; },
        destroy(){
            node.removeEventListener('pointerdown', pointerdown);
            node.removeEventListener('pointermove', pointermove);
            node.removeEventListener('pointerup', pointerup);
            node.removeEventListener('pointercancel', pointercancel);
        }
    };
};
