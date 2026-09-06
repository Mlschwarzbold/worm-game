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
