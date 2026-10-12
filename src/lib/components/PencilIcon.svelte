<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z" /><path d="M14 7l3 3" />
</svg>
