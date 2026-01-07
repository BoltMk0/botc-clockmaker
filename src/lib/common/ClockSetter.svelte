<script lang="ts">
    import { formatTime } from "./util";

    type Option = {
        duration: number;
        ringBellAfter?: number;
    }


    const options: Option[] = [
        {duration: 0},
        {duration: 5},
        {duration: 30},
        {duration: 180, ringBellAfter: 150},
        {duration: 300, ringBellAfter: 270},
        {duration: 480, ringBellAfter: 450}
    ];

    
</script>
<div class="clock-setter-main">
    <div class="button-container">
        {#each options as option}
            <button on:click={() => {
                fetch('/admin/api/clock/setup', {
                    method: 'POST',
                    body: JSON.stringify({
                        duration: option.duration,
                        ringBellAfter: option.ringBellAfter
                    }),
                    headers: {'Content-Type': 'application/json'}
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to setup clock');
                    }
                    console.log("Clock setup successfully");
                }).catch(error => {
                    console.error("Error setting up clock:", error);
                });
            }}>
                {option.duration > 0 ? `${formatTime(option.duration)} ${option.ringBellAfter ? `(Bell after ${formatTime(option.ringBellAfter)})` : ''}` : 'Reset'}
            </button>
        {/each}
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; font-size: 1em; margin-top: 5px; gap: 5px;">
        <button on:click={() => {
            fetch('/admin/api/clock/stop', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to stop clock');
                }
                console.log("Clock stopped");
            }).catch(error => {
                console.error("Error stopping clock:", error);
            });
        }}>
            Stop
        </button>
        <button on:click={() => {
            fetch('/admin/api/clock/start', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to start clock');
                }
                console.log("Clock started");
            }).catch(error => {
                console.error("Error starting clock:", error);
            });
        }}>
            Start
        </button>

        <button on:click={() => {
            fetch('/admin/api/clock/ringBell', {
                method: 'POST'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to ring bell');
                }
                console.log("Bell rung");
            }).catch(error => {
                console.error("Error ringing bell:", error);
            });
        }}>
            Ring Bell
        </button>
    </div>
</div>

<style>
    .button-container {
        display: grid; 
        grid-template-columns: 1fr 1fr;
        gap: 5px;
    }

    button {
        padding: 10px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #444;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }
</style>