const tinybee = async (folderName, inputName, debug) => { // self-invoking function
  return new Promise(async (resolve) => {
    const Corestore = require('corestore');
    const Hyperbee = require('hyperbee');

    if (!folderName || typeof folderName !== 'string') {
      throw new Error('folderName should be a string');
    }
    
    const store = new Corestore(folderName);
    await store.ready();
    let input, backup, db, tb;
    backup = store.get({ name: `${inputName}-backup`, sparse:false, createIfMissing: false, overwrite: false });
    if (debug) console.log(backup);
    if (backup.id) {
      input = store.get({ name: inputName, sparse: false, overwrite: true });
      if (debug) console.log('core migration was not completed. using backup instead.');
      await backup.ready();
      let s1 = backup.replicate(true);
      let s2 = input.replicate(false);
      s1.pipe(s2).pipe(s1);
      db = new Hyperbee(input);
      await db.ready();
    }
    else {
      input = store.get({ name: inputName, sparse: false });
      await input.ready();
      if (input.length) {
        backup = store.get({ name: `${inputName}-backup`, sparse: false });
        let s1 = input.replicate(true);
        let s2 = backup.replicate(false);
        s1.pipe(s2).pipe(s1);
        let migrate = new Hyperbee(input);
        const view = migrate.createReadStream();
        const obj = {};
        for await (const entry of view) {
          obj[entry.key.toString()] = entry.value.toString();
        }
        if (debug) console.log('migrating core entries', obj);
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
        if (debug) console.log('fresh core');
        db = new Hyperbee(input);
        await db.ready();
      }
    }
    tb = {
      put: async function(k, v, sub) {
        if (typeof v !== 'string') v = JSON.stringify(v);
        if (sub) {
          sub = db.sub(sub);
          await sub.put(k, v);
        }
        else {
          await db.put(k, v);
        }
      },
      get: async function(k, sub) {
        if (!k) {
          let all;
          if (sub) {
            sub = db.sub(sub);
            all = sub.createReadStream();
          }
          else {
            all = db.createReadStream();
          }
          const obj = {};
          for await (const entry of all) {
            entry.value = entry.value.toString();
            if (['[', '{'].includes(entry.value[0])) entry.value = JSON.parse(entry.value);
            obj[entry.key.toString()] = entry.value;
          }
          return obj;
        }
        else {
          k = await db.get(k);
          if (!k) return null;
          k = k.value.toString();
          if (['[', '{'].includes(k[0])) return JSON.parse(k);
          else return k;
        }
      },
      del: async function(k, sub) {
        if (sub) {
          sub = db.sub(sub);
          await sub.del(k);
        }
        else {
          await db.del(k);
        }
      }
    }; // tb
    resolve(tb);
  });
};

module.exports = tinybee;
