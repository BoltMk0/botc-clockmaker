# Lightscapes

Zigbee lighting for Clockmaker. Lightscapes follows one game's day cycle and sets your Zigbee lights to match:

- a **scene** for each phase (morning, day, dusk and night)
- a **day spectrum** that fades through the town square's sky colours as the countdown runs
- **flashes** when the bells ring

It also turns Zigbee buttons into a clock remote.

It runs on a small computer near the game, such as a Raspberry Pi, next to [Zigbee2MQTT](https://www.zigbee2mqtt.io/)
(which drives the Zigbee USB adapter) and the Mosquitto MQTT broker the two talk through. The computer only connects
*out*, to Clockmaker, so it works on any network. With Tailscale on it, Clockmaker can stay on your tailnet.

```
 Zigbee adapter ── Zigbee2MQTT ── Mosquitto ── Lightscapes ──(Tailscale)──▶ Clockmaker
                     :8080                        :8090
```

The user guide is [doc/lightscapes.md](../doc/lightscapes.md). This page covers installing it.

## Setting up

You'll need Docker with Compose, a Zigbee USB adapter Zigbee2MQTT supports, and a clone of this repository. The image is
built from the repository root, because Lightscapes shares some of Clockmaker's source.

1. **Give Clockmaker an API token.** In Clockmaker, open *Settings → API Token* and click **Create token**. Copy the
   token now: it's only shown once.

2. **Find the adapter** by its stable path:

   ```sh
   ls -l /dev/serial/by-id/
   ```

3. **Configure**, from this folder:

   ```sh
   cp .env.example .env            # then set ZIGBEE_ADAPTER (and the rest, if you like)
   mkdir -p data/zigbee2mqtt
   cp zigbee2mqtt/configuration.yaml data/zigbee2mqtt/
   ```

   If Zigbee2MQTT can't tell which adapter you have, uncomment its `adapter:` line in
   `data/zigbee2mqtt/configuration.yaml`.

4. **Start it:**

   ```sh
   docker compose up -d --build
   ```

5. **Pair your lights and buttons** in Zigbee2MQTT's page, `http://<this computer>:8080`:
   - Click *Permit join*, then put each device into pairing mode.
   - Give each one a name you'll recognise, like `table-lamp` or `st-button`.
   - For lights that should change together, make a *group*: it changes them all with one message, so they stay
     in step.

6. **Set up Lightscapes** in its page, `http://<this computer>:8090`:
   - Enter Clockmaker's address (as this computer reaches it, e.g. `http://homelab:3000`) and the token.
   - Click **Find games** and pick the game, then save.
   - Set the scenes, spectrum, bells and buttons.

From then on, Lightscapes starts with the computer and sets the lights to the game's phase as soon as it connects.

## Settings

| `.env` | |
| --- | --- |
| `ZIGBEE_ADAPTER` | The adapter's `/dev/serial/by-id/...` path. |
| `LIGHTSCAPES_PASSWORD` | Asked for by the Lightscapes page (any user name). Empty for none. |
| `BIND_ADDRESS` | The address both pages listen on. Use this computer's Tailscale address (`tailscale ip -4`) to keep them off the venue's network. Docker can't start the containers until that address exists, so Tailscale must be up first. |
| `TZ` | The time zone, for the logs. |

Lightscapes itself also reads `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` and `Z2M_BASE_TOPIC` (`zigbee2mqtt` by
default), and `DRY_RUN=1`, which logs what it would send to the lights instead of sending it. Its configuration is
kept in `data/lightscapes/lightscapes.json`.

## Security

Mosquitto has no logins and publishes no ports, so only Zigbee2MQTT and Lightscapes can reach it, over Compose's own
network.

The two pages listen on every network by default:
- Set `LIGHTSCAPES_PASSWORD` to protect the Lightscapes page.
- Set `BIND_ADDRESS` to keep both pages to your tailnet.
- Zigbee2MQTT's page has its own `frontend.auth_token` option, to ask for a password.

## Troubleshooting

- **Clockmaker: "The API token was refused".** The token was replaced or revoked in Clockmaker. Create a new one and
  enter it in Lightscapes.
- **Clockmaker can't be reached by its Tailscale name.** The container may not resolve MagicDNS names. Use the
  Tailscale IP address instead, or uncomment the `dns:` lines in `docker-compose.yml`.
- **Zigbee2MQTT: offline.** Check `docker compose logs zigbee2mqtt`. It's usually the adapter path, or the adapter type.
- **Rootless Docker** (Docker run as your own user) can only pass the adapter through if your user can open it. The
  adapter belongs to `root:dialout` by default. A udev rule giving it to your user fixes that; use the `serial` from
  `udevadm info -a -n /dev/ttyUSB0`, then unplug and replug the adapter:

  ```sh
  echo 'SUBSYSTEM=="tty", ATTRS{serial}=="<serial>", OWNER="<your user>"' | sudo tee /etc/udev/rules.d/99-zigbee-adapter.rules
  sudo udevadm control --reload
  ```
- **A light ignores colours.** Some bulbs only do white, or only do brightness. The page warns when a light doesn't
  say it can do what's asked.

## Developing

```sh
npm install
npm run check     # type-checks, along with the Clockmaker files it shares
npm run dev       # builds, then runs on :8090 with DRY_RUN, against an MQTT broker on localhost:1883
```

- **Clockmaker:** point it at a Clockmaker dev server (`npm run dev` in the repository root) with an API token.
- **Testing without Zigbee hardware:** publish Zigbee2MQTT's topics to the broker yourself, e.g. a retained
  `zigbee2mqtt/bridge/devices` list, and `{"action":"single"}` on a button's topic.
