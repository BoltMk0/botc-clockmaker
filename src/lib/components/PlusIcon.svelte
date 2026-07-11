<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill={color} focusable="false">
    <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />
</svg>
