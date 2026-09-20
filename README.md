# Clockmaker

A simple app for tracking time during a blood on the clocktower game, with a nice satisfying "bong" sound. 

# Table of Contents
1. [Quickstart](#quickstart)
2. [Configuration and Resource Storage](#configuration-and-resource-storage)
3. [From source code](#from-source-code)
4. [Developing](#developing)

#### Features
- Timer countdown & day tracker, with bell sounds
- Supports multiple games and multiple clients (phones, tablets, screens) all operating synchronously
- 3D "clocktower" town square display, and a storyteller grimoire
- Audio mixer & ambience
- Rules slides, scripts, characters and configurable timer options
- No database: everything is stored as plain files (see [Configuration and Resource Storage](#configuration-and-resource-storage))

#### Screenshot
![Screenshot](res/screen1.jpg)


# Quickstart
> Requires Docker

This app is now available via the docker public image repository, so can be run with one line:

```sh
docker run -d \
  --restart unless-stopped \
  -p "3000:3000" \
  boltmk0/botc-clockmaker:latest
```

Alternatively, using docker compose


```yaml
# docker-compose.yml
services:
  server:
    image: boltmk0/botc-clockmaker:latest
    ports:
      - "3000:3000"
```
```sh
docker compose up -d
```

## Configuration and Resource Storage
All configuration and content (games, presets, scripts, characters, audio, images, grimoire state, ...) is stored as flat JSON/binary files. The storage root defaults to `data/resources` relative to the working directory, and can be set with the `RESOURCE_DATA_DIR` environment variable. The docker setups above set it to `/data` inside the container.

For persisting configuration & customization, be sure to mount a volume at that path:
```sh
docker run -d \
--restart unless-stopped \       # Auto start when the host machine boots
-p "3000:3000" \                 # Bind port 3000
-e RESOURCE_DATA_DIR=/data \     # Set the resource data directory
-v botc-clockmaker-data:/data \  # Map the resource data directory to a docker volume
boltmk0/botc-clockmaker:latest
```
or
```yaml
# docker-compose.yml
services:
  server:
    image: boltmk0/botc-clockmaker:latest
    ports:
      - "3000:3000"
    volumes:
      - data:/data
    environment:
      - RESOURCE_DATA_DIR=/data
volumes:
  data:
```
This creates a docker volume that stores this data. It can be deleted with `docker volume rm <volume name>` (find the volume name using `docker volume ls`)

> <b>Note</b><br/>Alternatively to docker volumes, you can use any local folder/directory by using a path, e.g. `./botc-clockmaker-data:/data`. This would create a directory called "botc-clockmaker-data" and store all resources there.

Most content is managed in the app itself, under **Settings** (games, scripts, characters, resources such as audio and images, QR codes and timer options), so you shouldn't normally need to edit these files by hand. Files are grouped into one subdirectory per kind of resource (e.g. `audio`, `ambience`, `characters`, `scripts`, `presets`, `singletons`).

### Environment variables
| Variable | Description |
| --- | --- |
| `RESOURCE_DATA_DIR` | Where configuration and resources are stored (default `data/resources`) |
| `PORT` | Port to serve on (default `3000`) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FEEDBACK_TO_EMAILS` | Optional. Used to email submissions from the feedback form. Without them, feedback is still saved to disk but no email is sent |
| `TURNSTILE_SECRET_KEY` | Optional. Cloudflare Turnstile secret for the feedback form |


<br>
<br>
<br>
<br>
<br>
<br>


# From source code
## Running the app
This section covers building and running the app from source. 

### Building & running using Docker (Recommended)

> Requires Docker installed & running

```sh
docker compose up
```

### Building & running with NodeJS:
> Requires NodeJS v24.5.0 or higher

```sh
npm install          # Install dependencies
npm run build        # Build the production server
node build           # Run the production server
```

Then, open a browser and navigate to `http://<host>:3000`, where `<host>` is the address of the host machine, either IP address (e.g. 192.168.0.64), or hostname. On the same machine, you can use "localhost" (e.g. http://localhost:3000).

From the main menu:
- **Play** lists your games, with links to each game's town square display and its storyteller page (grimoire and clock timer controls)
- **Rules** shows the uploaded rules slides
- **Settings** manages games, scripts, characters, resources, QR codes and timer options


### Changing the port
- <b>Docker</b>: Edit "docker-compose.yml" and update the following lines:
    ```yaml
        ...
        ports:
            - "<PORT>:3000"
        ...
    ```
    Then run again.
- <b>NodeJS</b>: Run `PORT=<PORT> node build`


(where `<PORT>` is your desired port)

## Developing

> Requires NodeJS v24.5.0 or higher

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm install
npm run dev -- --host --open
```

(Note: --host will serve on all interfaces so that you can access the webpage from other devices)<br>
(Note: --open will automatically open the root page in your browser)

## Building
> Requires NodeJS v24.5.0 or higher

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

## Building the Docker image
> Requires Docker, and NodeJS

```sh
npm run docker:build   # Build the image locally, tagged :latest and :<package.json version>
npm run docker:push    # Build for linux/amd64 and push both tags to the registry (run `docker login` first)
```
Both accept options after `--`, e.g. `npm run docker:push -- --registry my.registry.io -o image.tar`. Run either with `-- --help` to see them all. The scripts live in the [scripts](scripts) folder.
