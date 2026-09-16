import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function validateCompetition(v){
 const text=(x,max)=>typeof x==='string'&&x.trim().length>0&&x.length<=max;
 if(!text(v.name,120)||!text(v.description,5000)||!text(v.theme,80))throw Error('Enter a name, theme and description.');
 if(!Number.isInteger(v.price)||v.price<1||v.price>100000)throw Error('Ticket price must be between £0.01 and £1,000.');
 if(v.max!==200)throw Error('Each competition must have 200 tickets.');
 if(!['draft','published'].includes(v.status))throw Error('Invalid status.');
 if(!Number.isFinite(Date.parse(v.closesAt)))throw Error('Choose a closing date and time.');
 if(v.status==='published'&&Date.parse(v.closesAt)<=Date.now())throw Error('Closing time must be in the future.');
 if(!Array.isArray(v.questions)||v.questions.length<1||v.questions.length>10)throw Error('Add 1–10 questions.');
 const questions=v.questions.map(q=>{if(!text(q.text,240)||!Array.isArray(q.options)||q.options.length!==3||q.options.some(o=>!text(o,120))||new Set(q.options.map(o=>o.trim().toLowerCase())).size!==3||!Number.isInteger(q.correct)||q.correct<0||q.correct>2)throw Error('Each question needs three different choices and a correct answer.');return {text:q.text.trim(),options:q.options.map(o=>o.trim()),correct:q.correct};});
 if(typeof v.image!=='string'||v.image.length>4200000)throw Error('Choose an image under 3 MB.');
 const match=v.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw Error('Upload a PNG, JPEG or WebP image.');
 const bytes=Buffer.from(match[2],'base64');const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid||bytes.length>3*1024*1024)throw Error('The image format or size is invalid.');
 return {name:v.name.trim(),description:v.description.trim(),theme:v.theme.trim(),price:v.price,max:200,closesAt:new Date(v.closesAt).toISOString(),questions,image:v.image,status:v.status};
}
export function adminAccess(env){const allowed=new Set((env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));return (req,res,next)=>{if(!req.oidc?.isAuthenticated())return res.status(401).json({error:'Sign in as an administrator.'});if(req.oidc.user?.email_verified!==true||!allowed.has(req.oidc.user?.sub))return res.status(403).json({error:'Administrator access is required.'});next();};}
export function mountAdmin(app,env,base){
 const directory=env.ADMIN_DATA_DIR||new URL('./data/',import.meta.url).pathname;const file=path.join(directory,'competitions.json');
 function read(){if(!fs.existsSync(file))return [];const records=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(records))throw Error('Invalid competition store');return records;}
 function write(records){fs.mkdirSync(directory,{recursive:true,mode:0o700});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(records),{mode:0o600});fs.renameSync(temp,file);}
 app.get('/api/competitions',(req,res)=>res.json(read().filter(x=>x.status==='published').map(({updatedBy,...record})=>record)));
 const router=express.Router();router.use(adminAccess(env));router.use((req,res,next)=>{if(req.method!=='GET'&&req.get('origin')!==base.origin)return res.status(403).json({error:'Invalid request origin.'});next();});router.use(express.json({limit:'5mb'}));
 router.get('/competitions',(req,res)=>res.json(read()));
 router.post('/competitions',(req,res)=>{try{const records=read();if(records.length>=100)return res.status(409).json({error:'Competition storage limit reached.'});const value=validateCompetition(req.body);const record={...value,id:randomUUID(),revision:1,updatedAt:new Date().toISOString(),updatedBy:req.oidc.user.sub};records.push(record);write(records);res.status(201).json(record);}catch(e){res.status(400).json({error:e.message});}});
 router.put('/competitions/:id',(req,res)=>{try{const records=read(),i=records.findIndex(x=>x.id===req.params.id);if(i<0)return res.status(404).json({error:'Competition not found.'});if(req.body.revision!==records[i].revision)return res.status(409).json({error:'This competition has changed. Reload it before saving.'});const value=validateCompetition(req.body);records[i]={...value,id:records[i].id,revision:records[i].revision+1,updatedAt:new Date().toISOString(),updatedBy:req.oidc.user.sub};write(records);res.json(records[i]);}catch(e){res.status(400).json({error:e.message});}});
 app.use('/api/admin',router);
}
