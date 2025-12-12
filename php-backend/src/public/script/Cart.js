import { api } from '/utils/api.js';

    /* ---------- elements ---------- */
    const elGroups     = document.getElementById('cart-groups');
    const elEmpty      = document.getElementById('empty');
    const elCheckAll   = document.getElementById('check-all');
    const elRemoveSel  = document.getElementById('remove-selected');
    const elSumItems   = document.getElementById('sum-items');
    const elSumPrice   = document.getElementById('sum-price');
    const elSumLines   = document.getElementById('summary-lines');
    const elBtnCheckout= document.getElementById('btn-checkout');
    const elTopbar     = document.querySelector('#cart-left .topbar');

    /* ---------- state ---------- */
    let state = {
      items: [],                // flat items from API
      selected: new Set(),      // product_id of selected lines
    };

    const rupiah = n => 'Rp ' + Number(n||0).toLocaleString('id-ID');

    /* ---------- data load ---------- */
    async function load() {
      elGroups.classList.add('skeleton');
      const res = await api.get('/cart');
      const data = res?.data || { items: [], summary: { subtotal:0 } };
      state.items = data.items || [];
      // keep only selections that still exist
      const ids = new Set(state.items.map(i=>i.product_id));
      state.selected = new Set([...state.selected].filter(id => ids.has(id)));
      render();
      elGroups.classList.remove('skeleton');
    }

    /* ---------- helpers ---------- */
    const idOf = el => Number(el.closest('.row')?.dataset.id);

    /** group items by store for left column + summary lines */
    function groupByStore(items) {
      const map = new Map();
      for (const it of items) {
        const sid = String(it.store_id ?? 0);
        if (!map.has(sid)) map.set(sid, { store_id: sid, store_name: it.store_name || 'Toko', items: [] });
        map.get(sid).items.push(it);
      }
      return [...map.values()];
    }

    function storeAllSelected(group) {
      const availableItems = group.items.filter(it => (it.availability_status || 'available') === 'available');
      return availableItems.length > 0
        && availableItems.every(it => state.selected.has(it.product_id));
    }

    /* ---------- render ---------- */
    function render() {
      if (!state.items.length) {
        elGroups.innerHTML = '';
        elEmpty.style.display = '';
        elBtnCheckout.disabled = true;
        elSumItems.textContent = '0';
        elSumPrice.textContent = 'Rp 0';
        elSumLines.innerHTML = '';
        elCheckAll.checked = false;
        if (elTopbar) elTopbar.style.display = 'none';
        return;
      }

      if (elTopbar) elTopbar.style.display = '';
      elEmpty.style.display = 'none';

      const groups = groupByStore(state.items);

      // LEFT: groups with store header & rows
      elGroups.innerHTML = groups.map(g => {
        const sChecked = storeAllSelected(g) ? 'checked' : '';
        const rows = g.items.map(i => {
          const status = i.availability_status || 'available';
          const isUnavailable = status !== 'available';
          const checked = !isUnavailable && state.selected.has(i.product_id) ? 'checked' : '';
          const disabledCheckbox = isUnavailable ? 'disabled' : '';
          const disabledQty = isUnavailable ? 'disabled' : '';

          let statusBadge = '';
          if (status === 'deleted') {
            statusBadge = '<span class="status-badge status-deleted">Tidak Tersedia</span>';
          } else if (status === 'out_of_stock') {
            statusBadge = '<span class="status-badge status-out">Habis</span>';
          } else if (status === 'insufficient_stock') {
            statusBadge = `<span class="status-badge status-insufficient">Tersisa ${i.stock}</span>`;
          }

          return `
            <div class="row ${isUnavailable ? 'row-unavailable' : ''}" data-id="${i.product_id}">
              <input type="checkbox" class="chk chk-line" ${checked} ${disabledCheckbox} aria-label="Pilih produk">
              <img class="thumb" src="${i.image_path || '/placeholder.png'}" alt="">
              <div class="info">
                <div class="title">${i.name}</div>
                <div class="muted">${i.store_name ?? ''}</div>
                ${statusBadge}
              </div>
              <div class="right">
                <div class="price">${rupiah(i.price)}</div>
                <button class="rm" title="Hapus" aria-label="Hapus produk">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
                    <path d="M10 11v6M14 11v6"></path>
                  </svg>
                </button>
                <div class="qty">
                  <button class="btn-qty btn-dec" ${disabledQty} aria-label="Kurangi">−</button>
                  <input class="inp-qty" type="number" min="1" value="${i.qty}" ${disabledQty}>
                  <button class="btn-qty btn-inc" ${disabledQty} aria-label="Tambah">+</button>
                </div>
              </div>
            </div>
          `;
        }).join('');

        return `
          <div class="group" data-store="${g.store_id}">
            <div class="head">
              <input type="checkbox" class="chk chk-store" ${sChecked} aria-label="Pilih semua di toko ini">
              <span>${g.store_name}</span>
            </div>
            <div class="box">
              ${rows}
            </div>
          </div>
        `;
      }).join('');

      // Bind row events
      elGroups.querySelectorAll('.chk-line').forEach(chk => {
        chk.addEventListener('change', e => {
          const id = idOf(e.target);
          if (!id) return;
          if (e.target.checked) state.selected.add(id);
          else state.selected.delete(id);
          reflectCheckAll();
          reflectStoreChecks();
          updateSummary();
        });
      });

      elGroups.querySelectorAll('.chk-store').forEach(chk => {
        chk.addEventListener('change', e => {
          const groupEl = e.target.closest('.group');
          const lines = groupEl.querySelectorAll('.row:not(.row-unavailable)');
          if (e.target.checked) {
            lines.forEach(r => state.selected.add(Number(r.dataset.id)));
          } else {
            lines.forEach(r => state.selected.delete(Number(r.dataset.id)));
          }
          render();
        });
      });

      // Qty controls
      elGroups.querySelectorAll('.btn-inc').forEach(btn => {
        btn.addEventListener('click', () => changeQty(btn, +1));
      });
      elGroups.querySelectorAll('.btn-dec').forEach(btn => {
        btn.addEventListener('click', () => changeQty(btn, -1));
      });
      elGroups.querySelectorAll('.inp-qty').forEach(inp => {
        inp.addEventListener('change', () => setQty(inp));
      });

      // Remove item (with confirmation)
      elGroups.querySelectorAll('.rm').forEach(btn => {
        btn.addEventListener('click', () => removeLine(btn));
      });

      reflectCheckAll();
      reflectStoreChecks();
      updateSummary();
    }

    function reflectCheckAll() {
      const availableIds = state.items
        .filter(i => (i.availability_status || 'available') === 'available')
        .map(i => i.product_id);
      const allSelected = availableIds.length && availableIds.every(id => state.selected.has(id));
      elCheckAll.checked = allSelected;
    }
    function reflectStoreChecks() {
      elGroups.querySelectorAll('.group').forEach(g => {
        const rows = g.querySelectorAll('.row:not(.row-unavailable)');
        const all = rows.length && [...rows].every(r => state.selected.has(Number(r.dataset.id)));
        const chk = g.querySelector('.chk-store');
        if (chk) chk.checked = all;
      });
    }

    /* ---------- qty & remove actions ---------- */
    async function changeQty(btn, delta) {
      const row = btn.closest('.row');
      const inp = row.querySelector('.inp-qty');
      const next = Math.max(1, Number(inp.value || 1) + delta);
      inp.value = next;
      await setQty(inp, true);
    }

    async function setQty(inp, silent=false) {
      const row = inp.closest('.row');
      const pid = Number(row.dataset.id);
      const qty = Math.max(1, Number(inp.value)||1);
      inp.value = qty;

      const res = await api.post('/cart/set', { product_id: pid, qty });
      if (res?.ok === false && !silent) alert(res.error || 'Gagal memperbarui jumlah');
      await load();
    }

    async function removeLine(btn) {
      const row = btn.closest('.row');
      const pid = Number(row.dataset.id);
      const name = row.querySelector('.title')?.textContent?.trim() || 'produk ini';

      const ok = confirm(`Hapus ${name} dari keranjang?`);
      if (!ok) return;

      const res = await api.post('/cart/remove', { product_id: pid });
      if (!res?.ok) {
        alert(res?.error || 'Gagal menghapus produk');
        return;
      }
      state.selected.delete(pid);
      await load();
    }

    function updateSummary() {
      const chosen = state.items.filter(i => {
        const status = i.availability_status || 'available';
        return state.selected.has(i.product_id) && status === 'available';
      });
      const totalQty = chosen.reduce((a,b)=>a + Number(b.qty), 0);
      const subtotal = chosen.reduce((a,b)=>a + Number(b.qty)*Number(b.price), 0);

      const byStore = {};
      for (const it of chosen) {
        const key = String(it.store_id ?? 0);
        if (!byStore[key]) byStore[key] = { name: it.store_name || 'Toko', qty:0, sub:0 };
        byStore[key].qty += Number(it.qty);
        byStore[key].sub += Number(it.qty) * Number(it.price);
      }
      const lines = Object.values(byStore);
      elSumLines.innerHTML = lines.map(l => `
        <div class="sum-row">
          <div>
            <div style="font-weight:700">${l.name}</div>
            <div class="muted" style="font-size:12px">Harga (${l.qty} Item)</div>
          </div>
          <div style="font-weight:700">${rupiah(l.sub)}</div>
        </div>
      `).join('');

      elSumItems.textContent = String(totalQty);
      elSumPrice.textContent = rupiah(subtotal);
      elBtnCheckout.disabled = chosen.length === 0;
    }

    /* ---------- top actions ---------- */
    elCheckAll.addEventListener('change', () => {
      if (elCheckAll.checked) {
        state.items.forEach(i => {
          const status = i.availability_status || 'available';
          if (status === 'available') {
            state.selected.add(i.product_id);
          }
        });
      } else {
        state.selected.clear();
      }
      render();
    });

    elRemoveSel.addEventListener('click', async () => {
      const ids = [...state.selected];
      if (!ids.length) {
        alert('Tidak ada produk yang dipilih.');
        return;
      }
      const ok = confirm(`Hapus ${ids.length} produk yang dipilih dari keranjang?`);
      if (!ok) return;

      for (const id of ids) {
        const res = await api.post('/cart/remove', { product_id: id });
        if (!res?.ok) {
          alert(res?.error || 'Gagal menghapus salah satu produk');
          // keep going for others
        }
      }
      state.selected.clear();
      await load();
    });

    elBtnCheckout.addEventListener('click', async () => {
      const chosen = state.items
        .filter(i => {
          const status = i.availability_status || 'available';
          return state.selected.has(i.product_id) && status === 'available';
        })
        .map(i => ({ product_id: i.product_id, qty: Number(i.qty) }));

      if (chosen.length === 0) {
        alert('Tidak ada produk yang tersedia untuk checkout. Silakan periksa keranjang Anda.');
        return;
      }

      const res = await api.post('/checkout/selection', { items: chosen });
      if (!res || res.ok === false) { alert(res?.error || 'Gagal memulai checkout'); return; }
      window.location.assign('/checkout');
    });

    /* ---------- init ---------- */
    load();