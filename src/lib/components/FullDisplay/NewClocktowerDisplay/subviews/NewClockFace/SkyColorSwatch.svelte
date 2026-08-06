<script lang="ts">
    import { getSkyColor } from "$lib/common/util";

    let { nsteps = 1000 }: { nsteps?: number } = $props();

    const colors = $derived(Array.from({length: nsteps}, (_, i) => {
        let t = i/(nsteps-1);
        return getSkyColor(t);
    }));

</script>

<style>
    .sky-color-swatch {
        width: 100%;
        height: 100%;
    }
</style>

<div class="sky-color-swatch" style="background: linear-gradient(to right, {colors.join(', ')});">

</div>