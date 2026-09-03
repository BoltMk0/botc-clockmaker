# Clockmaker

A simple app for tracking time during a blood on the clocktower game, with a nice satisfying "bong" sound. 

# Table of Contents
1. [Quickstart](#quickstart)
2. [Configuration and Resource Storage](#configuration-and-resource-storage)
3. [From source code](#from-source-code)
4. [Developing](#developing)

#### Features
- Timer countown & Day tracker
- Supports multiple clients all operating synchronously
- Configurable timer options

#### Screenshot
![Screenshot](res/screen1.jpg)


# Quickstart
> Requires Docker

This app is now available via the docker public image repository, so can be run with one line:

```sh
docker run -d --restart unless-stopped -p "3000:3000" --name botc-clockmaker boltmk0/botc-clockmaker:latest
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
Configuration data and customized resources are, by default, found at `/data` inside the container.

For persisting configuration & customization, be sure to use volumes: 
```sh
docker run -d --restart unless-stopped -p "3000:3000" -v botc-clockmaker-data:/data boltmk0/botc-clockmaker:latest
```
or
```yaml
# docker-compose.yml
services:
  server:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - data:/data
volumes:
  data:
```
This creates a docker volume that stores this data. It can be deleted with `docker volume rm <volume name>` (find the volume name using `docker volume ls`)

> <b>Cool tip</b><br/>Alternatively to docker volumes, you can use any local folder/directory by using a path, e.g. `./botc-clockmaker-data:/data`. This would create a directory called "botc-clockmaker-data" and store all resources there.

### Resource paths
Found in the data directory are config files and resources that can be overwritten:
| Path in data directory | Supported extensions | Description |
| --- | --- | --- |
| config/botc-clockmaker.config.json | .json | Main configuration file |
| audio/final-bell.* | .wav, .mp3, .aac, .ogg | Audio resource used for final bell ring |
| audio/reminder-bell.* | .wav, .mp3, .aac, .ogg | Audio resource used for reminder bell ring. If not found, will use audio/final-bell |


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
npm install # Install dependencies
npm run build # Build the production server
node build # Run the production server
```

Then, open a browser and navigate to:
- `http://<host>:3000` for the client
- `http://<host>:3000/admin` for admin controls
- `http://<host>:3000/debug` for debug info
(where `<host>` is the address of the host machine, either IP address (e.g. 192.168.0.64), or hostname. On the same machine, you can use "localhost" (e.g. http://localhost:3000/admin))


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
