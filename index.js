const tinybee = async (_options) => { // self-invoking function
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
      const key = options.key;
      const keyPair = options.keyPair;
      const backup = options.backup;
  
      delete options.backup;
      delete options.folderNameOrCorestore;
      delete options.debug;
      delete options.key;
      delete options.keyPair;
      
      await store.ready();
      let input, db, tb;
  
      if (!keyPair) {
        if (debug) console.log('read only core');
        input = store.get({ sparse: false, key });
        await input.ready();
        db = new Hyperbee(input);
        await db.ready();
      }
      else {
        input = store.get({ sparse: false, keyPair });
        await input.ready();
        if (input.length) {
          
          db = new Hyperbee(input);
          await db.ready();
          const trim = db.core.length;
          const view = db.createReadStream();
          for await (const entry of view) {
            await db.put(entry.key.toString(), entry.value.toString());
          }
          await db.core.clear(1, trim);
        }
        else {
          if (debug) console.log('fresh core');
          db = new Hyperbee(input);
          await db.ready();
        }
      }
  
      let mem = {
        subs: {},
        main: {
          subs: []
        }
      };
      
      if (backup) {
        try {
          await fs.stat(`./db/${backup.file}.json`);
        } catch (e) {
          await fs.writeFile(`./db/${backup.file}.json`, backup.encryptor.en(JSON.stringify(mem)), 'utf-8');
        }
      }
  
      const paper = {
        batch: async function(array, sub) {
          if (sub) {
            if (!mem.subs[sub]) {
              mem.subs[sub] = {};
              mem.main.subs.push(sub);
            }
          }
          for (const job of array) {
            if (!Array.isArray(job) || (job[1] == 'put' && job.length != 3) || (job[1] == 'del' && job.length != 2)) {
              throw new Error(`Malformed batch at ${JSON.stringify(job)}`);
            }
            if (job[2] && typeof job[2] !== 'string') job[2] = JSON.stringify(job[2]);
            if (sub) {
              if (job[0] == 'put') mem.subs[sub][job[1]] = job[2];
              else if (job[1] == 'del') delete mem.subs[sub][job[1]];
            }
            else if (job[0] == 'put') mem.main[job[1]] = job[2];
            else if (job[1] == 'del') delete mem.main[job[1]];
          }
          await fs.writeFile(`./db/${backup.file}.json`, backup.encryptor.en(JSON.stringify(mem)), 'utf-8');
        },
        put: async function(k, v, sub) {
          if (typeof v !== 'string') v = JSON.stringify(v);
          if (sub) {
            if (!mem.subs[sub]) {
              mem.subs[sub] = {};
              mem.main.subs.push(sub);
            }
            mem.subs[sub][k] = v;
          }
          else {
            mem.main[k] = v;
          }
          await fs.writeFile(`./db/${backup.file}.json`, backup.encryptor.en(JSON.stringify(mem)), 'utf-8');
        },
        del: async function(k, sub) {
          if (sub) {
            delete mem.subs[sub][k];
          }
          else {
            delete mem.main[k];
          }
          await fs.writeFile(`./db/${backup.file}.json`, backup.encryptor.en(JSON.stringify(mem)), 'utf-8');
        }
      };
  
      tb = {
        mem,
        db,
        batch: async function(array /*[[put/del, k, v],]*/, sub) {
          if (backup) await paper.batch(array, sub);
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
          if (backup) await paper.put(k, v, sub);
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
          if (backup) await paper.del(k, sub);
          if (sub) {
            sub = db.sub(sub);
            await sub.del(k);
          }
          else {
            await db.del(k);
          }
        }
      }; // tb
  
      if (backup) {
        // reconstruct
        mem.main = await tb.get();
        if (!mem.main.subs) mem.main.subs = [];
        for await (const sub of mem.main.subs) {
          mem.main[sub] = await tb.get(undefined, sub);
        }
        console.log(mem);
        if (Object.keys(mem.main).length == 1) {
          mem = JSON.parse(backup.encryptor.de(await fs.readFile(`./db/${backup.file}.json`, 'utf-8')));
          console.log(mem, JSON.stringify(mem).length);
          if (JSON.stringify(mem).length > 30) {
            for await (const [k, v] of mem.main) {
              await tb.put(k, v);
            }
            for await (const sub of mem.main.subs) {
              for await (const [k, v] of mem.subs[sub]) {
                await tb.put(k, v, sub);
              }
            }
          }
        }
      }
  
      if (!keyPair) {
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
