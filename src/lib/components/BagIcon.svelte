<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- A drawstring bag, as tokens are drawn from -->
<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M8.5 8.5C5.5 11 3.5 14 3.5 17.5A3.5 3.5 0 0 0 7 21h10a3.5 3.5 0 0 0 3.5-3.5c0-3.5-2-6.5-5-9" /><path d="M8.5 8.5 6.5 4c2 .9 3.6.9 5.5-.4 1.9 1.3 3.5 1.3 5.5.4l-2 4.5" /><path d="M7.5 8.5h9" />
</svg>
