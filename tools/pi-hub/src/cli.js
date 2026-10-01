import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createStore } from './store.js';
import { loadConfig } from './config.js';
import { hashPassword, strongEnough } from './auth.js';

const USAGE = `Usage: node src/cli.js <command>
  add-user <name> <admin|officer> [password]   create or update a login (a random password is printed if omitted)
  remove-user <name>
  list-users
  add-source <label>                           create an upload key for the companion (shown once)
  remove-source <label>
  list-sources
  backup                                       write a database backup now (newest 7 kept)`;

export function run(argv, store, config, out = console.log) {
  const [command, ...args] = argv;
  switch (command) {
    case 'add-user': {
      const [name, role, given] = args;
      if (!/^[A-Za-z0-9_.-]{2,24}$/.test(name ?? '') || !['admin', 'officer'].includes(role)) { out(USAGE); return 1; }
      const password = given ?? randomBytes(9).toString('base64url');
      if (!strongEnough(password)) { out('Password must be at least 10 characters.'); return 1; }
      store.addUser(name, role, hashPassword(password));
      store.audit('cli', null, 'user.save', `${name} ${role}`);
      out(`Login ${name} (${role}) saved.${given ? '' : ` Password: ${password}`}`);
      return 0;
    }
    case 'remove-user': out(store.removeUser(args[0] ?? '') ? 'Removed.' : 'No such login.'); return 0;
    case 'list-users': for (const u of store.listUsers()) out(`${u.name}\t${u.role}`); return 0;
    case 'add-source': {
      if (!/^[A-Za-z0-9 _.-]{1,40}$/.test(args[0] ?? '')) { out(USAGE); return 1; }
      const key = store.addSource(args[0]);
      store.audit('cli', null, 'source.add', args[0]);
      out(`Source "${args[0]}" created. Put this key in the companion config (it is shown only once):\n${key}`);
      return 0;
    }
    case 'remove-source': out(store.removeSource(args[0] ?? '') ? 'Removed.' : 'No such source.'); return 0;
    case 'list-sources': for (const s of store.listSources()) out(`${s.label}\tlast seen ${s.last_seen ?? 'never'}`); return 0;
    case 'backup': out(`Backup written: ${store.backup(config.backupDir, 7)}`); return 0;
    default: out(USAGE); return command ? 1 : 0;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const config = loadConfig();
  const store = createStore(config.dbPath);
  const code = run(process.argv.slice(2), store, config);
  store.close();
  process.exit(code);
}
