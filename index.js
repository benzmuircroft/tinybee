const tinybee = async (_options) => {
  const options = { ..._options };
  return new Promise((resolve) => {
    ;(async function() {
      const Hyperbee = require('hyperbee');
      const fs = require('fs').promises;
      
      let store;
  
      if (typeof options.folderNameOrCorestore  == 'string') {
        const Corestore = require('corestore');
        store = new Corestore(options.folderNameOrCorestore);
      }
      else if (typeof options.folderNameOrCorestore == 'object') {
        store = options.folderNameOrCorestore;
      }
      else {
        throw new Error('options.folderNameOrCorestore should be a string or a corestore');
      }
      
      const debug = options.debug;
      console.log('debug:', debug);
      const key = options.key;
      const keyPair = options.keyPair;
      
      delete options.folderNameOrCorestore;
      delete options.debug;
      delete options.key;
      delete options.keyPair;
      
      await store.ready();
      let input, db, tb;
  
      if (!keyPair) {
        if (debug) console.log('read only core');
        input = store.get({ key });
        await input.ready();
        db = new Hyperbee(input);
        await db.ready();
      }
      else {
        input = store.get({ keyPair });
        await input.ready();
        if (input.length) {
          if (debug) console.log('removing cores history ...');
          db = new Hyperbee(input);
          await db.ready();
          const trim = db.core.length;
          const view = db.createReadStream();
          for await (const entry of view) {
            let key = entry.key.toString();
            if (key.includes('\x00')) {
              key = key.split('\x00')[1];
            }
            const value = entry.value.toString();
            await db.put(key, value);
          }
          await db.core.clear(0, trim);
          if (debug) {
            console.log('removed');
            await db.put('debug', '0');
            console.log('debug should be 0:', await db.get('debug'));
            await db.del('debug');
          }
        }
        else {
          if (debug) console.log('fresh core');
          db = new Hyperbee(input);
          await db.ready();
        }
      }
  
      tb = {
        db,
        batch: async function(array /*[[put/del, k, v],]*/, sub) {
          let batch;
          if (sub) {
            if (!((await db.get('subs')) || []).includes(sub)) await db.put('subs', sub);
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
            if (debug) console.log(job[0], job[1], job[2]);
            if (job[0] == 'put') await batch.put(job[1], job[2]);
            else if (job[1] == 'del') await batch.del(job[1]);
          }
          await batch.flush();
        },
        put: async function(k, v, sub) {
          if (typeof v !== 'string') v = JSON.stringify(v);
          if (sub) {
            if (!((await db.get('subs')) || []).includes(sub)) await db.put('subs', sub);
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
  
      if (!keyPair && false) {
        delete tb.batch;
        delete tb.put;
        delete tb.del;
      }
      tb = { ...tb, ...options };
      resolve(tb);
    })();
  });
};

module.exports = tinybee;
