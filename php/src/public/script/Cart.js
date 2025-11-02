import { api } from '/utils/api.js';

const elList = document.getElementById('cart-list');
const elEmpty = document.getElementById('empty');
const elCheckAll = document.getElementById('check-all');
const elRemoveSel = document.getElementById('remove-selected');
const elSumItems = document.getElementById('sum-items');
const elSumPrice = document.getElementById('sum-price');
const elBtnCheckout = document.getElementById('btn-checkout');
const elTopbar = document.querySelector('#cart-left .topbar');

let state = { items: [], selected: new Set() };

function rupiah(n){ return 'Rp ' + (Number(n||0)).toLocaleString('id-ID'); }

async function load(){
  const res = await api.get('/cart');
  const data = res?.data || { items: [], summary: { subtotal:0 } };
  state.items = data.items;
  // keep selection for existing ids only
  state.selected = new Set([...state.selected].filter(id => data.items.some(i => i.product_id === id)));
  render();
}

function render(){
  if (!state.items.length){
    elList.innerHTML = '';
    elEmpty.style.display = '';
    elBtnCheckout.disabled = true;
    elSumItems.textContent = '0';
    elSumPrice.textContent = 'Rp 0';
    elCheckAll.checked = false;
    if (elTopbar) elTopbar.style.display = 'none';
    return;
  }

  if (elTopbar) elTopbar.style.display = '';
  
  elEmpty.style.display = 'none';

  elList.innerHTML = state.items.map(i => `
    <div class="item" data-id="${i.product_id}">
      <input type="checkbox" class="chk" ${state.selected.has(i.product_id)?'checked':''}>
      <img class="thumb" src="${i.image_path || '/placeholder.png'}" alt="">
      <div>
        <div class="title">${i.name}</div>
        <div class="muted">${i.store_name ?? ''}</div>
      </div>
      <div class="qty">
        <button class="btn btn-outline btn-dec">−</button>
        <input class="inp-qty" type="number" min="1" value="${i.qty}">
        <button class="btn btn-outline btn-inc">+</button>
      </div>
      <div class="price">${rupiah(i.price)}</div>
      <button class="rm" title="Hapus">×</button>
    </div>
  `).join('');

  // bind events
  elList.querySelectorAll('.chk').forEach(chk=>{
    chk.addEventListener('change', e=>{
      const id = idOf(e.target);
      if (e.target.checked) state.selected.add(id); else state.selected.delete(id);
      updateSummary();
      reflectCheckAll();
    });
  });
  elList.querySelectorAll('.btn-inc').forEach(btn=>{
    btn.addEventListener('click', ()=>changeQty(btn, +1));
  });
  elList.querySelectorAll('.btn-dec').forEach(btn=>{
    btn.addEventListener('click', ()=>changeQty(btn, -1));
  });
  elList.querySelectorAll('.inp-qty').forEach(inp=>{
    inp.addEventListener('change', ()=>setQty(inp));
  });
  elList.querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', ()=>removeLine(btn));
  });

  reflectCheckAll();
  updateSummary();
}

function idOf(el){ return Number(el.closest('.item').dataset.id); }

async function changeQty(btn, delta){
  const row = btn.closest('.item');
  const pid = Number(row.dataset.id);
  const inp = row.querySelector('.inp-qty');
  let next = Math.max(1, Number(inp.value) + delta);
  inp.value = next;
  await setQty(inp, true);
}

async function setQty(inp, silent=false){
  const row = inp.closest('.item');
  const pid = Number(row.dataset.id);
  const qty = Math.max(1, Number(inp.value)||1);
  inp.value = qty;
  
  const res = await api.post('/cart/set', { 
    product_id: pid, 
    qty 
  });
  
  if (res?.ok === false && !silent) alert(res.error || 'Gagal memperbarui jumlah');
  await load();
}

async function removeLine(btn){
  const pid = idOf(btn);
  await api.post('/cart/remove', { product_id: pid });
  state.selected.delete(pid);
  await load();
}

function reflectCheckAll(){
  const ids = state.items.map(i=>i.product_id);
  const allSelected = ids.length && ids.every(id=>state.selected.has(id));
  elCheckAll.checked = allSelected;
}

function updateSummary(){
  const chosen = state.items.filter(i=>state.selected.has(i.product_id));
  const totalQty = chosen.reduce((a,b)=>a + Number(b.qty), 0);
  const subtotal = chosen.reduce((a,b)=>a + Number(b.qty)*Number(b.price), 0);
  elSumItems.textContent = String(totalQty);
  elSumPrice.textContent = rupiah(subtotal);
  elBtnCheckout.disabled = chosen.length === 0;
}

elCheckAll.addEventListener('change', ()=>{
  if (elCheckAll.checked) state.items.forEach(i=>state.selected.add(i.product_id));
  else state.selected.clear();
  render();
});

elRemoveSel.addEventListener('click', async ()=>{
  const ids = [...state.selected];
  for (const id of ids) await api.post('/cart/remove', { product_id: id });
  state.selected.clear();
  await load();
});

elBtnCheckout.addEventListener('click', async ()=>{
  const chosen = state.items
    .filter(i=>state.selected.has(i.product_id))
    .map(i=>({ product_id: i.product_id, qty: Number(i.qty) }));

  const res = await api.post('/checkout/selection', { items: chosen });
  if (!res || res.ok === false) { alert(res?.error || 'Gagal memulai checkout'); return; }
  // SSR page (session will hold selection)
  window.location.assign('/checkout');
});

load();
