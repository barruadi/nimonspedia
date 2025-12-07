import { api } from "../utils/api.js";
import { showToast } from '../utils/toast.js';
import { checkBuyerAuth } from '../utils/buyerAuth.js';
import { showLoading, hideLoading } from '../utils/loading.js';

const STATUS_MAP = {
  waiting_approval: "Waiting Approval",
  approved: "Approved",
  on_delivery: "On Delivery",
  received: "Received",
  rejected: "Rejected",
};

function getStatusHistory(currentStatus) {
  const badge = (status, text) =>
    `<span class="order-status-badge status-${status}" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">${text}</span>`;
  const arrow = `<span style="margin: 0 0.25rem; color: #9ca3af;">→</span>`;

  const flows = {
    waiting_approval: null,
    approved: [badge("waiting_approval", "Waiting"), arrow, badge("approved", "Approved")].join(""),
    on_delivery: [
      badge("waiting_approval", "Waiting"),
      arrow,
      badge("approved", "Approved"),
      arrow,
      badge("on_delivery", "On Delivery"),
    ].join(""),
    received: [
      badge("waiting_approval", "Waiting"),
      arrow,
      badge("approved", "Approved"),
      arrow,
      badge("on_delivery", "On Delivery"),
      arrow,
      badge("received", "Received"),
    ].join(""),
    rejected: [badge("waiting_approval", "Waiting"), arrow, badge("rejected", "Rejected")].join(""),
  };
  return flows[currentStatus] || null;
}

let allOrders = [];
let currentStatusFilter = "";

const loadingState = document.getElementById("loadingState");
const mainContent = document.getElementById("mainContent");
const ordersGrid = document.getElementById("ordersGrid");
const emptyState = document.getElementById("emptyState");
const filterSidebar = document.getElementById("filterSidebar");
const detailModal = document.getElementById("detailModal");
const closeDetailModal = document.getElementById("closeDetailModal");
const detailContent = document.getElementById("detailContent");

function getStatusText(status) {
  return STATUS_MAP[status] || status;
}

function formatDate(dateString) {
  if (!dateString) return "Tanggal tidak valid";
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPrice(amount) {
  const num = parseInt(amount, 10);
  if (isNaN(num)) return "Rp 0";
  return `Rp ${num.toLocaleString("id-ID")}`;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function canOrderBeReceived(order) {
  if (order.status !== 'on_delivery') {
    return false;
  }

  if (!order.delivery_time) {
    return false;
  }

  const deliveryTime = new Date(order.delivery_time).getTime();
  const now = new Date().getTime();

  return now >= deliveryTime;
}

function setLoading(isLoading) {
  if (loadingState) loadingState.style.display = isLoading ? "flex" : "none";
  if (mainContent) mainContent.style.display = isLoading ? "none" : "grid";
}

function showEmptyState(title, subtitle) {
  if (emptyState) {
    document.getElementById("emptyStateTitle").textContent = title;
    document.getElementById("emptyStateSubtitle").textContent = subtitle;
    emptyState.style.display = "flex";
  }
  if (ordersGrid) ordersGrid.style.display = "none";
}

function hideEmptyState() {
  if (emptyState) emptyState.style.display = "none";
  if (ordersGrid) ordersGrid.style.display = "flex";
}

function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = "order-card";

  const statusText = getStatusText(order.status);
  const formattedDate = formatDate(order.created_at);
  const formattedTotal = formatPrice(order.total_amount);

  const itemsHTML = (order.items || [])
    .slice(0, 2)
    .map(
      (item) => `
    <div class="order-item">
      <img src="${item.image_path || "/images/placeholder.png"}" alt="${escapeHtml(
        item.product_name
      )}" class="order-item-image">
      <div class="order-item-details">
        <div class="name">${escapeHtml(item.product_name)}</div>
        <div class="qty-price">${item.qty} x ${formatPrice(item.price_at)}</div>
      </div>
    </div>
  `
    )
    .join("");

  const moreItemsText =
    order.items.length > 2
      ? `<div style="font-size: 0.8rem; color: #6b7280; margin-top: 0.5rem;">+ ${
          order.items.length - 2
        } produk lainnya</div>`
      : "";

  card.innerHTML = `
    <div class="order-header">
      <div class="order-info">
          <div class="store-name">Toko: ${escapeHtml(order.store_name)}</div>
          <div class="date-id">${formattedDate} | ID${order.order_id}</div>
      </div>
      <span class="order-status-badge status-${order.status}">${statusText}</span>
    </div>

    <div class="order-items-list">
      ${itemsHTML}
      ${moreItemsText}
    </div>

    <div class="order-footer">
      <div class="order-total">
        <div class="total-label">Total Harga</div>
        <div class="total-amount">${formattedTotal}</div>
      </div>
      <button class="btn-detail" data-order-id="${order.order_id}">
        Lihat Detail Transaksi
      </button>
    </div>
  `;

  card.querySelector(".btn-detail").addEventListener("click", () => showDetailModal(order));

  return card;
}

function renderOrders() {
  const ordersToRender = currentStatusFilter
    ? allOrders.filter((o) => o.status === currentStatusFilter)
    : allOrders;

  if (ordersToRender.length === 0) {
    if (currentStatusFilter) {
      showEmptyState("Tidak Ada Order", "Tidak ada order yang cocok dengan filter ini.");
    } else {
      showEmptyState("Belum Ada Order", "Kamu belum melakukan transaksi apapun.");
    }
    return;
  }

  hideEmptyState();
  ordersGrid.innerHTML = "";
  ordersToRender.forEach((order) => {
    const card = createOrderCard(order);
    ordersGrid.appendChild(card);
  });
}

function showDetailModal(order) {
  const statusHistory = getStatusHistory(order.status);

  const itemsList = (order.items || [])
    .map(
      (item) => `
    <div class="order-item">
      <img src="${item.image_path || "/images/placeholder.png"}" alt="${escapeHtml(
        item.product_name
      )}" class="order-item-image">
      <div class="order-item-details">
        <div class="name">${escapeHtml(item.product_name)}</div>
        <div class="qty-price">${item.qty} x ${formatPrice(item.price_at)} = ${formatPrice(
        item.subtotal
      )}</div>
      </div>
    </div>
  `
    )
    .join("");

  detailContent.innerHTML = `
    <div class="detail-section">
      <div class="detail-section-title">Informasi Order</div>
      <div class="detail-row">
        <span class="detail-label">Order ID</span>
        <span class="detail-value">#${order.order_id}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Tanggal Order</span>
        <span class="detail-value">${formatDate(order.created_at)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Toko</span>
        <span class="detail-value">${escapeHtml(order.store_name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value">
          <span class="order-status-badge status-${order.status}">${getStatusText(order.status)}</span>
        </span>
      </div>
      ${
        statusHistory
          ? `<div class="detail-row">
               <span class="detail-label">Status History</span>
               <span class="detail-value" style="text-align: right;">${statusHistory}</span>
             </div>`
          : ""
      }
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Produk Dipesan</div>
      ${itemsList}
    </div>

    <div class="detail-section">
      <div class="detail-row">
        <span class="detail-label">Total</span>
        <span class="detail-value" style="font-size: 1.25rem; font-weight: 700;">${formatPrice(
          order.total_amount
        )}</span>
      </div>
    </div>

    ${
      order.reject_reason
        ? `<div class="detail-section">
             <div class="detail-section-title">Alasan Penolakan</div>
             <p style="color: #6b7280; font-size: 0.9375rem;">${escapeHtml(order.reject_reason)}</p>
           </div>`
        : ""
    }

    ${
      order.delivery_time
        ? `<div class="detail-section">
             <div class="detail-section-title">Informasi Pengiriman</div>
             <div class="detail-row">
               <span class="detail-label">Estimasi Tiba</span>
               <span class="detail-value">${formatDate(order.delivery_time)}</span>
             </div>
           </div>`
        : ""
    }

    ${
      canOrderBeReceived(order)
        ? `<div class="detail-section">
             <button class="btn-confirm-received" data-order-id="${order.order_id}" style="width: 100%; padding: 0.75rem 1rem; background: #05AA5B; color: white; border: none; border-radius: 0.5rem; font-size: 1rem; font-weight: 500; cursor: pointer; transition: all 0.2s ease;">
               Konfirmasi Penerimaan Barang
             </button>
           </div>`
        : ""
    }
  `;
  detailModal.style.display = "flex";

  const confirmBtn = detailContent.querySelector('.btn-confirm-received');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => handleConfirmReceived(order.order_id));
  }
}

async function handleConfirmReceived(orderId) {
  const confirmBtn = detailContent.querySelector('.btn-confirm-received');

  if (!confirm('Apakah Anda yakin sudah menerima barang ini?')) {
    return;
  }

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Memproses...';
  }

  try {
    const result = await api.post('/orders/received', { order_id: orderId });

    if (!result || !result.ok) {
      throw new Error(result?.error || 'Gagal mengkonfirmasi penerimaan barang');
    }

    detailModal.style.display = "none";
    showToast('Berhasil!', 'Penerimaan barang telah dikonfirmasi.', 'success');
    await initPage();

  } catch (error) {
    console.error('Error confirming receipt:', error);
    showToast('Gagal!', error.message || 'Terjadi kesalahan saat konfirmasi', 'error');

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Konfirmasi Penerimaan Barang';
    }
  }
}

async function initPage() {
  const isAuthorized = await checkBuyerAuth();
  if (!isAuthorized) return;

  setLoading(true);
  try {
    const result = await api.get("/orders");
    if (result === null) {
      window.location.href = "/login";
      return;
    }
    if (result.ok === false) throw new Error(result.error?.message || "Server mengembalikan error");
    if (!result.data || !Array.isArray(result.data.orders))
      throw new Error("Format data dari server salah.");
    allOrders = result.data.orders;
    renderOrders();
  } catch (error) {
    showEmptyState("Terjadi Error", error.message || "Tidak dapat memuat riwayat order.");
  } finally {
    setLoading(false);
  }
}

if (filterSidebar) {
  filterSidebar.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter-btn");
    if (!btn) return;
    filterSidebar.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status;
    renderOrders();
  });
}

if (closeDetailModal) {
  closeDetailModal.addEventListener("click", () => {
    detailModal.style.display = "none";
  });
}

if (detailModal) {
  detailModal.addEventListener("click", (e) => {
    if (e.target === detailModal) detailModal.style.display = "none";
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPage);
} else {
  initPage();
}