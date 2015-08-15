# shinojs

A super modular Twitter bot framework.

## Installation

```bash
git clone https://github.com/jaredallard/shinojs
cd shinobot
npm install
```

## Example commands.json

```json
{
  "events": [{
    "interval": 900000,
    "type": "timer",
    "function": "postImage"
  },
  {
    "type": "one-shot",
    "target": "never",
    "function": "postImage"
  },
  {
    "type": "one-shot",
    "target": "init",
    "function": "updateLocation"
  }],
  "commands": [{
    "pattern": [{
      "string": "version",
      "flag": "gi"
    },
    {
      "string": "--version",
      "flag": "gi"
    }],
    "function": "getVersion",
    "response": "v: {{version}} c: {{commit}}"
  },
  {
    "pattern": {
      "string": "get(images|img)",
      "flag": "gi"
    },
    "function": "getImage"
  },
  {
    "command": "hello-world",
    "response": "Hello, world!"
  }]
}
```

## License

MIT
