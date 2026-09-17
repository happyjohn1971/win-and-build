async function loadMemberAccount(){
 const panel=document.querySelector('.member-panel');if(!panel)return;
 try{
 const response=await fetch('/api/auth/status',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('unavailable');
 const status=await response.json();if(!panel.isConnected)return;
 if(!status.configured)return;
 if(status.authenticated){
 if(!status.emailVerified){panel.innerHTML='<h2>Check your email.</h2><p>Use the verification link in your email before opening your member account. Then sign in again to continue.</p><a class="btn full" href="/auth/login">Sign in again</a><form method="post" action="/auth/logout"><button class="btn outline full" style="margin-top:12px">Sign out</button></form>';return;}
 const profileResponse=await fetch('/api/member/profile',{credentials:'same-origin',cache:'no-store'});if(!profileResponse.ok)throw Error('profile');const profile=await profileResponse.json();if(!panel.isConnected)return;
 panel.innerHTML='<span class="eyebrow">YOUR MEMBER ACCOUNT</span><h2>Welcome back.</h2><p class="member-name"></p><p class="member-email"></p><div class="notice">Your email is verified. Live competition entries are not open yet.</div><div id="member-actions"><a class="btn full" href="#/competitions">Browse competitions</a></div><form method="post" action="/auth/logout"><button class="btn outline full" style="margin-top:12px">Sign out</button></form>';
 panel.querySelector('.member-name').textContent=profile.name;panel.querySelector('.member-email').textContent=profile.email;
 const adminResponse=await fetch('/api/admin/competitions',{credentials:'same-origin',cache:'no-store'});
 if(adminResponse.ok)panel.querySelector('#member-actions').insertAdjacentHTML('beforeend','<a class="btn outline full" style="margin-top:12px" href="/admin.html">Admin dashboard</a>');
 return;
 }
 panel.innerHTML='<h2>Welcome to the club.</h2><p>Create an account using your email and a password, or sign in to your existing account.</p><a class="btn full" href="/auth/signup">Create an account</a><a class="btn outline full" href="/auth/login" style="margin-top:12px">Sign in</a><p style="font-size:14px">Forgotten your password? Choose “Forgot password” on the sign-in page.</p><p style="font-size:12px">You will continue to our account service, Auth0.</p>';
 }catch{if(panel.isConnected){const notice=panel.querySelector('.notice');if(notice)notice.textContent='Member accounts are not available right now. Please try again later.';}}
}
