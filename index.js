const tinybee = async (options) => { // self-invoking function
  return new Promise(async (resolve) => {
    const Corestore = require('corestore');
    const Hyperbee = require('hyperbee');

    let base, swarm, keyPair;

    if (!options) {
      throw new Error('options object is missing');
    }
    else if (!options.folderName || typeof options.folderName !== 'string') {
      throw new Error('options.folderName should be a string');
    }
    else if (options.testFolder && typeof options.testFolder !== 'string') {
      throw new Error('options.testFolder should be a string');
    }

    let folder = `./${options.folderName}`;
    if (options.testFolder) {
      folder += `/${options.testFolder}`;
    }
    
    const store = new Corestore(folder);
    await store.ready();
    let input, backup, db, hd;
    backup = store.get({ name: 'backup', sparse:false, createIfMissing: false, overwrite: false });
    console.log(backup);
    if (backup.id) {
      console.log('bu');
      await backup.ready();
      let s1 = backup.replicate(true);
      let s2 = input.replicate(false);
      s1.pipe(s2).pipe(s1);
      db = new Hyperbee(input);
      await db.ready();
    }
    else {
      input = store.get({ name: 'input', sparse: false });
      await input.ready();
      if (input.length) {
        console.log('mg');
        backup = store.get({ name: 'backup', sparse: false });
        let s1 = input.replicate(true);
        let s2 = backup.replicate(false);
        s1.pipe(s2).pipe(s1);
        let migrate = new Hyperbee(input);
        const view = migrate.createReadStream();
        const obj = {};
        for await (const entry of view) {
          obj[entry.key.toString()] = entry.value.toString();
        }
        console.log(obj);
        await input.purge();
        input = store.get({ name: 'input', sparse: false });
        await input.ready();
        db = new Hyperbee(input);
        await db.ready();
        for (const entry in obj) {
          await db.put(entry, obj[entry]);
        }
        await migrate.close();
        await backup.purge();
      }
      else {
        console.log('nm');
        db = new Hyperbee(input);
        await db.ready();
      }
    }
    hd = {
      bee: db, // todo: remove
      put: async function(k, v) {
        await db.put(k, v);
      },
      get: async function(k) {
        k = await db.get(k);
        if (!k) return null;
        k = k.value.toString();
        if (['[', '{'].includes(k[0])) return JSON.parse(k);
        else return k;
      }
    }; // hd
  });
};

module.exports = tinybee;
