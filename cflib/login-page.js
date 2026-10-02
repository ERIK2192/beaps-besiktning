// The page someone with the link sees before they have logged in. Served by the middleware in
// place of the app, with a 401, so nothing of the app itself reaches a browser without the
// cookie. Inline rather than a file in the root, because a file in the root is exactly what
// the wall is there to keep out of reach, and because the asset server would answer its own
// redirect for it.
//
// Same look as the app: paper ground, one white card, navy text, the yellow button. One field.
// The language follows the app's own setting, kept in localStorage as beaps-lang.

const SV = {
  'Log in': 'Logga in',
  'Password': 'Lösenord',
  'Enter the team password to open the inspection app.': 'Skriv in teamets lösenord för att öppna besiktningsappen.',
  'You stay logged in on this device until six months pass without the app being opened, or until you log out from the menu.': 'Du förblir inloggad på den här enheten tills det gått sex månader utan att appen öppnats, eller tills du loggar ut från menyn.',
  'Wrong password.': 'Fel lösenord.',
  'Too many attempts. Wait fifteen minutes and try again.': 'För många försök. Vänta en kvart och försök igen.',
  'Too many attempts. Try again in a few seconds.': 'För många försök. Försök igen om några sekunder.',
  'No connection. Check the network and try again.': 'Ingen anslutning. Kontrollera nätverket och försök igen.',
  'The app password is not set on the server yet.': 'Appens lösenord är inte inlagt på servern än.',
  'Add APP_PASSWORD under Settings → Environment variables in the Cloudflare dashboard, then redeploy.': 'Lägg in APP_PASSWORD under Settings → Environment variables i Cloudflares kontrollpanel och deploya om.',
  'Logging in…': 'Loggar in…'
};

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function loginPage({ unconfigured } = {}) {
  return `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Inspection">
<meta name="theme-color" content="#F2F1ED">
<meta name="robots" content="noindex, nofollow">
<title>Beaps Inspection</title>
<style>
  :root{--paper:#F2F1ED;--card:#FFFFFF;--ink:#16325C;--ink2:#6E7C94;--line:#E0DDD7;--brand:#FFC629;--brand-dark:#E9AF12;--rec:#C2352F;
        --serif:ui-serif,Georgia,"Times New Roman",Times,serif}
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  html,body{margin:0;padding:0}
  body{background:var(--paper);color:var(--ink);font-family:var(--serif);font-size:16px;line-height:1.45;
       min-height:100vh;display:flex;flex-direction:column}
  .hero{padding:calc(38px + env(safe-area-inset-top)) 20px 26px;text-align:center}
  .hlogo{width:112px;max-width:44%;height:auto;display:block;margin:0 auto}
  .wrap{padding:0 16px calc(24px + env(safe-area-inset-bottom));max-width:440px;width:100%;margin:0 auto}
  .card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 16px}
  h1{margin:0 0 6px;font-size:18px;font-weight:650;letter-spacing:-.01em}
  p{margin:0}
  .hint{font-size:13px;color:var(--ink2);margin-top:6px}
  label{display:block;font-size:13px;font-weight:600;color:var(--ink2);margin:16px 0 6px}
  input{font-family:inherit;font-size:16px;width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:10px;
        background:#fff;color:var(--ink)}
  input:focus,button:focus-visible{outline:2px solid var(--ink);outline-offset:1px}
  .btn{font-family:inherit;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
       padding:14px 16px;border-radius:11px;font-weight:650;width:100%;background:var(--brand);color:var(--ink);
       min-height:50px;border:1px solid var(--brand-dark);margin-top:14px}
  .btn:active{background:var(--brand-dark)}
  .btn[disabled]{opacity:.55;cursor:default}
  .err{color:var(--rec);font-size:14px;margin-top:10px;min-height:1.3em}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px}
</style>
<div class="hero"><svg class="hlogo" viewBox="0 0 100 100" role="img" aria-label="Beaps"><rect width="100" height="100" rx="24" fill="#16325C"></rect><text x="50" y="50" dy=".35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="64" fill="#FFC629">B</text></svg></div>
<div class="wrap"><div class="card">
${unconfigured ? `
  <h1 data-t="The app password is not set on the server yet.">The app password is not set on the server yet.</h1>
  <p class="hint" data-t="Add APP_PASSWORD under Settings → Environment variables in the Cloudflare dashboard, then redeploy.">Add <code>APP_PASSWORD</code> under Settings → Environment variables in the Cloudflare dashboard, then redeploy.</p>
` : `
  <h1 data-t="Log in">Log in</h1>
  <p class="hint" data-t="Enter the team password to open the inspection app.">Enter the team password to open the inspection app.</p>
  <form id="f" autocomplete="on">
    <label for="pw" data-t="Password">Password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" required>
    <button class="btn" id="go" type="submit" data-t="Log in">Log in</button>
    <div class="err" id="err" aria-live="polite"></div>
  </form>
  <p class="hint" data-t="You stay logged in on this device until six months pass without the app being opened, or until you log out from the menu.">You stay logged in on this device until six months pass without the app being opened, or until you log out from the menu.</p>
`}
</div></div>
<script>
(function(){
  var SV = ${JSON.stringify(SV)};
  var lang = 'en';
  try{ if(localStorage.getItem('beaps-lang') === 'sv') lang = 'sv' }catch(e){}
  var T = function(s){ return (lang === 'sv' && SV[s]) ? SV[s] : s };
  if(lang === 'sv'){
    var els = document.querySelectorAll('[data-t]');
    for(var i = 0; i < els.length; i++){ var k = els[i].getAttribute('data-t'); if(SV[k]) els[i].textContent = SV[k] }
    document.documentElement.lang = 'sv';
  }
  var f = document.getElementById('f'); if(!f) return;
  var pw = document.getElementById('pw'), go = document.getElementById('go'), err = document.getElementById('err');
  try{ pw.focus() }catch(e){}
  f.addEventListener('submit', function(ev){
    ev.preventDefault();
    if(!pw.value) return;
    go.disabled = true; go.textContent = T('Logging in…'); err.textContent = '';
    fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw.value }) })
      .then(function(r){
        if(r.ok){ location.reload(); return }
        var wait = r.status === 429 ? (Number(r.headers.get('Retry-After')) || 900) : 0;
        err.textContent = r.status === 401 ? T('Wrong password.')
                        : r.status === 429 ? (wait < 60 ? T('Too many attempts. Try again in a few seconds.') : T('Too many attempts. Wait fifteen minutes and try again.'))
                        : r.status === 503 ? T('The app password is not set on the server yet.')
                        : T('No connection. Check the network and try again.');
        go.disabled = false; go.textContent = T('Log in');
        if(r.status === 401){ pw.value = ''; try{ pw.focus() }catch(e){} }
      })
      .catch(function(){ err.textContent = T('No connection. Check the network and try again.'); go.disabled = false; go.textContent = T('Log in') });
  });
})();
</script>`;
}
