# 🕳🥊 Tinybee
A hyperbee that removes history on startup

## Installation:
```
npm i "github:benzmuircroft/tinybee"
```

## Usage:
```js
const tinybee = require('tinybee')('folderName');

await tinybee.put('a', 0);
await tinybee.put('b', 'string');
await tinybee.put('c', { d: [0, 1, 2] });

console.log(await tinybee.get('a')); // 0
console.log(await tinybee.get('b')); // 'string'
console.log(await tinybee.get('c')); // { d: [0, 1, 2] }
```

*" best used for a private core ... "*
