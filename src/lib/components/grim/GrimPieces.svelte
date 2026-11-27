<script lang="ts">
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import PlayerToken from "$lib/components/PlayerToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import { BOARD_TOKEN_SIZE, hasDeadVote, type PlacedReminder, type PlacedToken } from "$lib/resources/common/grimoireState.js";
    import { GRIM_Z, isSideRoleCategory, type GrimModel } from "./GrimModel.svelte";

    // The tokens and reminders on a grim, each placed about the centre of whatever holds them (which may be 0 wide).
    // With the pointer handlers they can be picked up; without them they're only a picture (e.g. a grim being saved
    // as one).

    let { model, ontokenpointerdown, onreminderpointerdown }: {
        model: GrimModel;
        ontokenpointerdown?: (e: PointerEvent, token: PlacedToken) => void;
        onreminderpointerdown?: (e: PointerEvent, reminder: PlacedReminder) => void;
    } = $props();

    const tokenSize = BOARD_TOKEN_SIZE;
    const reminderTokenSize = Math.round(tokenSize * 0.56);
</script>

{#each model.placedTokens as token (token.id)}
    {@const character = model.characterById.get(token.characterId ?? '')}
    {@const sideRole = isSideRoleCategory(character?.category)}
    {@const seated = model.seatedTokenIds.has(token.id)}
    {#if character || token.characterId === null}
    <div
        class="board-token"
        class:movable={!!ontokenpointerdown}
        class:dead={!sideRole && token.isDead}
        class:unnamed={!seated}
        class:misaligned={!sideRole && token.characterId !== null && model.defaultAlignmentFor(token.characterId) !== token.alignment}
        style="left: calc(50% + {token.x}px); top: calc(50% + {token.y}px); z-index: {seated ? GRIM_Z.tokens : GRIM_Z.unnamedTokens};"
        onpointerdown={ontokenpointerdown && ((e) => ontokenpointerdown(e, token))}
    >
        {#if character}
            <CharacterToken {character} style="position: relative;" size={tokenSize + 'px'} norules
                dead={sideRole ? false : token.isDead}
                hasDeadVote={sideRole ? false : hasDeadVote(token)}
                alignment={sideRole ? undefined : token.alignment}
                playerName={sideRole ? undefined : (token.playerName?.trim() || undefined)}
                outline={seated && !token.isDead}/>
        {:else}
            <PlayerToken playerName={token.playerName ?? ''} isDead={token.isDead} hasDeadVote={hasDeadVote(token)} style="position: relative;" size={tokenSize + 'px'}/>
        {/if}
    </div>
    {/if}
{/each}

{#each model.placedReminders as reminder}
    {@const token = model.reminderById[reminder.tokenId]}
    {#if token}
    <div
        class="board-reminder"
        class:movable={!!onreminderpointerdown}
        style="left: calc(50% + {reminder.x}px); top: calc(50% + {reminder.y}px); z-index: {GRIM_Z.reminders};"
        onpointerdown={onreminderpointerdown && ((e) => onreminderpointerdown(e, reminder))}
    >
        <ReminderTokenView data={token} characterId={token.characterId} size="{reminderTokenSize}px"/>
    </div>
    {/if}
{/each}

<style>
    .board-token,
    .board-reminder {
        position: absolute;
        transform: translate(-50%, -50%);
        user-select: none;
    }

    .movable {
        cursor: grab;
        touch-action: none;
    }

    .movable:active {
        cursor: grabbing;
    }

    /* Character tokens that aren't players (unnamed while others are named, and loric/fabled) are only reminders, so let them sit back a little. */
    .board-token.unnamed {
        opacity: 0.8;
    }

    .board-token.dead :global(img:not(.dead-vote-icon)) {
        filter: grayscale(0.7) brightness(0.6);
    }
    .board-token.misaligned :global(img:not(.dead-vote-icon)) {
        filter: hue-rotate(180deg);
    }
    .board-token.misaligned.dead :global(img:not(.dead-vote-icon)) {
        filter: grayscale(0.7) brightness(0.9) hue-rotate(180deg);
    }
</style>
