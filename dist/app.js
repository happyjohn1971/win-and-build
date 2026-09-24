let prizes=[];
let prizesLoadError=null;
let prizesLoaded=false;
let activeQuestion=null;
const previousQuestions={};
let basket=[];
let filter='All prizes';
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
const app=document.querySelector('#app');

function img(p){
  const src=p.image||'';
  if(/^https:\/\/([^/]+\.)?lego\.com\//i.test(src))return src+(src.includes('?')?'&':'?')+'format=png&width=1000';
  return src;
}

function drawLabel(p){
  if(!p.closesAt)return 'Draw date to be confirmed';
  const d=new Date(p.closesAt);
  if(Number.isNaN(d.getTime()))return 'Draw date to be confirmed';
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

function formatClosesNotice(p){
  if(!p.closesAt)return 'Closing time to be confirmed.';
  const d=new Date(p.closesAt);
  if(Number.isNaN(d.getTime()))return 'Closing time to be confirmed.';
  return d.toLocaleString('en-GB',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Europe/London',timeZoneName:'short'});
}

function soldOf(p){return Number.isFinite(p.sold)?p.sold:0;}
function tagOf(p){return p.tag||'PRIZE';}

function chooseQuestion(prize){
  const pool=prize.questions||[];
  if(!pool.length)return null;
  const previous=previousQuestions[prize.id];
  const choices=pool.map((q,index)=>({...q,index})).filter(q=>q.index!==previous);
  const pick=(choices.length?choices:pool.map((q,index)=>({...q,index})))[Math.floor(Math.random()*(choices.length||pool.length))];
  previousQuestions[prize.id]=pick.index;
  const options=[...pick.options];
  for(let i=options.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[options[i],options[j]]=[options[j],options[i]];}
  return {text:pick.text,options,index:pick.index};
}

async function checkAnswerOnServer(prizeId,questionIndex,answer){
  const response=await fetch(`/api/prizes/${encodeURIComponent(prizeId)}/check-answer`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({questionIndex,answer})
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Unable to check that answer.');
  return !!data.correct;
}

async function validEntryAnswer(entry){
  try{return await checkAnswerOnServer(entry.id,entry.questionIndex,entry.answer);}
  catch{return false;}
}

function card(p){
  const sold=soldOf(p);
  return `<article class="card"><a class="card-image" href="#/competition/${p.id}" aria-label="View ${p.name}"><span class="badge">${tagOf(p)}</span><img src="${img(p)}" alt="LEGO ${p.name} building set"></a><div class="card-body"><div class="category">LEGO ${p.theme}</div><h3><a href="#/competition/${p.id}">${p.name}</a></h3><div class="meta"><span>Draw · ${drawLabel(p)}</span><span>${Math.round(sold/p.max*100)}% allocated</span></div><div class="progress"><span style="width:${sold/p.max*100}%"></span></div><div class="meta"><span>${sold} / ${p.max} entries</span><span>1 prize</span></div><div class="card-bottom"><div class="price">${money(p.price)}<small>per entry</small></div><a class="btn" href="#/competition/${p.id}">View competition <span>↗</span></a></div></div></article>`;
}

function catalogue(){
  if(!prizes.length)return `<section id="competitions"><div class="section-head"><div><span class="eyebrow">MAKE ROOM ON YOUR SHELF</span><h2>Find your next great build.</h2><p>No published competitions are available right now.</p></div></div></section>`;
  return `<section id="competitions"><div class="section-head"><div><span class="eyebrow">MAKE ROOM ON YOUR SHELF</span><h2>Find your next great build.</h2><p>Explore our competition line-up.</p></div><div class="filters" aria-label="Competition view"><button class="chip active" aria-pressed="true">All prizes</button></div></div><div class="grid">${prizes.map(card).join('')}</div></section>`;
}

function how(){return `<section class="how"><span class="eyebrow">A FEW STEPS TO A BIG BUILD</span><h2>From wish list to what if.</h2><div class="steps"><div><span class="step-number">01 /</span><h3>Find your favourite</h3><p>Explore the sets and review the prize, entry price and competition details.</p></div><div><span class="step-number">02 /</span><h3>Choose your entries</h3><p>Answer the competition question and choose how many entries to add to your basket.</p></div><div><span class="step-number">03 /</span><h3>Look forward to draw day</h3><p>Live competitions will show their closing time and draw information before entries open.</p></div></div><div class="delivery-note"><span class="step-number">04 /</span><div><h3>We’ll post the prize</h3><p>When a winner is confirmed, the prize will be posted to their UK delivery address. Delivery timings and requirements are set out in the <a href="#/terms">Terms &amp; Conditions</a>.</p></div></div></section>`;}

function loadingPage(message){app.innerHTML=`<div class="wrap page"><div class="notice" role="status">${message}</div></div>`;}
function errorPage(){app.innerHTML=`<div class="wrap page"><h1>Prizes unavailable.</h1><p>We could not load the competition line-up. Please refresh the page to try again.</p><button class="btn" type="button" id="retry-prizes">Try again</button></div>`;document.querySelector('#retry-prizes').onclick=()=>loadPrizes(true);}

function home(){
  if(!prizes.length){app.innerHTML=`<div class="wrap"><section class="hero"><div class="hero-copy"><div class="eyebrow">FOR THE LOVE OF THE BUILD</div><h1>Small entry.<br><em>Epic possibility.</em></h1><p>Your dream set could be your next build. Discover competitions made for building fans.</p><a class="btn" href="#/competitions">Explore competitions <span>→</span></a></div></section><div class="trust-strip"><span><b>✓</b> Clear entry limits</span><span><b>◇</b> Sets worth making space for</span><span><b>18+</b> UK residents</span></div>${catalogue()}${how()}</div>`;return;}
  const featured=prizes[0];
  app.innerHTML=`<div class="wrap"><section class="hero"><div class="hero-copy"><div class="eyebrow">FOR THE LOVE OF THE BUILD</div><h1>Small entry.<br><em>Epic possibility.</em></h1><p>Your dream set could be your next build. Discover competitions made for building fans.</p><a class="btn" href="#/competitions">Explore competitions <span>→</span></a></div><div class="hero-art"><span class="hero-tag">FEATURED PRIZE</span><img src="${img(featured)}" alt="LEGO ${featured.name}"><div class="feature-label">LEGO ${featured.theme}<strong>${featured.name} · ${money(featured.price)} per entry</strong></div></div></section><div class="trust-strip"><span><b>✓</b> Clear entry limits</span><span><b>◇</b> Sets worth making space for</span><span><b>18+</b> UK residents</span></div>${catalogue()}${how()}</div>`;
}

function setFilter(f){filter=f;const el=document.querySelector('#competitions');if(el)el.outerHTML=catalogue();}

function detail(p){
  const question=chooseQuestion(p);
  activeQuestion=question?{prizeId:p.id,...question,verified:false}:null;
  const sold=soldOf(p);
  const setLine=[p.set?`Set ${p.set}`:'',p.pieces?`${p.pieces} pieces`:''].filter(Boolean).join(' · ');
  app.innerHTML=`<div class="wrap page"><div class="breadcrumb"><a href="#/competitions">Competitions</a> / ${p.name}</div><div class="detail"><div><div class="detail-photo"><img src="${img(p)}" alt="LEGO ${p.name}"></div><h2 style="font-size:32px;margin-top:30px">A build to get lost in.</h2><p>${p.description}</p>${setLine?`<p>${setLine}<br>Prize illustration from LEGO.</p>`:'<p>Prize illustration from LEGO.</p>'}</div><div><span class="eyebrow">LEGO ${p.theme}</span><h1>${p.name}</h1><div class="price">${money(p.price)} <small>per entry · maximum 50 per person</small></div><div class="notice">Closing time: ${formatClosesNotice(p)}</div><div class="meta"><span>${sold} of ${p.max} entries allocated</span><span>1 prize</span></div><div class="progress"><span style="width:${sold/p.max*100}%"></span></div><form class="entry-box" id="entry-form">${question?`<fieldset class="question-options"><legend>First, answer the competition question</legend><p>${question.text}</p>${question.options.map(answer=>`<label class="answer-option"><input type="radio" name="answer" value="${answer}" required><span>${answer}</span></label>`).join('')}</fieldset><p id="answer-feedback" role="status" aria-live="polite">Choose the correct answer to unlock your tickets.</p>`:'<p class="error">No competition questions are configured for this prize.</p>'}<fieldset id="ticket-controls" disabled><label for="qty">Number of entries</label><div class="quantity"><button type="button" onclick="adjust(-1)" aria-label="Decrease entries">−</button><input id="qty" type="number" min="1" max="50" value="1" required oninput="updateTotal('${p.id}')"><button type="button" onclick="adjust(1)" aria-label="Increase entries">+</button></div><div class="total"><span>Entry total</span><span id="entry-total">${money(p.price)}</span></div><p id="entry-error" class="error" role="alert"></p><button class="btn full" type="submit">Continue to payment / log in <span>→</span></button></fieldset><p style="font-size:12px;margin-bottom:0">18+ · UK residents · <a href="#/terms" style="text-decoration:underline">Terms &amp; Conditions</a></p></form></div></div></div>`;
  if(question){
    document.querySelectorAll('input[name=answer]').forEach(input=>{
      input.addEventListener('change',()=>checkAnswer());
    });
  }
  document.querySelector('#entry-form').onsubmit=async e=>{
    e.preventDefault();
    const qty=Number(document.querySelector('#qty').value);
    const answer=document.querySelector('input[name=answer]:checked')?.value;
    const old=basket.find(x=>x.id===p.id);
    const errorEl=document.querySelector('#entry-error');
    if(!activeQuestion||!answer){errorEl.textContent='Answer the question correctly before adding tickets.';return;}
    let ok=activeQuestion.verified&&activeQuestion.answer===answer;
    if(!ok){
      try{ok=await checkAnswerOnServer(p.id,activeQuestion.index,answer);activeQuestion.verified=ok;activeQuestion.answer=answer;}
      catch{errorEl.textContent='Unable to check your answer. Please try again.';return;}
    }
    if(!ok){errorEl.textContent='Answer the question correctly before adding tickets.';return;}
    if(!Number.isInteger(qty)||qty<1||qty+(old?.qty||0)>50){errorEl.textContent='Select an answer and keep your total to 1–50 entries for this competition.';return;}
    if(old){old.qty+=qty;old.answer=answer;old.questionIndex=activeQuestion.index;}
    else basket.push({id:p.id,qty,answer,questionIndex:activeQuestion.index});
    count();location.hash='/checkout';
  };
}

async function checkAnswer(){
  const answer=document.querySelector('input[name=answer]:checked')?.value;
  const controls=document.querySelector('#ticket-controls');
  const feedback=document.querySelector('#answer-feedback');
  const errorEl=document.querySelector('#entry-error');
  if(errorEl)errorEl.textContent='';
  if(!activeQuestion||!answer){controls.disabled=true;return;}
  feedback.textContent='Checking your answer…';
  feedback.className='';
  controls.disabled=true;
  try{
    const correct=await checkAnswerOnServer(activeQuestion.prizeId,activeQuestion.index,answer);
    activeQuestion.verified=correct;
    activeQuestion.answer=answer;
    controls.disabled=!correct;
    feedback.textContent=correct?'Correct! You can now choose your tickets.':'That’s not correct. Please try another answer.';
    feedback.className=correct?'answer-success':'error';
  }catch{
    activeQuestion.verified=false;
    feedback.textContent='Unable to check your answer. Please try again.';
    feedback.className='error';
  }
}

function adjust(n){const el=document.querySelector('#qty');el.value=Math.min(50,Math.max(1,(Number(el.value)||1)+n));el.dispatchEvent(new Event('input'));}
function updateTotal(id){document.querySelector('#entry-total').textContent=money(prizes.find(p=>p.id===id).price*(Number(document.querySelector('#qty').value)||0));}
function count(){const el=document.querySelector('#basket-count');if(el)el.textContent=basket.reduce((n,x)=>n+x.qty,0);}
function total(){return basket.reduce((n,x)=>n+prizes.find(p=>p.id===x.id).price*x.qty,0);}

function basketPage(){app.innerHTML=`<div class="wrap page"><div class="breadcrumb"><a href="#/competitions">← Continue browsing</a></div><h1>Your basket.</h1>${basket.length?`<div class="basket-layout"><div>${basket.map(x=>{const p=prizes.find(p=>p.id===x.id);if(!p)return '';return `<div class="basket-row"><img src="${img(p)}" alt="${p.name}"><div style="flex:1"><h3><a href="#/competition/${p.id}">${p.name}</a></h3><div style="font-size:14px">${x.qty} ${x.qty===1?'entry':'entries'} × ${money(p.price)} · ${money(x.qty*p.price)}</div><div class="quantity"><button aria-label="Remove one entry for ${p.name}" onclick="changeQty('${p.id}',-1)">−</button><span style="padding:0 15px">${x.qty}</span><button aria-label="Add one entry for ${p.name}" onclick="changeQty('${p.id}',1)" ${x.qty===50?'disabled':''}>+</button></div><button class="remove" onclick="removeItem('${p.id}')">Remove</button></div></div>`;}).join('')}<p style="font-size:14px">This preview basket lasts for this page session. Entries are not reserved.</p></div><aside class="summary"><h3>Order summary</h3><div class="total"><span>${basket.reduce((n,x)=>n+x.qty,0)} entries</span><span>${money(total())}</span></div><div class="total"><span>Total</span><span>${money(total())}</span></div><a class="btn full" href="#/checkout">Continue to checkout →</a><p style="font-size:12px">Preview only. No payment will be taken.</p></aside></div>`:`<div class="empty"><span class="eyebrow">YOUR NEXT BUILD IS WAITING</span><h2>A little room for possibility.</h2><p>Your basket is empty. Find a set you would love to build.</p><a class="btn" href="#/competitions">Explore competitions →</a></div>`}</div>`;}

function removeItem(id){basket=basket.filter(x=>x.id!==id);count();basketPage();}
function changeQty(id,n){const x=basket.find(x=>x.id===id);x.qty+=n;if(x.qty<1)basket=basket.filter(x=>x.id!==id);count();basketPage();}

async function checkout(){
  if(!basket.length){basketPage();return;}
  loadingPage('Checking your answers…');
  const checks=await Promise.all(basket.map(x=>validEntryAnswer(x)));
  if(checks.some(ok=>!ok)){app.innerHTML='<div class="wrap page"><h1>Answer the question first.</h1><p>Each competition needs a correct answer before checkout.</p><a class="btn" href="#/competitions">Return to competitions</a></div>';return;}
  let authConfigured=false;
  try{
    const statusResponse=await fetch('/api/auth/status',{credentials:'same-origin',cache:'no-store'});
    if(statusResponse.ok){const status=await statusResponse.json();authConfigured=status.configured===true;}
  }catch{}
  const authBlock=authConfigured
    ?`<div class="checkout-auth"><a class="btn" href="/auth/signup">Create account</a><a class="btn outline" href="/auth/login">Sign in</a><span>Auth0 is connected for secure member login.</span></div>`
    :`<div class="checkout-auth"><span>Member sign-in is not available yet. You can still review this sample order below.</span></div>`;
  app.innerHTML=`<div class="wrap page"><div class="breadcrumb"><a href="#/basket">← Back to basket</a></div><h1>Account before payment.</h1><div class="basket-layout"><section class="checkout-panel"><div class="notice">You have answered the competition question correctly. The next live step will be to sign in or create an account before payment.</div>${authBlock}<form id="checkout-form"><label class="form-field">UK postcode for delivery check<input name="postcode" autocomplete="postal-code" required pattern="[A-Za-z]{1,2}[0-9][A-Za-z0-9]? ?[0-9][A-Za-z]{2}" placeholder="SW1A 1AA"></label><label class="check"><input type="checkbox" required><span>I confirm I am aged 18 or over and a UK resident.</span></label><label class="check"><input type="checkbox" required><span>I understand this preview does not take payment or allocate entries yet.</span></label><button class="btn" type="submit">Review sample order →</button></form></section><aside class="summary"><h3>Your entries</h3>${basket.map(x=>`<p>${prizes.find(p=>p.id===x.id).name}<br>${x.qty} ${x.qty===1?'entry':'entries'}</p>`).join('')}<div class="total"><span>Total</span><span>${money(total())}</span></div><p style="font-size:14px">PayPal or another approved payment provider still needs to be connected before launch.</p></aside></div></div>`;
  document.querySelector('#checkout-form').onsubmit=e=>{e.preventDefault();app.innerHTML=`<div class="wrap page info"><span class="eyebrow">SAMPLE ORDER REVIEW</span><h1>Ready for payment setup.</h1><p>Your selection contains ${basket.reduce((n,x)=>n+x.qty,0)} entries with a sample total of ${money(total())}.</p><div class="notice">No order has been placed. Live account checks, payment and ticket allocation still need to be connected before launch.</div><a class="btn" href="#/basket">Return to basket</a></div>`;window.scrollTo(0,0);};
}

const faqs=[['How many tickets are available for each prize?','Each prize competition is limited to 200 tickets in total. The preview shows sample allocations; no real tickets have been sold.'],['Is this website accepting entries?','Not yet. This preview demonstrates the browsing, selection and checkout journey. Every prize listing, entry price, entry allocation and closing date is illustrative.'],['Who will be able to enter?','Competitions are open to UK residents aged 18 or over. Full eligibility rules are in the <a href="#/terms">Terms &amp; Conditions</a>.'],['How many entries can I choose?','This preview allows up to 50 entries per competition in your basket. The per-person and overall limits for each live competition are shown on that competition page and in the Terms &amp; Conditions.'],['How will winners be selected?','Eligible correct entries are entered into a random draw. Draw timing, notification and claim rules are set out in the <a href="#/terms">Terms &amp; Conditions</a>.'],['Is a free entry route available?','Yes. A free postal entry route is described in the <a href="#/terms">Terms &amp; Conditions</a>. Free entries follow the same eligibility, skill-question, ticket-limit and closing rules as paid entries.'],['Is Win &amp; Build affiliated with LEGO?','No. Win &amp; Build is independent from the LEGO Group. Product names are used to identify the sets shown.']];

function info(kind){const content=kind==='faqs'?`<span class="eyebrow">THE USEFUL DETAILS</span><h1>A few good questions.</h1>${faqs.map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}`:`<h1>Privacy in this preview.</h1><p>The basket is held in memory for the current page session. Refreshing the page clears it. Checkout details are not transmitted or stored by this application.</p><p>Product imagery loads from LEGO and fonts load from Google Fonts; those services receive the network requests needed to display those resources. The hosting service may process technical request data to serve the site.</p><h2>Before launch</h2><p>Competition rules, including how personal data is used for draws, prizes and winner publicity, are set out in the <a href="#/terms">Terms &amp; Conditions</a>. A full privacy notice identifying the operator, contact details, payment and service providers, retention periods and user rights is still required before real customer details are collected.</p>`;app.innerHTML=`<div class="wrap page info">${content}</div>`;}

function membersPage(){app.innerHTML=`<div class="wrap page"><div class="member-layout"><section><span class="eyebrow">YOUR WIN &amp; BUILD ACCOUNT</span><h1>A home for<br>your next big build.</h1><p>Create an account to return to your member area.</p><div class="member-benefits"><h3>One account. Your competitions.</h3><p>Sign in with your email and password. Account recovery will help you get back in if you forget your password.</p></div></section><section class="member-panel" aria-labelledby="member-title"><h2 id="member-title">Welcome to the club.</h2><p>Member registration is coming soon.</p><div class="notice">Accounts are not available yet. Please check back when registration opens.</div><button class="btn full" disabled>Create an account</button><button class="btn outline full" disabled style="margin-top:12px">Sign in</button><p style="font-size:14px;text-align:center">Already a member? Password recovery will be available here.</p></section></div></div>`;if(typeof loadMemberAccount==='function')loadMemberAccount();}

function route(){
  if(!prizesLoaded){loadingPage(prizesLoadError?'Prizes unavailable. Retrying is available from the error screen.':'Loading competitions…');if(prizesLoadError)errorPage();return;}
  const path=location.hash.slice(1)||'/';
  if(path==='/')home();
  else if(path==='/competitions')app.innerHTML=`<div class="wrap page">${catalogue()}${how()}</div>`;
  else if(path.startsWith('/competition/')){const p=prizes.find(p=>p.id===path.split('/')[2]);if(p)detail(p);else app.innerHTML='<div class="wrap page"><h1>Competition not found.</h1><a class="btn" href="#/competitions">Browse competitions</a></div>';}
  else if(path==='/members')membersPage();
  else if(path==='/basket')basketPage();
  else if(path==='/checkout')checkout();
  else if(path==='/how-it-works')app.innerHTML=`<div class="wrap page"><h1>Great builds start here.</h1>${how()}<div class="notice">This is a preview. Live competition and draw details will be published before launch.</div><a class="btn" href="#/competitions">Explore the prizes →</a></div>`;
  else if(path==='/terms')termsPage();
  else if(['/faqs','/privacy'].includes(path))info(path.slice(1));
  else home();
  window.scrollTo(0,0);
  count();
}

async function loadPrizes(force){
  if(force){prizesLoaded=false;prizesLoadError=null;}
  loadingPage('Loading competitions…');
  try{
    const response=await fetch('/api/prizes',{cache:'no-store'});
    if(!response.ok)throw Error('bad status');
    const data=await response.json();
    if(!Array.isArray(data))throw Error('bad payload');
    prizes=data;
    prizesLoaded=true;
    prizesLoadError=null;
    route();
  }catch{
    prizes=[];
    prizesLoaded=false;
    prizesLoadError=true;
    errorPage();
  }
}

window.addEventListener('hashchange',route);
window.checkAnswer=checkAnswer;
window.adjust=adjust;
window.updateTotal=updateTotal;
window.removeItem=removeItem;
window.changeQty=changeQty;

if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'filter_competitions',description:'Filter the visible competition catalogue by theme. Does not purchase entries.',inputSchema:{type:'object',properties:{theme:{type:'string'}},required:['theme'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){filter=input.theme;app.innerHTML=`<div class="wrap page">${catalogue()}${how()}</div>`;return {theme:filter,prizes:prizes.filter(p=>filter==='All prizes'||p.theme===filter).map(p=>({id:p.id,name:p.name}))}}})).catch(()=>{});}catch{}}

function termsPage(){app.innerHTML=`<div class="wrap page info"><span class="eyebrow">PLEASE READ BEFORE ENTERING</span><h1>Terms and conditions.</h1><div class="notice"><strong>Legal review required.</strong> These terms should be reviewed by a UK legal adviser before any paid competition opens. They are not legal advice.</div><p><strong>Last updated:</strong> 24 September 2026</p><p>These Terms and Conditions (“Terms”) apply to prize competitions run on winandbuild.co.uk (the “Website”) by Win &amp; Build (“we”, “us”, “our” or the “Promoter”). By entering a competition you agree to these Terms.</p><p>The Promoter is operated by John Cowling trading as Win &amp; Build. Until a company is incorporated, the Promoter’s details are: <strong>[COMPANY NAME]</strong>, registered address <strong>[REGISTERED ADDRESS]</strong>, contact email <strong>[CONTACT EMAIL]</strong>.</p><!-- DECISION NEEDED: replace [COMPANY NAME], [REGISTERED ADDRESS] and [CONTACT EMAIL] with final legal identity details -->

<h2>1. The competitions</h2>
<p>Each competition on the Website is a skill-based prize competition for a building set or related prize described on that competition’s page. Competitions may include current prizes such as Imperial Star Destroyer (set 75394), Mario Kart (set 72037) and The Starry Night (set 21333), or other prizes listed from time to time.</p>
<p>Each competition page states the prize, ticket price, opening and closing times, maximum tickets for that competition, any per-person limit, and the skill question. Unless a competition page says otherwise: tickets cost £2.00 (200p) each; each competition has a maximum of 200 tickets in total; and current competitions close on 30 September 2026 at 20:00 UK time.</p>
<p>Win &amp; Build is independent from the LEGO Group. LEGO®, the LEGO logo and LEGO product names are trademarks of the LEGO Group, which does not sponsor, authorise or endorse this Website or these competitions.</p>

<h2>2. Eligibility</h2>
<p>Competitions are open only to residents of the United Kingdom who are aged 18 or over on the date of entry, except:</p>
<ul>
<li>employees of the Promoter;</li>
<li>anyone professionally connected with the administration of a competition (including agents and suppliers); and</li>
<li>members of the immediate family or household of anyone in the groups above.</li>
</ul>
<p>By entering you confirm that you meet these requirements and can claim any prize you win. We may ask for proof of age, identity, UK address and eligibility. If you do not provide satisfactory proof within a reasonable time, your entry may be void and any prize may be withdrawn.</p>

<h2>3. How to enter (paid route)</h2>
<p>To enter online you must:</p>
<ol>
<li>create or sign in to a member account (sign-in is provided via Auth0);</li>
<li>choose a competition and correctly answer the multiple-choice skill question shown for that entry (answers are checked on our servers);</li>
<li>select the number of tickets you want, up to the per-person and overall limits shown for that competition;</li>
<li>add them to your basket and complete checkout; and</li>
<li>pay the entry fee through our third-party payment provider.</li>
</ol>
<p>A ticket is only allocated once payment has been successfully confirmed. We do not store your full payment-card details. Incomplete entries, failed payments, late entries and entries received after the ticket allocation is full are not valid.</p>
<p>All entries must be in English. You are responsible for keeping your account login secure and for any entries made using your account.</p>

<h2>4. Skill question</h2>
<p>Every entrant must correctly answer the competition’s skill question to have a chance of winning. Questions are multiple-choice. We may rotate questions from a competition’s question set. Only entries with a correct answer are eligible for the draw. An incorrect answer means that entry is not entered into the draw.</p>

<h2>5. Free postal entry route</h2>
<!-- DECISION NEEDED: confirm free postal entry will be offered; confirm postal address, required fields, and whether a member account number must be included -->
<p>A free entry route is available so that paid and free entrants have a genuine chance of winning on the same basis. To enter for free:</p>
<ol>
<li>create a member account on the Website before posting your entry;</li>
<li>write clearly on a postcard (not in a sealed envelope): your full name; UK postal address; email address; telephone number; member account email or account reference; the name of the competition you wish to enter; and your chosen answer to that competition’s skill question;</li>
<li>send the postcard by first-class or second-class UK post to: Free Entry, Win &amp; Build, <strong>[REGISTERED ADDRESS]</strong>.</li>
</ol>
<p>Free entries must arrive before the competition’s published closing time. Proof of posting is not proof of receipt. Hand-delivered entries are not accepted. Bulk or multiple free entries in one envelope count as one entry. You may submit separate free postcards up to the same per-person limit that applies to paid entries for that competition. Incomplete, illegible or late free entries are void. We will not usually acknowledge free postal entries or confirm whether the answer was correct before the draw.</p>
<p>If the competition’s ticket allocation is already full when a free entry arrives, that free entry will not be included in the draw.</p>

<h2>6. Ticket limits, closing and extensions</h2>
<p>Each competition states its maximum number of tickets and any per-person limit. When the maximum is reached, the competition closes to further entries even if the published closing time has not yet arrived.</p>
<p>Entries must be received by us before the published closing time (UK time). We may correct obvious errors on a competition page. We will not extend a closing time solely to sell more tickets. If we must change an opening or closing time for an operational or legal reason, the updated times will be shown on the Website.</p>
<!-- DECISION NEEDED: confirm whether closing dates may be extended for any reason other than operational necessity -->

<h2>7. How winners are chosen</h2>
<!-- DECISION NEEDED: confirm draw method (e.g. witnessed RNG only, or live-streamed draw) and how soon after closing the draw will take place -->
<p>All eligible entries with a correct skill-question answer are entered into a random draw. The winner is selected at random using a random number generator. Unless a competition page says otherwise, the draw will take place within seven days of the closing time. We will keep an auditable record of the draw. If we offer a live-streamed draw for a competition, the date and channel will be stated on that competition’s page.</p>
<p>Our decision on eligibility, the validity of entries and the result of the draw is final, subject to your statutory rights.</p>

<h2>8. Winner notification and claiming the prize</h2>
<!-- DECISION NEEDED: confirm claim period (default 14 days) and alternative-winner process -->
<p>We will contact the winner using the email address and, where available, telephone number on their member account as soon as practicable after the draw. The winner must claim the prize personally within <strong>14 days</strong> of our first contact, and must provide any proof of identity and eligibility we reasonably request.</p>
<p>If the winner cannot be contacted, does not respond, does not claim within 14 days, or fails eligibility checks, we may select an alternative winner by another random draw from the remaining eligible entries. The original winner then loses any entitlement to the prize and is not entitled to a refund of entry fees.</p>
<p>Keep your account contact and delivery details up to date. We are not responsible if we cannot reach you because your details are out of date.</p>

<h2>9. Prizes and delivery</h2>
<p>The prize is the building set or other item described on the competition page, subject to reasonable substitution of equal or greater value if the advertised prize becomes unavailable for reasons outside our control.</p>
<!-- DECISION NEEDED: confirm whether any cash alternative is offered (default: no cash alternative) -->
<p>There is no cash alternative. Prizes are not transferable or exchangeable, except that we may offer an alternative of equal or greater value if necessary.</p>
<p>Once a winner is confirmed, we will arrange UK mainland delivery to the winner’s verified UK address by a tracked postal or courier service as soon as practicable. Delivery timing depends on stock and the carrier; we aim to dispatch within 14 days of a completed claim. Delivery charges are paid by us. We are not responsible for delays caused by the carrier, incorrect addresses supplied by the winner, or events outside our reasonable control.</p>
<p>Building sets may contain small parts. Winners are responsible for safe storage and use, especially around children. Missing pieces should be pursued with the manufacturer’s customer service in the first instance; contact us if you need help.</p>

<h2>10. Payments, refunds and cancellation</h2>
<p>Entry fees are processed by a third-party payment provider. We do not store full card numbers. Entry fees are generally non-refundable once a ticket has been allocated, including where:</p>
<ul>
<li>your answer to the skill question is incorrect;</li>
<li>you later discover you were not eligible;</li>
<li>you are disqualified for breach of these Terms; or</li>
<li>you ask to withdraw after allocation.</li>
</ul>
<p>We will refund duplicate charges caused by a clear payment-provider or system error, and we will refund if we cancel a competition before a winner is drawn (see section 11). Your statutory rights are not affected.</p>
<!-- DECISION NEEDED: confirm final refund policy for cancelled competitions and any goodwill exceptions -->

<h2>11. If tickets do not sell out</h2>
<!-- DECISION NEEDED: confirm whether competitions always proceed regardless of tickets sold, or if a minimum threshold / cancellation / redraw policy applies -->
<p>Unless a competition page states a minimum ticket threshold, the competition will proceed to a draw even if not all tickets are sold. We may void, suspend, cancel or amend a competition if it becomes necessary for legal, technical or operational reasons (for example fraud, website failure or an unfit prize). If we cancel a competition before a winner is drawn, we will refund paid entry fees for that competition. Free postal entrants receive no monetary refund.</p>

<h2>12. Disqualification and misuse</h2>
<p>We may void entries, suspend accounts or exclude you from future competitions if we reasonably believe there has been fraud, misrepresentation, use of multiple accounts to bypass limits, automated or bulk entry abuse, payment abuse, hacking or interference with the Website, abusive conduct toward us or others, or any other breach of these Terms or of the spirit of the competition. No refund is due where an entry is voided for these reasons.</p>

<h2>13. Liability</h2>
<p>Nothing in these Terms excludes or limits liability for death or personal injury caused by negligence, fraud, or any other liability that cannot be limited under English law. Subject to that, and to the extent permitted by law, we are not liable for:</p>
<ul>
<li>entries lost, delayed or corrupted because of network, device, postal or third-party failures;</li>
<li>losses that were not reasonably foreseeable;</li>
<li>any failure or delay caused by events outside our reasonable control; or</li>
<li>loss arising from your use of a prize after delivery, except where caused by our negligence.</li>
</ul>
<p>Your statutory rights as a consumer are not affected.</p>

<h2>14. Data protection and publicity</h2>
<p>We use personal information to run competitions, process payments, deliver prizes, prevent fraud and meet legal obligations, in line with our Privacy Notice on the Website.</p>
<p>If you win, we may publish your surname and county (or equivalent) to show that a valid award took place, and we may ask you to take part in reasonable publicity. You may object to publicity before the closing date by emailing <strong>[CONTACT EMAIL]</strong>; this will not affect your chance of winning. We may still share winner details with the Advertising Standards Authority if required.</p>
<!-- DECISION NEEDED: confirm publicity wording and winner-list process -->

<h2>15. Complaints</h2>
<p>If you have a complaint about a competition, email <strong>[CONTACT EMAIL]</strong> with your name, account email, the competition name and details of the issue. We will aim to respond within 14 days.</p>

<h2>16. Changes to these Terms</h2>
<p>We may update these Terms from time to time. The version on the Website at the time you enter a competition applies to that entry. Material changes will be reflected by updating the “Last updated” date on this page.</p>

<h2>17. Governing law</h2>
<p>These Terms are governed by the laws of England and Wales. The courts of England and Wales have exclusive jurisdiction, except that if you live in Scotland or Northern Ireland you may also bring proceedings in your local courts.</p>

<h2>18. Contact</h2>
<p>Questions about these Terms or a competition: <strong>[CONTACT EMAIL]</strong>. Postal correspondence: Win &amp; Build, <strong>[REGISTERED ADDRESS]</strong>.</p>

<div class="notice"><strong>Before paid competitions open:</strong> replace the placeholder company details, confirm the free-entry postal address and the decision items marked in the page source, then obtain UK legal review. These Terms are not legal advice.</div></div>`;window.scrollTo(0,0);}
loadPrizes();
