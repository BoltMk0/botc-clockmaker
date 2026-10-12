<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M4 7h16" /><path d="M9 7V4.5h6V7" /><path d="M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" />
</svg>
