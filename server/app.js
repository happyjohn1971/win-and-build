import express from 'express';
import {mountAdmin} from './admin.js';
import { auth } from 'express-openid-connect';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
const publicDirectory=fileURLToPath(new URL('../dist/',import.meta.url));
export function verifiedMember(req,res,next){
 if(!req.oidc?.isAuthenticated())return res.status(401).json({error:'sign_in_required'});
 if(req.oidc.user?.email_verified!==true)return res.status(403).json({error:'email_verification_required'});
 next();
}
export function sameOriginRequest(req,base){
 const origin=req.get('origin');
 if(origin)return origin===base.origin;
 const referer=req.get('referer');
 if(referer){try{return new URL(referer).origin===base.origin;}catch{return false;}}
 return req.get('sec-fetch-site')==='same-origin'&&req.get('host')===base.host;
}
export function createApp(env=process.env){
 const app=express();const production=env.NODE_ENV==='production';
 const keys=['AUTH0_ISSUER_BASE_URL','AUTH0_CLIENT_ID','AUTH0_CLIENT_SECRET','SESSION_SECRET','BASE_URL'];
 const configured=keys.every(key=>Boolean(env[key]));
 if(production&&!configured)throw new Error('Member authentication configuration is incomplete.');
 const base=new URL(env.BASE_URL||'http://localhost:4174');
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('BASE_URL must be an origin.');
 if(base.protocol!=='https:'&&(production||!['localhost','127.0.0.1'].includes(base.hostname)))throw new Error('HTTPS is required outside local development.');
 if(configured){if(env.SESSION_SECRET.length<64)throw new Error('Use a cryptographically random session secret of at least 64 characters.');const issuer=new URL(env.AUTH0_ISSUER_BASE_URL);if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.pathname!=='/'||issuer.search||issuer.hash)throw new Error('Authentication issuer must be an HTTPS origin.');}
 app.disable('x-powered-by');
 if(env.TRUST_PROXY_HOPS){const hops=Number(env.TRUST_PROXY_HOPS);if(!Number.isInteger(hops)||hops<1||hops>3)throw new Error('Invalid proxy configuration.');app.set('trust proxy',hops);}
 app.use(helmet({strictTransportSecurity:production?undefined:false,contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'",'https://fonts.googleapis.com'],fontSrc:["'self'",'https://fonts.gstatic.com'],imgSrc:["'self'",'data:','https://www.lego.com'],connectSrc:["'self'"],formAction:["'self'"],frameAncestors:["'none'"],objectSrc:["'none'"],baseUri:["'none'"],upgradeInsecureRequests:production?[]:null}},referrerPolicy:{policy:'no-referrer'}}));
 app.use(['/auth','/api'],(req,res,next)=>{res.set('Cache-Control','no-store');next();});
 app.use('/auth',rateLimit({windowMs:15*60*1000,limit:40,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'too_many_attempts'}}));
 if(configured)app.use(auth({authRequired:false,auth0Logout:true,baseURL:base.origin,issuerBaseURL:env.AUTH0_ISSUER_BASE_URL,clientID:env.AUTH0_CLIENT_ID,clientSecret:env.AUTH0_CLIENT_SECRET,secret:env.SESSION_SECRET,authorizationParams:{response_type:'code',response_mode:'query',scope:'openid profile email'},routes:{login:false,logout:false,callback:'/auth/callback'},session:{name:production?'__Host-btw-session':'btw-session',rolling:true,rollingDuration:1800,absoluteDuration:28800,cookie:{httpOnly:true,secure:production||base.protocol==='https:',sameSite:'Lax',path:'/'}}}));
 app.get('/api/auth/status',(req,res)=>res.json({configured,authenticated:!!req.oidc?.isAuthenticated(),emailVerified:req.oidc?.user?.email_verified===true}));
 app.use('/auth',(req,res,next)=>{if(!configured)return res.status(503).send('Member registration is not available yet. Please return to the website.');next();});
 app.get('/auth/login',(req,res)=>res.oidc.login({returnTo:'/#/members'}));
 app.get('/auth/signup',(req,res)=>res.oidc.login({returnTo:'/#/members',authorizationParams:{screen_hint:'signup'}}));
 const logoutGuard=(req,res,next)=>{if(!sameOriginRequest(req,base))return res.status(403).json({error:'invalid_request_origin'});next();};
 const logout=(req,res)=>res.oidc.logout({returnTo:base.origin+'/#/members'});
 app.get('/auth/logout',logoutGuard,logout);
 app.post('/auth/logout',logoutGuard,logout);
 app.get('/api/member/profile',verifiedMember,(req,res)=>{const user=req.oidc.user;res.json({name:user.name||'Member',email:user.email||''});});
 mountAdmin(app,env,base);
 app.use('/api',(req,res)=>res.status(404).json({error:'not_found'}));
 app.use(express.static(publicDirectory,{dotfiles:'deny',index:'index.html'}));
 app.use((err,req,res,next)=>{res.status(500).set('Cache-Control','no-store').type('html').send('<!doctype html><html lang="en"><meta charset="utf-8"><title>Sign-in unavailable</title><h1>We could not complete sign-in.</h1><p>Please try again. If you just verified your email, sign in again.</p><a href="/#/members">Return to members</a></html>');});
 return app;
}
