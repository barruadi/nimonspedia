import { api } from '../utils/api.js';

function initOrderManagementPage() {
    // State
    let allOrders = [];
    let filteredOrders = [];
    let currentPage = 1;
    let ordersPerPage = 12;
    let currentFilter = '';
    let searchQuery = '';
    let selectedOrderId = null;

    // DOM Elements
    const loadingState = document.getElementById('loadingState');
    const mainContent = document.getElementById('mainContent');
    const ordersGrid = document.getElementById('ordersGrid');
    const emptyState = document.getElementById('emptyState');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const paginationContainer = document.getElementById('pagination');
    const paginationText = document.getElementById('paginationText');
    const firstPageBtn = document.getElementById('firstPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const lastPageBtn = document.getElementById('lastPage');
    const pageNumbersContainer = document.getElementById('pageNumbers');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');

    // Modals
    const detailModal = document.getElementById('detailModal');
    const rejectModal = document.getElementById('rejectModal');
    const deliveryModal = document.getElementById('deliveryModal');
    const closeDetailModal = document.getElementById('closeDetailModal');
    const cancelReject = document.getElementById('cancelReject');
    const confirmReject = document.getElementById('confirmReject');
    const cancelDelivery = document.getElementById('cancelDelivery');
    const confirmDelivery = document.getElementById('confirmDelivery');
    const rejectReason = document.getElementById('rejectReason');
    const deliveryDays = document.getElementById('deliveryDays');

    async function initPage() {
        try {
            showLoading();
            console.log('Fetching orders...');
            const result = await api.get('/seller/orders');
            console.log('Orders response:', result);

            if (!result || !result.ok) {
                console.warn('Orders request failed:', result);
                showToast('Unauthorized user!', 'Tolong login sebagai seller...', 'error');
                setTimeout(() => window.location.href = '/login', 1500);
                return;
            }

            allOrders = result.data.orders || [];
            filteredOrders = [...allOrders];
            
            renderOrders();
            hideLoading();
            showMainContent();

        } catch (error) {
            console.error('Error initializing Order Management Page:', error);
            showToast('Gagal memuat data order', error.message, 'error');
            hideLoading();
        }
    }

    function renderOrders() {
        // Calculate pagination
        const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
        const startIndex = (currentPage - 1) * ordersPerPage;
        const endIndex = Math.min(startIndex + ordersPerPage, filteredOrders.length);
        const currentOrders = filteredOrders.slice(startIndex, endIndex);

        // Clear grid
        ordersGrid.innerHTML = '';

        // Show/hide empty state
        if (filteredOrders.length === 0) {
            emptyState.style.display = 'flex';
            ordersGrid.style.display = 'none';
            paginationContainer.style.display = 'none';
            return;
        }

        emptyState.style.display = 'none';
        ordersGrid.style.display = 'grid';

        // Render order cards
        currentOrders.forEach(order => {
            const card = createOrderCard(order);
            ordersGrid.appendChild(card);
        });

        // Update pagination info text
        updatePaginationInfo(startIndex + 1, endIndex, filteredOrders.length);

        // Render pagination
        renderPagination(totalPages);
    }

    // Update pagination info text
    function updatePaginationInfo(start, end, total) {
        if (paginationText) {
            paginationText.textContent = `Menampilkan ${start} sampai ${end} dari ${total} Order`;
        }
    }

    function createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';

        const statusText = getStatusText(order.status);
        const formattedDate = formatDate(order.created_at);
        const formattedTotal = formatPrice(order.total_amount);

        // Get order items (you'll need to fetch this from backend)
        const items = order.items || [];
        const itemsHTML = items.slice(0, 2).map(item => `
            <div class="order-item">
                <img src="${item.image_path || '/images/placeholder.png'}" alt="${escapeHtml(item.product_name)}" class="order-item-image">
                <div class="order-item-details">
                    <div class="order-item-name">${escapeHtml(item.product_name)}</div>
                    <div class="order-item-price">${item.qty} x ${formatPrice(item.price_at)}</div>
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="order-header">
                <div class="order-date-buyer">
                    <div class="order-date">${formattedDate} | ID${order.order_id}</div>
                    <div class="order-buyer">Buyer: ${escapeHtml(order.buyer_name || 'Unknown')}</div>
                </div>
                <span class="order-status-badge status-${order.status}">${statusText}</span>
            </div>

            <div class="order-items">
                ${itemsHTML}
            </div>

            <div class="order-footer">
                <div class="order-total">
                    <div class="order-total-label">Total Harga</div>
                    <div class="order-total-amount">${formattedTotal}</div>
                </div>
                <div class="order-actions">
                    <button class="btn-order-action btn-detail" data-order-id="${order.order_id}">
                        Lihat Detail Transaksi
                    </button>
                    ${getActionButtons(order)}
                </div>
            </div>
        `;

        // Add event listeners
        const detailBtn = card.querySelector('.btn-detail');
        detailBtn.addEventListener('click', () => showDetailModal(order.order_id));

        const approveBtn = card.querySelector('.btn-approve');
        if (approveBtn) {
            approveBtn.addEventListener('click', () => handleApprove(order.order_id));
        }

        const rejectBtn = card.querySelector('.btn-reject');
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => showRejectModal(order.order_id));
        }

        const deliveryBtn = card.querySelector('.btn-delivery');
        if (deliveryBtn) {
            deliveryBtn.addEventListener('click', () => showDeliveryModal(order.order_id));
        }

        return card;
    }

    function getActionButtons(order) {
        if (order.status === 'waiting_approval') {
            return `
                <button class="btn-order-action btn-approve" data-order-id="${order.order_id}">Approve</button>
                <button class="btn-order-action btn-reject" data-order-id="${order.order_id}">Reject</button>
            `;
        } else if (order.status === 'approved') {
            return `<button class="btn-order-action btn-delivery" data-order-id="${order.order_id}">Kirim Barang</button>`;
        }
        return '';
    }

    function getStatusText(status) {
        const statusMap = {
            'waiting_approval': 'Waiting Approval',
            'approved': 'Approved',
            'on_delivery': 'On Delivery',
            'received': 'Received',
            'rejected': 'Rejected'
        };
        return statusMap[status] || status;
    }

    function renderPagination(totalPages) {
        if (filteredOrders.length === 0) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'flex';
        pageNumbersContainer.innerHTML = '';

        // Handle single page case
        if (totalPages <= 1) {
            // First page button
            if (firstPageBtn) {
                firstPageBtn.disabled = true;
            }

            // Previous button
            if (prevPageBtn) {
                prevPageBtn.disabled = true;
            }

            // Show single page number
            const singlePageBtn = createPageButton(1);
            pageNumbersContainer.appendChild(singlePageBtn);

            // Next button
            if (nextPageBtn) {
                nextPageBtn.disabled = true;
            }

            // Last page button
            if (lastPageBtn) {
                lastPageBtn.disabled = true;
            }

            return;
        }

        // Multi-page case
        // First page button
        if (firstPageBtn) {
            firstPageBtn.disabled = currentPage === 1;
        }

        // Previous button
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage === 1;
        }

        // Page numbers with smart display (max 5 numbers)
        const maxPageButtons = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

        // Adjust if we're near the end
        if (endPage - startPage < maxPageButtons - 1) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }

        // Add first page if not visible
        if (startPage > 1) {
            const firstBtn = createPageButton(1);
            pageNumbersContainer.appendChild(firstBtn);
            
            if (startPage > 2) {
                const dots = document.createElement('span');
                dots.className = 'page-dots';
                dots.textContent = '...';
                dots.style.cssText = 'padding: 0 0.5rem; color: #9ca3af; font-size: 0.875rem;';
                pageNumbersContainer.appendChild(dots);
            }
        }

        // Page numbers
        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = createPageButton(i);
            pageNumbersContainer.appendChild(pageBtn);
        }

        // Add last page if not visible
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                const dots = document.createElement('span');
                dots.className = 'page-dots';
                dots.textContent = '...';
                dots.style.cssText = 'padding: 0 0.5rem; color: #9ca3af; font-size: 0.875rem;';
                pageNumbersContainer.appendChild(dots);
            }
            
            const lastBtn = createPageButton(totalPages);
            pageNumbersContainer.appendChild(lastBtn);
        }

        // Next button
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage === totalPages;
        }

        // Last page button
        if (lastPageBtn) {
            lastPageBtn.disabled = currentPage === totalPages;
        }
    }

    // Create page button
    function createPageButton(pageNum) {
        const pageBtn = document.createElement('button');
        pageBtn.className = 'page-number';
        if (pageNum === currentPage) {
            pageBtn.classList.add('active');
        }
        pageBtn.textContent = pageNum;
        pageBtn.addEventListener('click', () => {
            currentPage = pageNum;
            renderOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return pageBtn;
    }

    // Event listeners for pagination buttons
    if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
            currentPage = 1;
            renderOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderOrders();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderOrders();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
            currentPage = totalPages;
            renderOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Items per page change
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            ordersPerPage = parseInt(e.target.value);
            currentPage = 1; // Reset to first page
            renderOrders();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Search functionality with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.trim();
            applyFilters();
        }, 300);
    });

    // Status filter
    statusFilter.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        applyFilters();
    });

    function applyFilters() {
        filteredOrders = allOrders.filter(order => {
            // Status filter
            if (currentFilter && order.status !== currentFilter) {
                return false;
            }

            // Search filter (order ID or buyer name)
            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase();
                const matchesId = order.order_id.toString().includes(searchLower);
                const matchesBuyer = order.buyer_name?.toLowerCase().includes(searchLower);
                return matchesId || matchesBuyer;
            }

            return true;
        });

        currentPage = 1;
        renderOrders();
    }

    // Modal functions
    function showRejectModal(orderId) {
        selectedOrderId = orderId;
        rejectReason.value = '';
        rejectModal.style.display = 'flex';
    }

    function showDeliveryModal(orderId) {
        selectedOrderId = orderId;
        deliveryDays.value = '';
        deliveryModal.style.display = 'flex';
    }

    async function showDetailModal(orderId) {
        try {
            const result = await api.get(`/seller/orders/detail/${orderId}`);
            if (!result.ok) {
                showToast('Gagal memuat detail order', result.error, 'error');
                return;
            }

            const order = result.data.order;
            const detailContent = document.getElementById('detailContent');
            
            // Generate status history based on current status
            const statusHistory = getStatusHistory(order.status);
            
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
                        <span class="detail-label">Status</span>
                        <span class="detail-value">
                            <span class="order-status-badge status-${order.status}">${getStatusText(order.status)}</span>
                        </span>
                    </div>
                    ${statusHistory ? `
                        <div class="detail-row">
                            <span class="detail-label">Status History</span>
                            <span class="detail-value" style="text-align: right;">
                                ${statusHistory}
                            </span>
                        </div>
                    ` : ''}
                </div>

                <div class="detail-section">
                    <div class="detail-section-title">Informasi Buyer</div>
                    <div class="detail-row">
                        <span class="detail-label">Nama</span>
                        <span class="detail-value">${escapeHtml(order.buyer_name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Email</span>
                        <span class="detail-value">${escapeHtml(order.buyer_email)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Alamat</span>
                        <span class="detail-value">${escapeHtml(order.shipping_address || order.buyer_address || 'Alamat tidak tersedia')}</span>
                    </div>
                </div>

                <div class="detail-section">
                    <div class="detail-section-title">Produk</div>
                    ${order.items.map(item => `
                        <div class="order-item">
                            <img src="${item.image_path || '/images/placeholder.png'}" alt="${escapeHtml(item.product_name)}" class="order-item-image">
                            <div class="order-item-details">
                                <div class="order-item-name">${escapeHtml(item.product_name)}</div>
                                <div class="order-item-price">${item.qty} x ${formatPrice(item.price_at)} = ${formatPrice(item.subtotal)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="detail-section">
                    <div class="detail-row">
                        <span class="detail-label">Total</span>
                        <span class="detail-value" style="font-size: 1.25rem; font-weight: 700;">${formatPrice(order.total_amount)}</span>
                    </div>
                </div>

                ${order.reject_reason ? `
                    <div class="detail-section">
                        <div class="detail-section-title">Alasan Penolakan</div>
                        <p style="color: #6b7280; font-size: 0.9375rem;">${escapeHtml(order.reject_reason)}</p>
                    </div>
                ` : ''}

                ${order.delivery_time ? `
                    <div class="detail-section">
                        <div class="detail-section-title">Informasi Pengiriman</div>
                        <div class="detail-row">
                            <span class="detail-label">Estimasi Pengiriman</span>
                            <span class="detail-value">${formatDate(order.delivery_time)}</span>
                        </div>
                    </div>
                ` : ''}
            `;

            detailModal.style.display = 'flex';
        } catch (error) {
            console.error('Error fetching order detail:', error);
            showToast('Gagal memuat detail', error.message, 'error');
        }
    }

    // Generate status history based on current status
    function getStatusHistory(currentStatus) {
        const statusFlows = {
            'waiting_approval': null, // No history yet
            'approved': `
                <span class="order-status-badge status-waiting_approval" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Waiting Approval</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-approved" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Approved</span>
            `,
            'on_delivery': `
                <span class="order-status-badge status-waiting_approval" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Waiting Approval</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-approved" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Approved</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-on_delivery" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">On Delivery</span>
            `,
            'received': `
                <span class="order-status-badge status-waiting_approval" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Waiting Approval</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-approved" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Approved</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-on_delivery" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">On Delivery</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-received" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Received</span>
            `,
            'rejected': `
                <span class="order-status-badge status-waiting_approval" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Waiting Approval</span>
                <span style="margin: 0 0.25rem; color: #9ca3af;">→</span>
                <span class="order-status-badge status-rejected" style="font-size: 0.7rem; padding: 0.25rem 0.5rem;">Rejected</span>
            `
        };

        return statusFlows[currentStatus] || null;
    }

    // Close modals
    closeDetailModal.addEventListener('click', () => {
        detailModal.style.display = 'none';
    });

    cancelReject.addEventListener('click', () => {
        rejectModal.style.display = 'none';
        selectedOrderId = null;
    });

    cancelDelivery.addEventListener('click', () => {
        deliveryModal.style.display = 'none';
        selectedOrderId = null;
    });

    // Close on backdrop click
    [detailModal, rejectModal, deliveryModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                selectedOrderId = null;
            }
        });
    });

    // Handle approve
    async function handleApprove(orderId) {
        try {
            const result = await api.put(`/seller/orders/approve/${orderId}/`);
            if (!result.ok) {
                showToast('Gagal approve order', result.error, 'error');
                return;
            }

            showToast('Order berhasil di-approve!', 'Status order telah diubah menjadi Approved');
            await initPage(); // Refresh data
        } catch (error) {
            console.error('Error approving order:', error);
            showToast('Gagal approve order', error.message, 'error');
        }
    }

    // Handle reject
    confirmReject.addEventListener('click', async () => {
        const reason = rejectReason.value.trim();
        if (!reason) {
            showToast('Alasan penolakan wajib diisi', '', 'error');
            return;
        }

        // Disable button saat loading
        confirmReject.disabled = true;
        confirmReject.textContent = 'Memproses...';

        try {
            const result = await api.put(`/seller/orders/reject/${selectedOrderId}`, {
                reject_reason: reason
            });

            // Hide modal after API call
            rejectModal.style.display = 'none';
            const tempOrderId = selectedOrderId;
            selectedOrderId = null;

            if (!result.ok) {
                showToast('Gagal reject order', result.error || 'Terjadi kesalahan', 'error');
                return;
            }

            showToast('Order berhasil ditolak', 'Balance buyer telah dikembalikan');
            await initPage(); // Refresh data
            
        } catch (error) {
            // Hide modal even on catch error
            rejectModal.style.display = 'none';
            selectedOrderId = null;
            
            console.error('Error rejecting order:', error);
            showToast('Gagal reject order', error.message, 'error');
        } finally {
            // Reenable button
            confirmReject.disabled = false;
            confirmReject.textContent = 'Tolak Order';
        }
    });

    // Handle set delivery
    confirmDelivery.addEventListener('click', async () => {
        const days = parseInt(deliveryDays.value);
        if (!days || days < 1 || days > 30) {
            showToast('Jumlah hari tidak valid', 'Masukkan angka antara 1-30 hari', 'error');
            return;
        }

        // Disable button saat loading
        confirmDelivery.disabled = true;
        confirmDelivery.textContent = 'Memproses...';

        try {
            const result = await api.put(`/seller/orders/delivery/${selectedOrderId}`, {
                delivery_days: days
            });

            // Hide modal after API call
            deliveryModal.style.display = 'none';
            const tempOrderId = selectedOrderId;
            selectedOrderId = null;

            if (!result.ok) {
                showToast('Gagal mengatur pengiriman', result.error || 'Terjadi kesalahan', 'error');
                return;
            }

            showToast('Pengiriman berhasil diatur!', `Estimasi ${days} hari pengiriman`);
            await initPage(); // Refresh data
            
        } catch (error) {
            // Hide modal even on catch error
            deliveryModal.style.display = 'none';
            selectedOrderId = null;
            
            console.error('Error setting delivery:', error);
            showToast('Gagal mengatur pengiriman', error.message, 'error');
        } finally {
            // Reenable button
            confirmDelivery.disabled = false;
            confirmDelivery.textContent = 'Kirim Barang';
        }
    });

    // Helper functions
    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    function formatPrice(amount) {
        return `Rp ${parseInt(amount).toLocaleString('id-ID')}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        if (loadingState) {
            loadingState.style.display = 'flex';
        }
        if (mainContent) {
            mainContent.style.display = 'none';
        }
    }

    function hideLoading() {
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }

    function showMainContent() {
        if (mainContent) {
            mainContent.style.display = 'block';
        }
    }

    function showToast(primaryMessage, secondaryMessage = '', type = 'success') {
        const toast = document.getElementById('toast');
        const backdrop = document.getElementById('toastBackdrop');
        const primaryEl = document.getElementById('toastPrimaryMessage');
        const secondaryEl = document.getElementById('toastSecondaryMessage');
        const closeBtn = document.getElementById('toastCloseBtn');
        
        if (!toast || !primaryEl || !secondaryEl) {
            console.error('Toast elements not found!');
            return;
        }
        
        primaryEl.textContent = primaryMessage;
        secondaryEl.textContent = secondaryMessage;
        toast.className = 'toast ' + type;
        
        if (backdrop) backdrop.style.display = 'block';
        toast.style.display = 'flex';
        
        let autoHideTimer = setTimeout(hideToast, 5000);
        
        if (closeBtn) {
            closeBtn.onclick = () => {
                clearTimeout(autoHideTimer);
                hideToast();
            };
        }
        if (backdrop) {
            backdrop.onclick = () => {
                clearTimeout(autoHideTimer);
                hideToast();
            };
        }

        function hideToast() {
            if (toast) toast.style.display = 'none';
            if (backdrop) backdrop.style.display = 'none';
        }
    }

    console.log('Initializing Order Management page...');
    initPage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOrderManagementPage);
} else {
    setTimeout(initOrderManagementPage, 100);
}