;(async function() {
  
  const tinybee = require('tinybee')({
    folderNameOrCorestore: './location',
    inputName: 'test',
    ...options
  });

  await tinybee.put('a', 0);
  await tinybee.put('b', 'string');
  await tinybee.put('c', { d: [0, 1, 2] });
  
  console.log(await tinybee.get('a')); // 0
  console.log(await tinybee.get('b')); // 'string'
  console.log(await tinybee.get('c')); // { d: [0, 1, 2] }
  
  // del
  await tinybee.del('a');
  
  // using subs
  const subName = 'subName';
  await tinybee.put('a', 0, subName);
  console.log(await tinybee.get('a', subName));
  await tinybee.del('a', subName);
  
  // get all entries as JSON object
  await tinybee.get();
  
  await tinybee.batch([
    ['put', 'h', 9],
    ['del', 'xyz'],
    ['put', 'abc', { frog: true }]
  ]);
  
  await tinybee.batch([
    ['put', 'name', 'benz'],
    ['put', 'password', 'xxxx']
  ], subName);
  
})();
