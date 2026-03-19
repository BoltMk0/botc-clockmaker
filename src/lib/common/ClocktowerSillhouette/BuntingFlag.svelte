<script lang="ts">
    export let x: number;
    export let y: number;
    export let width: number;
    export let height: number;
    export let color: string;
</script>

<svg viewBox="0 0 100 100" x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="none"  style="fill: {color};">
    <polygon points="0,0 100,0 50,100"/>
</svg>