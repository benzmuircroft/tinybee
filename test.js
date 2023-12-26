;(async function() {

  const userKey = 'subNameString';
  
  const tinybee = require('tinybee')('folderNameOrCorestore', 'inputName');

  await tinybee.put('a', 0);
  await tinybee.put('b', 'string');
  await tinybee.put('c', { d: [0, 1, 2] });
  
  console.log(await tinybee.get('a')); // 0
  console.log(await tinybee.get('b')); // 'string'
  console.log(await tinybee.get('c')); // { d: [0, 1, 2] }
  
  // del
  await tinybee.del('a');
  
  // using subs
  await tinybee.put('a', 0, userKey);
  console.log(await tinybee.get('a', userKey));
  await tinybee.del('a', userKey);
  
  // get all entries as JSON object
  await tinybee.get();
  
})();
