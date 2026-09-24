import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createApp,verifiedMember,sameOriginRequest} from './app.js';
import {createCompetitionStore,ensureSeeded,isUntouchedOldSeed} from './store.js';
import {SAMPLE_COMPETITIONS,OLD_SEED_IDS} from './seed-data.js';

const OLD_SEED = [
  {id:'millennium-falcon',name:'Millennium Falcon™',theme:'Star Wars™',set:'75192',pieces:'7,541',price:200,sold:125,max:200,tag:'THE BIG BUILD',image:'https://www.lego.com/cdn/cs/set/assets/blt3349f56c6f192e18/75192_Prod.png',description:'Old falcon',closesAt:'2026-09-30T19:00:00.000Z',status:'published',revision:1,updatedAt:'2026-09-24T00:00:00.000Z',questions:[{text:'What type of vehicle is the Millennium Falcon?',options:['Spaceship','Submarine','Motorbike'],correct:0}]},
  {id:'ferrari-daytona',name:'Ferrari Daytona SP3',theme:'Technic™',set:'42143',pieces:'3,778',price:200,sold:103,max:200,tag:'FOR THE DREAM GARAGE',image:'https://www.lego.com/cdn/cs/set/assets/bltb862bc546852bd71/42143.png',description:'Old ferrari',closesAt:'2026-09-30T19:00:00.000Z',status:'published',revision:1,updatedAt:'2026-09-24T00:00:00.000Z',questions:[{text:'Which country is Ferrari originally from?',options:['Italy','Canada','Japan'],correct:0}]},
  {id:'rivendell',name:'Rivendell™',theme:'The Lord of the Rings™',set:'10316',pieces:'6,167',price:200,sold:48,max:200,tag:'ESCAPE TO MIDDLE-EARTH',image:'https://www.lego.com/cdn/cs/set/assets/bltec012c948c003fba/10316_alt16.png',description:'Old rivendell',closesAt:'2026-09-30T19:00:00.000Z',status:'published',revision:1,updatedAt:'2026-09-24T00:00:00.000Z',questions:[{text:'In which fictional world is Rivendell located?',options:['Middle-earth','Narnia','Wonderland'],correct:0}]}
];

async function tempDataDir(){
  return fs.mkdtemp(path.join(os.tmpdir(),'wb-prizes-'));
}

test('unconfigured preview fails closed and does not serve private files',async()=>{
 const server=createApp({}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const root=`http://127.0.0.1:${server.address().port}`;
 try{const status=await fetch(root+'/api/auth/status');assert.deepEqual(await status.json(),{configured:false,authenticated:false,emailVerified:false});assert.equal(status.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(root+'/api/member/profile')).status,401);
 assert.equal((await fetch(root+'/auth/signup')).status,503);
 assert.equal((await fetch(root+'/auth/login')).status,503);
 for(const path of ['/server/.env','/.env','/server/app.js','/.openai/hosting.json'])assert.equal((await fetch(root+path)).status,404);
 const page=await fetch(root+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.match(page.headers.get('content-security-policy'),/images\.brickset\.com/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
test('member access requires both a session and verified email',()=>{
 for(const [authenticated,verified,expected] of [[false,false,401],[true,false,403],[true,true,200]]){let status=200,passed=false;const res={status(value){status=value;return this},json(){return this}};verifiedMember({oidc:{isAuthenticated:()=>authenticated,user:{email_verified:verified}}},res,()=>passed=true);assert.equal(status,expected);assert.equal(passed,expected===200);}
});
test('logout accepts a matching origin or same-site referrer only',()=>{
 const base=new URL('https://winandbuild.co.uk');
 const request=headers=>({get:name=>headers[name.toLowerCase()]});
 assert.equal(sameOriginRequest(request({origin:base.origin}),base),true);
 assert.equal(sameOriginRequest(request({referer:base.origin+'/#/members'}),base),true);
 assert.equal(sameOriginRequest(request({'sec-fetch-site':'same-origin',host:base.host}),base),true);
 assert.equal(sameOriginRequest(request({'sec-fetch-site':'cross-site',host:base.host}),base),false);
 assert.equal(sameOriginRequest(request({'sec-fetch-site':'same-origin',host:'example.com'}),base),false);
 assert.equal(sameOriginRequest(request({origin:'https://example.com'}),base),false);
 assert.equal(sameOriginRequest(request({referer:'https://example.com/'}),base),false);
 assert.equal(sameOriginRequest(request({}),base),false);
});
test('production refuses absent credentials and insecure origins',()=>{assert.throws(()=>createApp({NODE_ENV:'production'}),/incomplete/);assert.throws(()=>createApp({BASE_URL:'http://example.com'}),/HTTPS/);assert.throws(()=>createApp({BASE_URL:'https://example.com/path'}),/origin/);});
test('official SDK accepts session and authorization code configuration',()=>{assert.doesNotThrow(()=>createApp({BASE_URL:'https://example.com',NODE_ENV:'production',AUTH0_ISSUER_BASE_URL:'https://example.eu.auth0.com',AUTH0_CLIENT_ID:'test-client',AUTH0_CLIENT_SECRET:'test-only-client-secret',SESSION_SECRET:'a'.repeat(64)}));});
test('prize feed seeds samples, hides answers, and checks them on the server',async()=>{
 const dataDir=await tempDataDir();
 const server=createApp({ADMIN_DATA_DIR:dataDir}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const root=`http://127.0.0.1:${server.address().port}`;
 try{
  const prizes=await fetch(root+'/api/prizes');
  assert.equal(prizes.headers.get('access-control-allow-origin'),'*');
  assert.equal(prizes.headers.get('cache-control'),'public, max-age=60');
  const body=await prizes.json();
  assert.equal(body.length,3);
  assert.deepEqual(body.map(p=>p.id),['imperial-star-destroyer','mario-standard-kart','the-starry-night']);
  assert.equal(body[0].name,'Imperial Star Destroyer™');
  assert.ok(body[0].questions?.length);
  assert.equal(body[0].questions[0].correct,undefined);
  assert.equal(body[0].updatedBy,undefined);
  const competitions=await (await fetch(root+'/api/competitions')).json();
  assert.equal(competitions[0].questions[0].correct,undefined);
  const wrong=await fetch(root+'/api/prizes/imperial-star-destroyer/check-answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:0,answer:'Toy Story'})});
  assert.deepEqual(await wrong.json(),{correct:false});
  const right=await fetch(root+'/api/prizes/imperial-star-destroyer/check-answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:0,answer:'Star Wars'})});
  assert.deepEqual(await right.json(),{correct:true});
  const mario=await fetch(root+'/api/prizes/mario-standard-kart/check-answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:0,answer:'Red'})});
  assert.deepEqual(await mario.json(),{correct:true});
  assert.equal((await fetch(root+'/api/admin/competitions')).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('isUntouchedOldSeed recognises only the original three at revision 1',()=>{
 assert.equal(isUntouchedOldSeed(OLD_SEED),true);
 assert.equal(isUntouchedOldSeed([]),false);
 assert.equal(isUntouchedOldSeed(SAMPLE_COMPETITIONS),false);
 assert.equal(isUntouchedOldSeed(OLD_SEED.map((r,i)=>i===0?{...r,revision:2}:r)),false);
 assert.equal(isUntouchedOldSeed(OLD_SEED.slice(0,2)),false);
 assert.equal(isUntouchedOldSeed([...OLD_SEED,{...OLD_SEED[0],id:'extra'}]),false);
 assert.deepEqual(OLD_SEED_IDS,['millennium-falcon','ferrari-daytona','rivendell']);
});

test('ensureSeeded replaces untouched old starter prizes once, then leaves admin data alone',async()=>{
 const dataDir=await tempDataDir();
 const store=await createCompetitionStore({ADMIN_DATA_DIR:dataDir});
 await store.save(OLD_SEED.map(r=>({...r,questions:r.questions.map(q=>({...q,options:[...q.options]}))})));
 const migrated=await ensureSeeded(store);
 assert.deepEqual(migrated.map(r=>r.id),SAMPLE_COMPETITIONS.map(r=>r.id));
 assert.equal(migrated[0].name,'Imperial Star Destroyer™');
 assert.equal(migrated[0].sold,125);
 assert.equal(migrated[1].sold,103);
 assert.equal(migrated[2].sold,48);
 const again=await ensureSeeded(store);
 assert.deepEqual(again.map(r=>r.id),SAMPLE_COMPETITIONS.map(r=>r.id));

 const editedDir=await tempDataDir();
 const editedStore=await createCompetitionStore({ADMIN_DATA_DIR:editedDir});
 const editedOld=OLD_SEED.map((r,i)=>({...r,revision:i===0?2:1,questions:r.questions.map(q=>({...q,options:[...q.options]}))}));
 await editedStore.save(editedOld);
 const leftAlone=await ensureSeeded(editedStore);
 assert.deepEqual(leftAlone.map(r=>r.id),OLD_SEED_IDS);
 assert.equal(leftAlone[0].revision,2);
});
