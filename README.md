# 🕳🥊 tinybee
A hyperbee that removes history on startup

## Installation:
```
npm i "github:benzmuircroft/tinybee"
```

## Usage:
```js
const tinybee = require('tinybee')('folderName');

await tinybee.put('a', 0);

console.log(await tinybee.get('a')); // 0
```
