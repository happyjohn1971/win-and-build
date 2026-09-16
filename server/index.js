import {createApp} from './app.js';
const port=Number(process.env.PORT||4174);
const host=process.env.HOST||(process.env.NODE_ENV==='production'?'0.0.0.0':'127.0.0.1');
const server=createApp().listen(port,host,()=>console.log(`Win & Build: http://localhost:${port}`));
server.on('error',error=>{
 console.error(error);
 process.exitCode=1;
});
