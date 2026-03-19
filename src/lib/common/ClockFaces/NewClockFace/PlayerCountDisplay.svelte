<script lang="ts">
    import DisplayPanelBase from "./DisplayPanel/DisplayPanelBase.svelte";

    export let numPlayers: number;
    export let title = "Player Count";
    export let style = "";

    function getPlayerCount(numPlayers: number){
        let townsfolk: number;
        let outsiders: number;
        let minions: number;
        let demons: number = 1;

        if(numPlayers < 7){
            townsfolk = 3;
            minions = 1;
            outsiders = 6-numPlayers;
        } else if (numPlayers > 15) {
            townsfolk = 9;
            outsiders = 2;
            minions = 3;
        }
        else {
            townsfolk = 5 + 2*Math.floor((numPlayers-7)/3);
            outsiders = (numPlayers-7)%3;
            minions = 1 + Math.floor((numPlayers-7)/3);
        }

        return {townsfolk, outsiders, minions, demons};
    }

    $: playerCount = getPlayerCount(numPlayers);

</script>

<style>
    .time-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr 1fr;
        width: 100%;
        text-align: center;
        padding: 5px;
        box-sizing: border-box;
    }
    
    .player-type-label {
        font-size: 0.6em;
        opacity: 0.7;
    }

    .good {
        color: rgb(33, 184, 222);
        text-shadow: 0 3px 5px rgb(14, 146, 179, 0.5);
    }

    .evil {
        color: rgb(213, 46, 71);
        text-shadow: 0 3px 5px rgb(165, 28, 49, 0.5);
    }

    .player-count-number {
        font-size: 1.2em;
    }
</style>

<DisplayPanelBase title={title} style={style}>
    <div class="time-row">
        <div class="good">
            <div class="player-type-label good">T</div>
            <div class="player-count-number">{playerCount.townsfolk}</div>
        </div>
        <div class="good">
            <div class="player-type-label good">O</div>
            <div class="player-count-number">{playerCount.outsiders}</div>
        </div>
        <div class="evil">
            <div class="player-type-label evil">M</div>
            <div class="player-count-number">{playerCount.minions}</div>
        </div>
        <div class="evil">
            <div class="player-type-label evil">D</div>
            <div class="player-count-number">{playerCount.demons}</div>
        </div>
    </div>
</DisplayPanelBase>