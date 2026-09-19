<script lang="ts">
    import { CHARACTER_CATEGORIES, type CharacterCategory, type ScriptCharacter } from "$lib/resources/common/gameData.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";

    interface Props {
        chars: ScriptCharacter[];
        isSelected?: (c: ScriptCharacter) => boolean;
        onpick?: (c: ScriptCharacter) => void;
        isDisabled?: (c: ScriptCharacter) => boolean;
        size?: string;
        /** Optional text appended to a category heading, e.g. a count. */
        headingSuffix?: (category: CharacterCategory) => string;
    }

    let { chars, isSelected = () => false, onpick, isDisabled = () => false, size = '110px', headingSuffix }: Props = $props();
</script>

<style>
    .token-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .token-wrapper {
        position: relative;
        width: var(--grid-token-size);
        height: var(--grid-token-size);
        cursor: pointer;
    }

    .token-wrapper.readonly {
        cursor: default;
    }

    .token-wrapper.disabled {
        cursor: not-allowed;
    }

    .tick {
        position: absolute;
        inset: 15%;
        width: 70%;
        height: 70%;
        pointer-events: none;
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8));
    }
</style>

{#each CHARACTER_CATEGORIES as category}
    {@const inCategory = chars.filter(c => c.category === category)}
    {#if inCategory.length > 0}
        <h3 style="margin: 0.5em 0 0.3em;">{category[0].toUpperCase() + category.slice(1)}{headingSuffix ? ` ${headingSuffix(category)}` : ''}</h3>
        <div class="token-list" style="--grid-token-size: {size};">
            {#each inCategory as character (character.id)}
                {@const selected = isSelected(character)}
                {@const disabled = !selected && isDisabled(character)}
                <div class="token-wrapper" class:disabled class:readonly={!onpick} onclick={() => !disabled && onpick?.(character)} role="button" tabindex="0" onkeydown={() => {}}>
                    <CharacterToken {character} {size} norules style="opacity: {selected ? 0.4 : disabled ? 0.3 : 1} !important;" />
                    {#if selected}
                        <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="4,13 10,19 20,6" />
                        </svg>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
{/each}
