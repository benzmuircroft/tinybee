const tinybee = async (options) => { // self-invoking function
  return new Promise(async (resolve) => {
    const Hyperbee = require('hyperbee');
    const b4a = require('b4a');
    
    let store;

    if (!['string','undefined'].includes(typeof options.inputName)) {
      throw new Error('options.inputName should be undefined or a string');
    }
    if (typeof options.folderNameOrCorestore  == 'string') {
      const Corestore = require('corestore');
      if (Object.keys(options).length) store = new Corestore(options.folderNameOrCorestore, options);
      else store = new Corestore(options.folderNameOrCorestore);
    }
    else if (typeof options.folderNameOrCorestore == 'object') {
      store = options.folderNameOrCorestore;
    }
    else {
      throw new Error('options.folderNameOrCorestore should be a string or a corestore');
    }

    let writable = true;
    if (options.inputName && options.inputName.length == 64) {
      options.inputName = b4a.from(options.inputName, 'hex');
      writable = false;
    }
    
    await store.ready();
    let input, db, tb;

    if (!writable) { // todo: use RAM
      if (options.debug) console.log('read only core');
      input = store.get(options.inputName, { sparse: false });
      await input.ready();
      db = new Hyperbee(input);
      await db.ready();
      if (db.writable) writable = true; // user is recovering using hex id not publicKey assumed above
    }
    else {
      input = store.get({ name: options.inputName, sparse: false });
      await input.ready();
      if (input.length) {
        const migrate = new Hyperbee(input);
        const view = migrate.createReadStream();
        const obj = {};
        for await (const entry of view) {
          entry.key = entry.key.toString();
          if (entry.key.includes('\x00')) {
            entry.key = entry.key.split('\x00')[1];
          }
          entry.value = entry.value.toString();
          obj[entry.key] = entry.value;
        }
        if (options.debug) console.log('migrating core entries', obj);
        await input.purge();
        input = store.get({ name: options.inputName, sparse: false });
        await input.ready();
        db = new Hyperbee(input);
        await db.ready();
        for (const [key, value] of Object.entries(obj)) {
          await db.put(key, value);
        }
        await migrate.close();
      }
      else {
        if (options.debug) console.log('fresh core');
        db = new Hyperbee(input);
        await db.ready();
      }
    }
    
    tb = {
      batch: async function(array /*[[put/del, k, v],]*/, sub) {
        let batch;
        if (sub) {
          sub = db.sub(sub);
          batch = sub.batch();
        }
        else {
          batch = db.batch();
        }
        for await (const job of array) {
          if (!Array.isArray(job) || (job[1] == 'put' && job.length != 3) || (job[1] == 'del' && job.length != 2)) {
            throw new Error(`Malformed batch at ${JSON.stringify(job)}`);
          }
          if (job[2] && typeof job[2] !== 'string') job[2] = JSON.stringify(job[2]);
          if (options.debug) console.log(job[0], job[1], job[2]);
          if (job[0] == 'put') await batch.put(job[1], job[2]);
          else if (job[1] == 'del') await batch.del(job[1]);
        }
        await batch.flush();
      },
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
            entry.key = entry.key.toString();
            if (entry.key.includes('\x00')) {
              entry.key = entry.key.split('\x00')[1];
            }
            if (['[', '{'].includes(entry.value[0])) entry.value = JSON.parse(entry.value);
            obj[entry.key] = entry.value;
          }
          return obj;
        }
        else {
          if (sub) {
            sub = db.sub(sub);
            await sub.get(k);
          }
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
    if (!writable) {
      delete tb.batch;
      delete tb.put;
      delete tb.del;
    }
    tb = { ...tb, ...options };
    resolve(tb);
  });
};

module.exports = tinybee;
