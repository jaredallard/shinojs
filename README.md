# shinojs

[![Code Climate](https://codeclimate.com/github/jaredallard/shinojs/badges/gpa.svg)](https://codeclimate.com/github/jaredallard/shinojs)

A super modular Twitter bot framework.

## Installation

```bash
git clone https://github.com/jaredallard/shinojs
cd shinobot
npm install
```

## `twit` extensions

Along with access to an authenticated twit object, three new methods are exposed;

### `.reply`

```js
<twit>.tweet.reply(text)
```

Reply to the tweet with `text`

### `.favorite`

```js
<twit>.tweet.favorite()
```

Favorite the tweet.

### `.retweet`

```js
<twit>.tweet.retweet()
```

Retweet the tweet.

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
      "string": "get(images?|imgs?)",
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
