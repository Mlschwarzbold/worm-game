window.WORM_LEVELS = window.WORM_LEVELS || [];

window.WORM_LEVELS.push({
  "id": "level-1",
  "name": "Beginning",
  "nodes": [
    {
      "id": "A",
      "x": 141.83624267578125,
      "y": 290.0045166015625,
      "type": "start"
    },
    {
      "id": "B",
      "x": 254.002685546875,
      "y": 242.96697998046875,
      "type": "normal"
    },
    {
      "id": "C",
      "x": 358.9325866699219,
      "y": 305.3821716308594,
      "type": "food"
    },
    {
      "id": "D",
      "x": 471.0990295410156,
      "y": 261.058349609375,
      "type": "normal"
    },
    {
      "id": "E",
      "x": 603.1659545898438,
      "y": 321.6643981933594,
      "type": "end"
    }
  ],
  "edges": [
    [
      "A",
      "B"
    ],
    [
      "B",
      "C"
    ],
    [
      "C",
      "D"
    ],
    [
      "D",
      "E"
    ]
  ]
});