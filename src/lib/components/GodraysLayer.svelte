<script lang="ts">
    let { style = "", tint = "#fff", rotation = 70 }: { style?: string; tint?: string; rotation?: number } = $props();
</script>

<style>
    .godrays-layer-main {
        width: 200%;
        height: 200%;
        position: absolute;
        transform-origin: center;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(var(--rotation));
        pointer-events: none;
        background: linear-gradient(0deg,
        rgb(from var(--tint) r g b / 0%) 20%,
        rgb(from var(--tint) r g b / 0%) 28%,
        rgb(from var(--tint) r g b / 9%) 30%,
        rgb(from var(--tint) r g b / 10%) 38%,
        rgb(from var(--tint) r g b / 20%) 39%,
        rgb(from var(--tint) r g b / 15%) 45%,
        rgb(from var(--tint) r g b / 20%) 55%,
        rgb(from var(--tint) r g b / 14%) 58%,
        rgb(from var(--tint) r g b / 18%) 63%,
        rgb(from var(--tint) r g b / 10%) 69%,
        rgb(from var(--tint) r g b / 00%) 75%);

        transition: transform 1s ease;
    }

    .godrays-layer-container {
        position: relative;
        width: 100%;
        height: 100%;
        aspect-ratio: 1/1;
        /* overflow: hidden; */
        pointer-events: none;
    }
</style>

<div style="position: absolute; inset: 0; width: 100%; height: 100%; {style}">
    <div class="godrays-layer-container">
        <div class="godrays-layer-main" style="--tint: {tint}; --rotation: {rotation}deg;">

        </div>
    </div>
</div>
