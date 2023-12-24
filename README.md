# 🕳🥊 tinybee
A hyperbee that removes history on startup

```js
const tinybee = require('tinybee');

await tinybee.put('a', 0);

console.log(await tinybee.get('a'));
```
