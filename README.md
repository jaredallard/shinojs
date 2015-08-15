# shinobot

A super modular Twitter bot.

## Installation

```bash
git clone https://github.com/jaredallard/shinobot
cd shinobot
npm install
```

## Making Rules

Open `command.json` and `lib/command_functions.js`.

A rule looks like this:

```json
{
  "command": "",
  "function": "",
  "response": ""
}
```

##### `command` - command to trigger execution

##### `function` - function in `lib/command_functions.js` to execute on trigger

##### `response` - Handlebars template to format with the function.


### Example Creation:

Add a new JSON object into the array in command.json. i.e

```json
{
  "command": "my-command",
  "function": "myCommandFunction",
  "response": "my {{variable}} response"
}
```

Now create a function in the `command_functions.js` file we just opened like so:

```js
cf.myCommandFunction = function(tweet, array) {
  var text = array.template({
    variable: "totally unique"
  })
  tweet.reply(text);
  return true;
}
```

You can do anything with the [handlebars](https://handlebarsjs.com) template!

## License

MIT
