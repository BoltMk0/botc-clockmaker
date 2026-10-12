<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M9 21V9l3-5 3 5v12" />
    <circle cx="12" cy="11.5" r="1.8" />
    <path d="M9 21H3v-7l3-2 3 2" />
    <path d="M15 21h6v-7l-3-2-3 2" />
    <path d="M2 21h20" />
</svg>
