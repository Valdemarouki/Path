// Private stdin/stdout fixture for browser-parity.py. Every run starts with an empty in-memory database.
import { CanvasCursorRoom } from '../cursor-room.mjs';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const db = new PGlite();
const users = ['Owner', 'Editor', 'Viewer'].map((role, index) => ({
  id:'00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  name:'QA ' + role, email:role.toLowerCase() + '@example.test'
}));
await db.exec(`
  create role anon;
  create role authenticated;
  create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as
  $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
`);
for (const filename of ['schema.sql','cursor-access.sql','free-sharing.sql','workspace-parity.sql']) {
  await db.exec(readFileSync(new URL('../' + filename, import.meta.url), 'utf8'));
}
for (const user of users) {
  await db.query('insert into auth.users values ($1,$2,now(),$3)', [
    user.id,user.email,JSON.stringify({display_name:user.name})
  ]);
}
process.stdout.write(JSON.stringify({users}) + '\n');
for await (const line of createInterface({input:process.stdin})) {
  try {
    const {actor,action,args={}} = JSON.parse(line);
    if (!users[actor]) throw Error('Unknown test actor');
    const reply = await db.transaction(async tx => {
      if (action === 'qa-cursor-frame') {
        // Replace the Durable Object's WebSocketPair transport with in-memory queues.
        // Admission, names, rate limits, message validation and broadcast use Path's executable code.
        await tx.exec('set local role anon');
        const room = new CanvasCursorRoom({}, {}), output = {};
        for (const [client, ticket] of Object.entries(args.tickets)) {
          const {lease} = (await tx.query('select public.path_canvas_claim($1,$2) as data',[args.id,ticket])).rows[0].data;
          const [member] = (await tx.query('select public.path_canvas_check($1,$2) as data',[args.id,[lease]])).rows[0].data;
          if (!member || member.account !== users[client].id) throw Error('Cursor admission rejected');
          output[client] = [];
          room.peers.set(client, { id:client, account:member.account, name:room.name(member), checked:Date.now(),
            last:0, pos:null, socket:{ send:frame => output[client].push(JSON.parse(frame)) } });
        }
        room.receive(room.peers.get(String(actor)), args.frame);
        return output;
      }
      await tx.exec('set local role authenticated');
      await tx.query("select set_config('request.jwt.claim.sub',$1,true)", [users[actor].id]);
      if (action === 'cursor-ticket') return (await tx.query('select public.path_canvas_ticket($1) as result',[args.id])).rows[0].result;
      return (await tx.query('select public.path_share_v2($1,$2::jsonb) as result',[action, JSON.stringify(args)])).rows[0].result;
    });
    process.stdout.write(JSON.stringify({data:reply}) + '\n');
  } catch(error) { process.stdout.write(JSON.stringify({error:error.message}) + '\n'); }
}
await db.close();
