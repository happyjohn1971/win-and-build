import express from 'express';
import {randomUUID} from 'node:crypto';
import {createCompetitionStore,ensureSeeded} from './store.js';

const DISPLAY_KEYS=['sold','set','pieces','tag'];

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
 let image=v.image.trim();
 if(image.startsWith('data:image/')){
  const match=image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)throw Error('Upload a PNG, JPEG or WebP image.');
  const bytes=Buffer.from(match[2],'base64');const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid||bytes.length>3*1024*1024)throw Error('The image format or size is invalid.');
 }else if(/^https:\/\/[^\s]{1,2000}$/i.test(image)){
  try{const url=new URL(image);if(url.protocol!=='https:')throw Error();}catch{throw Error('Image URL must be a valid HTTPS address.');}
 }else throw Error('Upload a PNG, JPEG or WebP image, or use an HTTPS image URL.');
 return {name:v.name.trim(),description:v.description.trim(),theme:v.theme.trim(),price:v.price,max:200,closesAt:new Date(v.closesAt).toISOString(),questions,image,status:v.status};
}

export function adminAccess(env){const allowed=new Set((env.ADMIN_USER_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));return (req,res,next)=>{if(!req.oidc?.isAuthenticated())return res.status(401).json({error:'Sign in as an administrator.'});if(req.oidc.user?.email_verified!==true||!allowed.has(req.oidc.user?.sub))return res.status(403).json({error:'Administrator access is required.'});next();};}

/** Strip secrets from a competition for public consumers (website + iPhone app). */
export function toPublicPrize(record){
 const {updatedBy,questions,image,...rest}=record;
 const publicQuestions=(questions||[]).map(({text,options})=>({text,options:[...options]}));
 const publicImage=typeof image==='string'&&image.startsWith('data:')
  ?`/api/prizes/${record.id}/image`
  :image;
 return {...rest,image:publicImage,questions:publicQuestions};
}

function parseDataImage(image){
 const match=typeof image==='string'&&image.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
 if(!match)return null;
 return {contentType:match[1],buffer:Buffer.from(match[2],'base64')};
}

function corsPublic(res){
 res.set('Access-Control-Allow-Origin','*');
 res.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');
 res.set('Access-Control-Allow-Headers','Content-Type');
}

function cachePublic(res){
 res.set('Cache-Control','public, max-age=60');
}

export function mountAdmin(app,env,base){
 const storePromise=createCompetitionStore(env).then(async store=>{
  await ensureSeeded(store);
  return store;
 });
 const withStore=handler=>async(req,res)=>{
  try{
   const store=await storePromise;
   await handler(store,req,res);
  }catch(error){
   console.error(error);
   if(!res.headersSent)res.status(500).json({error:'Unable to load competitions.'});
  }
 };

 app.get('/api/competitions',withStore(async(store,req,res)=>{
  const records=await store.list();
  res.json(records.filter(x=>x.status==='published').map(toPublicPrize));
 }));

 app.options('/api/prizes',(req,res)=>{corsPublic(res);cachePublic(res);res.sendStatus(204);});
 app.options('/api/prizes/:id/check-answer',(req,res)=>{corsPublic(res);cachePublic(res);res.sendStatus(204);});
 app.options('/api/prizes/:id/image',(req,res)=>{corsPublic(res);cachePublic(res);res.sendStatus(204);});

 app.get('/api/prizes',withStore(async(store,req,res)=>{
  corsPublic(res);
  cachePublic(res);
  const records=await store.list();
  res.json(records.filter(x=>x.status==='published').map(toPublicPrize));
 }));

 app.get('/api/prizes/:id/image',withStore(async(store,req,res)=>{
  corsPublic(res);
  cachePublic(res);
  const records=await store.list();
  const record=records.find(x=>x.id===req.params.id&&x.status==='published');
  if(!record)return res.status(404).json({error:'Prize not found.'});
  const parsed=parseDataImage(record.image);
  if(!parsed)return res.status(404).json({error:'No uploaded image for this prize.'});
  res.type(parsed.contentType).send(parsed.buffer);
 }));

 app.post('/api/prizes/:id/check-answer',express.json({limit:'32kb'}),withStore(async(store,req,res)=>{
  corsPublic(res);
  res.set('Cache-Control','no-store');
  const records=await store.list();
  const record=records.find(x=>x.id===req.params.id&&x.status==='published');
  if(!record)return res.status(404).json({error:'Prize not found.'});
  const questionIndex=req.body?.questionIndex;
  const answer=req.body?.answer;
  if(!Number.isInteger(questionIndex)||questionIndex<0||questionIndex>=record.questions.length){
   return res.status(400).json({error:'Unknown question.'});
  }
  if(typeof answer!=='string'||!answer.trim())return res.status(400).json({error:'Choose an answer.'});
  const question=record.questions[questionIndex];
  const correct=question.options[question.correct]===answer.trim();
  res.json({correct});
 }));

 const router=express.Router();
 router.use(adminAccess(env));
 router.use((req,res,next)=>{if(req.method!=='GET'&&req.get('origin')!==base.origin)return res.status(403).json({error:'Invalid request origin.'});next();});
 router.use(express.json({limit:'5mb'}));
 router.get('/competitions',withStore(async(store,req,res)=>{
  res.json(await store.list());
 }));
 router.post('/competitions',withStore(async(store,req,res)=>{
  try{
   const records=await store.list();
   if(records.length>=100)return res.status(409).json({error:'Competition storage limit reached.'});
   const value=validateCompetition(req.body);
   const record={...value,id:randomUUID(),revision:1,updatedAt:new Date().toISOString(),updatedBy:req.oidc.user.sub};
   records.push(record);
   await store.save(records);
   res.status(201).json(record);
  }catch(e){res.status(400).json({error:e.message});}
 }));
 router.put('/competitions/:id',withStore(async(store,req,res)=>{
  try{
   const records=await store.list();
   const i=records.findIndex(x=>x.id===req.params.id);
   if(i<0)return res.status(404).json({error:'Competition not found.'});
   if(req.body.revision!==records[i].revision)return res.status(409).json({error:'This competition has changed. Reload it before saving.'});
   const value=validateCompetition(req.body);
   const previous=records[i];
   const record={...value,id:previous.id,revision:previous.revision+1,updatedAt:new Date().toISOString(),updatedBy:req.oidc.user.sub};
   for(const key of DISPLAY_KEYS){if(previous[key]!==undefined&&record[key]===undefined)record[key]=previous[key];}
   records[i]=record;
   await store.save(records);
   res.json(record);
  }catch(e){res.status(400).json({error:e.message});}
 }));
 app.use('/api/admin',router);
}
