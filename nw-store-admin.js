/* Night Wardens static store/admin layer with Firebase-ready upgrade. */
const NW_ADMIN_EMAIL = "geeklitgames@gmail.com";
const PRODUCT_JSON_URL = "products.json?v=firebase-config-1";
const LS_PRODUCT_KEY = "nw_admin_products_local";
const LS_LIBRARY_KEY = "nw_user_library_local";
const LS_CLAIMS_KEY = "nw_purchase_claims_local";

let firebaseReady = false;
let fb = { app:null, auth:null, db:null, storage:null, user:null };
let products = [];

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function moneyToNumber(price){ return Number(String(price||"0").replace(/[^0-9.]/g,"")) || 0; }
function escapeHtml(str){ return String(str ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(msg){ const el=byId('toast'); if(el){ el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'),3200); } else alert(msg); }
function getLocalProducts(){ try{return JSON.parse(localStorage.getItem(LS_PRODUCT_KEY)||"null");}catch{return null;} }
function setLocalProducts(list){ localStorage.setItem(LS_PRODUCT_KEY, JSON.stringify(list)); }
function getLibrary(){ try{return JSON.parse(localStorage.getItem(LS_LIBRARY_KEY)||"[]");}catch{return [];} }
function setLibrary(list){ localStorage.setItem(LS_LIBRARY_KEY, JSON.stringify(list)); }
function getClaims(){ try{return JSON.parse(localStorage.getItem(LS_CLAIMS_KEY)||"[]");}catch{return [];} }
function setClaims(list){ localStorage.setItem(LS_CLAIMS_KEY, JSON.stringify(list)); }

function normalizeProduct(p){
  const title = p.title || p.name || p.shortTitle || 'Night Wardens Product';
  const id = p.id || p.slug || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const category = p.category || p.type || 'book';
  const price = (typeof p.price === 'number') ? `$${p.price.toFixed(2)}` : (p.price || '');
  return {
    ...p,
    id,
    slug: p.slug || id,
    title,
    shortTitle: p.shortTitle || title.split('—')[0].trim(),
    category,
    price,
    squareUrl: p.squareUrl || p.squareLink || '',
    squareLink: p.squareLink || p.squareUrl || '',
    coverUrl: p.coverUrl || p.coverImageUrl || '',
    downloadUrl: p.downloadUrl || p.digitalFileUrl || '',
    included: Array.isArray(p.included) ? p.included : [],
    label: p.label || (p.edition ? String(p.edition).toUpperCase() : 'NIGHT WARDENS')
  };
}
function normalizeProducts(list){ return (list||[]).map(normalizeProduct); }


async function initFirebaseOptional(){
  try{
    if(!window.firebaseConfig || !window.firebaseConfig.apiKey) return false;
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }, { getFirestore, collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, serverTimestamp }, { getStorage, ref, uploadBytes, getDownloadURL }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js')
    ]);
    fb.app = initializeApp(window.firebaseConfig);
    fb.auth = getAuth(fb.app);
    fb.db = getFirestore(fb.app);
    fb.storage = getStorage(fb.app);
    fb.GoogleAuthProvider = GoogleAuthProvider; fb.signInWithPopup = signInWithPopup; fb.signOut = signOut; fb.onAuthStateChanged = onAuthStateChanged;
    fb.collection = collection; fb.doc = doc; fb.getDocs = getDocs; fb.setDoc = setDoc; fb.deleteDoc = deleteDoc; fb.onSnapshot = onSnapshot; fb.serverTimestamp = serverTimestamp;
    fb.ref = ref; fb.uploadBytes = uploadBytes; fb.getDownloadURL = getDownloadURL;
    firebaseReady = true; return true;
  }catch(e){ console.warn('Firebase not ready:', e); return false; }
}

async function loadProducts(){
  await initFirebaseOptional();
  if(firebaseReady){
    try{
      const snap = await fb.getDocs(fb.collection(fb.db,'products'));
      if(!snap.empty){ products = normalizeProducts(snap.docs.map(d => ({ id:d.id, ...d.data() }))).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)); return products; }
    }catch(e){ console.warn('Firestore products failed, falling back:', e); }
  }
  const local = getLocalProducts();
  if(local?.length){ products = normalizeProducts(local); return products; }
  const res = await fetch(PRODUCT_JSON_URL, {cache:'no-store'});
  const json = await res.json();
  products = normalizeProducts(json.products||[]).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  return products;
}

function productCard(p){
  p = normalizeProduct(p);
  const live = !!p.available;
  const cover = p.coverUrl ? `<img class="cover" src="${escapeHtml(p.coverUrl)}" alt="${escapeHtml(p.title)} cover">` : `<div class="cover"><div><b>${escapeHtml(p.shortTitle||p.title)}</b><br><span class="small" style="color:#f5ecdd">Digital Field Office Product File</span></div></div>`;
  const payUrl = p.squareUrl || p.squareLink || "";
  const buy = live && payUrl ? `<a class="btn" href="${escapeHtml(payUrl)}" target="_blank" rel="noopener">Buy Now</a>` : `<button class="btn" disabled>${live ? 'Payment Link Missing' : 'Not Available Yet'}</button>`;
  const claim = live ? `<a class="btn ghost" href="digital-library.html#claim">Claim Digital Access</a>` : `<span class="small">Purchase unlock will appear once the file is uploaded and availability is toggled on.</span>`;
  return `<article class="card product">
    ${cover}
    <div class="row spread" style="margin-top:10px"><span class="stamp">${escapeHtml(p.label||'NIGHT WARDENS')}</span><span class="status ${live?'live':'locked'}">${live?'AVAILABLE':'LOCKED'}</span></div>
    <h3>${escapeHtml(p.title)}</h3>
    <p>${escapeHtml(p.description||'')}</p>
    <div class="row spread"><span class="price">${escapeHtml(p.price||'')}</span><span class="pill">${escapeHtml(p.category||'product')}</span></div>
    <div class="list" style="margin:10px 0">${(p.included||[]).map(x=>`<div class="item">${escapeHtml(x)}</div>`).join('')}</div>
    <div class="row">${buy}${claim}</div>
  </article>`;
}

async function renderStore(){
  await loadProducts();
  const grid = byId('productGrid'); if(!grid) return;
  const q = (byId('searchProducts')?.value||'').toLowerCase();
  const filter = byId('filterProducts')?.value || 'all';
  const list = products.filter(p => (filter==='all'||p.category===filter||p.label?.toLowerCase().includes(filter)||String(p.edition||'').toLowerCase().includes(filter)) && JSON.stringify(p).toLowerCase().includes(q));
  grid.innerHTML = list.map(productCard).join('') || `<div class="card">No products match.</div>`;
}

function productOptionList(){ return products.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.shortTitle||p.title)}</option>`).join(''); }

async function renderLibrary(){
  await loadProducts();
  const owned = getLibrary();
  const ownedIds = new Set(owned.map(x=>x.productId));
  const grid = byId('libraryGrid'); if(grid){
    const list = products.filter(p=>ownedIds.has(p.id));
    grid.innerHTML = list.length ? list.map(p => `<div class="card libraryEntry"><span class="stamp">OWNED</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description||'')}</p><div class="row">${p.downloadUrl?`<a class="btn" href="${escapeHtml(p.downloadUrl)}" target="_blank">Download</a>`:`<button class="btn" disabled>No file attached yet</button>`}<button class="btn ghost" onclick="openReader('${escapeHtml(p.id)}')">Open Reader</button></div></div>`).join('') : `<div class="card"><h2>No digital library items yet</h2><p>After purchase, submit a claim or wait for admin grant.</p></div>`;
  }
  const select = byId('claimProduct'); if(select) select.innerHTML = productOptionList();
}
window.openReader = function(id){ const p = products.find(x=>x.id===id); if(!p?.downloadUrl){toast('No readable file URL attached yet.'); return;} window.open(p.downloadUrl,'_blank'); };

function submitClaim(){
  const claim = {
    id: uid(),
    productId: byId('claimProduct')?.value,
    email: byId('claimEmail')?.value?.trim(),
    cashTagOrName: byId('claimName')?.value?.trim(),
    paymentMethod: byId('claimMethod')?.value,
    paymentAmount: byId('claimAmount')?.value,
    note: byId('claimNote')?.value?.trim(),
    status:'pending', createdAt:new Date().toISOString()
  };
  if(!claim.email || !claim.productId){ toast('Email and product are required.'); return; }
  const claims = getClaims(); claims.unshift(claim); setClaims(claims);
  toast('Claim saved on this device. Send the proof details to support/admin for verification.');
  ['claimEmail','claimName','claimAmount','claimNote'].forEach(id=>{ if(byId(id)) byId(id).value=''; });
}

async function adminSignIn(){
  if(!firebaseReady){ await initFirebaseOptional(); }
  if(!firebaseReady){ toast('Firebase is not configured. Admin changes will be local/export only.'); showAdminLocal(); return; }
  const provider = new fb.GoogleAuthProvider();
  const cred = await fb.signInWithPopup(fb.auth, provider);
  fb.user = cred.user;
  if(fb.user.email !== NW_ADMIN_EMAIL){ await fb.signOut(fb.auth); toast('Not authorized for Night Wardens admin.'); return; }
  showAdminAuthed();
}
async function adminSignOut(){ if(firebaseReady) await fb.signOut(fb.auth); location.reload(); }
function showAdminLocal(){ byId('adminGate')?.classList.add('hidden'); byId('adminApp')?.classList.remove('hidden'); byId('adminMode').textContent='LOCAL EXPORT MODE — Firebase not configured'; renderAdmin(); }
function showAdminAuthed(){ byId('adminGate')?.classList.add('hidden'); byId('adminApp')?.classList.remove('hidden'); byId('adminMode').textContent=`SIGNED IN: ${fb.user.email}`; renderAdmin(); }

async function renderAdmin(){
  await loadProducts();
  const list = byId('adminProductList'); if(list){
    list.innerHTML = products.map(p => `<div class="item"><div class="row spread"><b>${escapeHtml(p.title)}</b><span class="status ${p.available?'live':'locked'}">${p.available?'LIVE':'LOCKED'}</span></div><div class="small mono">${escapeHtml(p.id)}</div><div class="row" style="margin-top:8px"><button class="btn ghost" onclick="editProduct('${p.id}')">Edit</button><button class="btn ${p.available?'warn':'good'}" onclick="toggleProduct('${p.id}')">${p.available?'Lock':'Make Available'}</button></div></div>`).join('');
  }
  const grantSel = byId('grantProduct'); if(grantSel) grantSel.innerHTML = productOptionList();
  const claims = byId('adminClaims'); if(claims){
    const listClaims = getClaims();
    claims.innerHTML = listClaims.length ? listClaims.map(c=>`<div class="item"><b>${escapeHtml(c.email)}</b> — ${escapeHtml(c.paymentMethod)} ${escapeHtml(c.paymentAmount)}<br><span class="small">${escapeHtml(c.productId)} | ${escapeHtml(c.cashTagOrName)} | ${escapeHtml(c.status)}</span><div class="row" style="margin-top:8px"><button class="btn good" onclick="approveClaim('${c.id}')">Approve local grant</button></div></div>`).join('') : '<div class="small">No local claims on this device.</div>';
  }
}
window.editProduct = function(id){
  const p = products.find(x=>x.id===id); if(!p) return;
  byId('productId').value=p.id; byId('productTitle').value=p.title||''; byId('productPrice').value=p.price||''; byId('productSquare').value=p.squareUrl||p.squareLink||''; byId('productLabel').value=p.label||''; byId('productCategory').value=p.category||'book'; byId('productAvailable').checked=!!p.available; byId('productCover').value=p.coverUrl||''; byId('productDownload').value=p.downloadUrl||''; byId('productDescription').value=p.description||''; byId('productIncluded').value=(p.included||[]).join('\n');
  location.hash='#editor';
};
window.toggleProduct = async function(id){ const p=products.find(x=>x.id===id); if(!p)return; p.available=!p.available; await saveProduct(p); toast(`${p.title} ${p.available?'available':'locked'}.`); renderAdmin(); };
async function saveProduct(p){
  const idx = products.findIndex(x=>x.id===p.id); if(idx>=0) products[idx]=p; else products.push(p);
  products.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)); setLocalProducts(products);
  if(firebaseReady && fb.user?.email===NW_ADMIN_EMAIL){ await fb.setDoc(fb.doc(fb.db,'products',p.id), {...p, updatedAt: fb.serverTimestamp()}); }
}
async function saveProductFromForm(){
  const id = byId('productId').value.trim() || uid();
  const existing = products.find(x=>x.id===id)||{};
  const p = {...existing, id, slug:id, title:byId('productTitle').value.trim(), shortTitle:byId('productTitle').value.trim().split('—')[0].trim(), price:byId('productPrice').value.trim(), squareUrl:byId('productSquare').value.trim(), squareLink:byId('productSquare').value.trim(), label:byId('productLabel').value.trim(), category:byId('productCategory').value, available:byId('productAvailable').checked, coverUrl:byId('productCover').value.trim(), downloadUrl:byId('productDownload').value.trim(), description:byId('productDescription').value.trim(), included:byId('productIncluded').value.split('\n').map(x=>x.trim()).filter(Boolean), libraryEnabled:true, sortOrder: existing.sortOrder || (products.length+1)*10};
  await saveProduct(p); toast('Product saved.'); renderAdmin();
}
async function uploadProductFile(){
  const fileInput = byId('productFile'); const id = byId('productId').value.trim();
  if(!fileInput.files?.[0]){toast('Choose a file first.'); return;}
  if(!id){toast('Set or save product ID first.'); return;}
  if(!firebaseReady || !fb.user){toast('Firebase Storage is not configured/signed in. Upload the file elsewhere and paste the URL.'); return;}
  const file = fileInput.files[0];
  const path = `product-files/${id}/${Date.now()}-${file.name}`;
  const storageRef = fb.ref(fb.storage, path);
  await fb.uploadBytes(storageRef, file);
  const url = await fb.getDownloadURL(storageRef);
  byId('productDownload').value = url;
  toast('File uploaded and download URL filled. Save product to attach it.');
}
function exportProducts(){ const data = JSON.stringify({version:new Date().toISOString(), products}, null, 2); const blob = new Blob([data],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='products.json'; a.click(); }
function importProductsFile(ev){ const f=ev.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{ try{ const json=JSON.parse(r.result); products=json.products||json; setLocalProducts(products); toast('Products imported locally.'); renderAdmin(); }catch(e){toast('Could not import JSON.');} }; r.readAsText(f); }
function grantLibrary(){ const email=byId('grantEmail').value.trim(); const productId=byId('grantProduct').value; if(!email||!productId){toast('Email and product required.');return;} const lib=getLibrary(); lib.unshift({id:uid(), email, productId, source:'admin_local_grant', grantedAt:new Date().toISOString()}); setLibrary(lib); toast('Local library grant saved on this device. Firebase grant can be added in next backend pass.'); }
window.approveClaim = function(id){ const claims=getClaims(); const c=claims.find(x=>x.id===id); if(!c)return; c.status='approved'; setClaims(claims); const lib=getLibrary(); lib.unshift({id:uid(), email:c.email, productId:c.productId, source:'claim_approved_local', claimId:c.id, grantedAt:new Date().toISOString()}); setLibrary(lib); renderAdmin(); toast('Claim approved locally and library access granted on this device.'); };

function bindTabs(){ $$('.tab').forEach(btn=>btn.addEventListener('click',()=>{ $$('.tab').forEach(b=>b.classList.remove('active')); $$('.panel').forEach(p=>p.classList.remove('active')); btn.classList.add('active'); byId(btn.dataset.panel)?.classList.add('active'); })); }

async function init(){
  try{ bindTabs();
  if(byId('productGrid')){ await renderStore(); byId('searchProducts')?.addEventListener('input',renderStore); byId('filterProducts')?.addEventListener('change',renderStore); }
  if(byId('libraryGrid')||byId('claimProduct')){ await renderLibrary(); byId('claimSubmit')?.addEventListener('click',submitClaim); }
  if(byId('adminSignIn')){ await initFirebaseOptional(); if(firebaseReady){ fb.onAuthStateChanged(fb.auth, user=>{ fb.user=user; if(user?.email===NW_ADMIN_EMAIL) showAdminAuthed(); }); } byId('adminSignIn').addEventListener('click',adminSignIn); byId('adminLocal').addEventListener('click',showAdminLocal); byId('adminSignOut')?.addEventListener('click',adminSignOut); byId('saveProduct')?.addEventListener('click',saveProductFromForm); byId('uploadProductFile')?.addEventListener('click',uploadProductFile); byId('exportProducts')?.addEventListener('click',exportProducts); byId('importProducts')?.addEventListener('change',importProductsFile); byId('grantLibrary')?.addEventListener('click',grantLibrary); }
  }catch(e){ console.error('Night Wardens UI init failed', e); toast('Store script error. Static products are still visible.'); }
}
document.addEventListener('DOMContentLoaded', init);
