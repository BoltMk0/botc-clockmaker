<script lang="ts">
    import { T } from "@threlte/core";

    // Debug aid: a marker pinned at wherever the configured `origin` point
    // of the tower artwork actually lands (world origin, shifted by the same
    // `horizontalOffset` the tower itself is drawn with). Useful for
    // calibrating that point against new art.
    let {
        size,
        horizontalOffset
    }: {
        size: number;
        horizontalOffset: number;
    } = $props();
</script>

<T.Mesh position={[horizontalOffset, 0, 0.1]}>
    <T.RingGeometry args={[size * 0.01, size * 0.015, 32]} />
    <T.MeshBasicMaterial color="#ff00ff" transparent opacity={0.8} depthTest={false} />
</T.Mesh>
