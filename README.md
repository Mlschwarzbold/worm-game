# Worm Game

## Run locally with Docker

Build the image from the project directory:

```bash
docker build -t worm-game .
```

Start the web server:

```bash
docker run --rm -p 8081:80 worm-game
```

Open  http://localhost:8081/  for the game or  http://localhost:8081/editor.html  for the level editor.

Stop the container with `Ctrl+C`.

## Deploy with Jenkins

Create a Pipeline job that points to this repository and uses the committed
`Jenkinsfile`. The Jenkins agent must have Docker installed and permission to
run Docker commands.

The pipeline builds the image and deploys a container named `worm-game` on port
`8081`. After a successful build, open:

- Game: http://localhost:8081/
- Level editor: http://localhost:8081/editor.html

If Jenkins runs on another machine, replace `localhost` with that machine's
hostname or IP address. The Jenkins Docker user must also be able to bind the
configured host port.
