import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp,verifiedMember,sameOriginRequest} from './app.js';
test('unconfigured preview fails closed and does not serve private files',async()=>{
 const server=createApp({}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const root=`http://127.0.0.1:${server.address().port}`;
 try{const status=await fetch(root+'/api/auth/status');assert.deepEqual(await status.json(),{configured:false,authenticated:false,emailVerified:false});assert.equal(status.headers.get('cache-control'),'no-store');
 assert.equal((await fetch(root+'/api/member/profile')).status,401);
 assert.equal((await fetch(root+'/auth/signup')).status,503);
 assert.equal((await fetch(root+'/auth/login')).status,503);
 for(const path of ['/server/.env','/.env','/server/app.js','/.openai/hosting.json'])assert.equal((await fetch(root+path)).status,404);
 const page=await fetch(root+'/');assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
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
 const dataDir=await import('node:fs/promises').then(async fs=>{
  const path=(await import('node:path')).default;
  const os=await import('node:os');
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wb-prizes-'));
  return dir;
 });
 const server=createApp({ADMIN_DATA_DIR:dataDir}).listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 const root=`http://127.0.0.1:${server.address().port}`;
 try{
  const prizes=await fetch(root+'/api/prizes');
  assert.equal(prizes.headers.get('access-control-allow-origin'),'*');
  assert.equal(prizes.headers.get('cache-control'),'public, max-age=60');
  const body=await prizes.json();
  assert.equal(body.length,3);
  assert.equal(body[0].id,'millennium-falcon');
  assert.ok(body[0].questions?.length);
  assert.equal(body[0].questions[0].correct,undefined);
  assert.equal(body[0].updatedBy,undefined);
  const competitions=await (await fetch(root+'/api/competitions')).json();
  assert.equal(competitions[0].questions[0].correct,undefined);
  const wrong=await fetch(root+'/api/prizes/millennium-falcon/check-answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:0,answer:'Submarine'})});
  assert.deepEqual(await wrong.json(),{correct:false});
  const right=await fetch(root+'/api/prizes/millennium-falcon/check-answer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({questionIndex:0,answer:'Spaceship'})});
  assert.deepEqual(await right.json(),{correct:true});
  assert.equal((await fetch(root+'/api/admin/competitions')).status,401);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
