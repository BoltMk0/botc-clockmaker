<script lang="ts">
    import { T, useThrelte } from "@threlte/core";

    let {
        visibleHeight
    }: {
        visibleHeight: number;
    } = $props();

    const CAMERA_DISTANCE = 20;

    const { size } = useThrelte();

    // Threlte keeps a non-manual orthographic camera's left/right/top/bottom
    // in sync with the canvas's pixel size automatically (1 world unit = 1px
    // at zoom 1) and clobbers any explicit left/right/top/bottom props every
    // frame. `zoom` is the one frustum property it still lets us drive
    // reactively, so cropping/zooming is expressed through it: zoom = 1 shows
    // `visibleHeight` world-units across the canvas's full height.
    const zoom = $derived($size.height / visibleHeight);
</script>

<T.OrthographicCamera makeDefault position={[0, 0, CAMERA_DISTANCE]} {zoom} near={0.1} far={200} />
