<script lang="ts">
    import gothicWindowCircle from '$lib/assets/gothic-window-circle-2.png';

    export let windowSize: number = 0.85;
</script>

<style>

    .window-light {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        transition: all 1s;
    }

    .window-light.background {
        background-color: var(--hue-dark);
    }

    .window-light.foreground {
        inset: calc((1 - var(--window-size)) * 50%);
        background-color: var(--hue);
        opacity: 0.8;
    }

    .window {
        position: absolute;
        inset: calc((1 - var(--window-size)) * 50%);
        width: calc(var(--window-size) * 100%);
        height: calc(var(--window-size) * 100%);
        object-fit: contain;
        border-radius: 50%;
        overflow: hidden;
        transition: background-color 1s ease;
        box-shadow: 0 0 30px inset black;
        opacity: 0.15;
    }
</style>

<div style="position:relative; width: 100%; height: 100%; --window-size: {windowSize};">
    <div style="position: absolute; inset: 0;">
        <div class="window-light background"></div>
        <div class="window-light foreground"></div>
        <img src="{gothicWindowCircle}" class="window" alt="Gothic Window Circle" style="--sky-color: var(--hue)"/>
    </div>
</div>