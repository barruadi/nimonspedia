<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment - Nimonspedia</title>
    <script src="https://app.sandbox.midtrans.com/snap/snap.js"
            data-client-key="Mid-client-EKEzJsaRryUO3Sll">
    </script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: white;
            min-height: 100vh;
            display: flex;
        }

        /* Navbar styling */
        .navbar-container {
            width: 250px;
            background: #22c55e;
            min-height: 100vh;
            position: fixed;
            left: 0;
            top: 0;
            box-shadow: 2px 0 10px rgba(0,0,0,0.1);
        }

        /* Main content area */
        .main-content {
            margin-left: 250px;
            flex: 1;
            padding: 40px;
            background: white;
        }

        .payment-container {
            max-width: 800px;
            margin: 0 auto;
        }

        .payment-header {
            margin-bottom: 30px;
        }

        .payment-header h1 {
            color: #22c55e;
            font-size: 32px;
            margin-bottom: 10px;
            font-weight: 700;
        }

        .payment-header p {
            color: #666;
            font-size: 16px;
        }

        .order-summary {
            background: #f0fdf4;
            border: 2px solid #22c55e;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
        }

        .order-summary h3 {
            color: #22c55e;
            font-size: 20px;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #86efac;
            font-weight: 600;
        }

        .order-item {
            background: white;
            border: 1px solid #86efac;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }

        .order-item h4 {
            color: #16a34a;
            font-size: 18px;
            margin-bottom: 12px;
            font-weight: 600;
        }

        .order-item-detail {
            display: flex;
            justify-content: space-between;
            color: #666;
            font-size: 15px;
            margin-bottom: 8px;
            padding: 8px 0;
            border-bottom: 1px solid #f0fdf4;
        }

        .order-item-detail:last-child {
            border-bottom: none;
        }

        .order-item-detail span:first-child {
            font-weight: 500;
        }

        .order-item-detail span:last-child {
            color: #16a34a;
            font-weight: 600;
        }

        .total-section {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 30px;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
        }

        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .total-label {
            font-size: 20px;
            font-weight: 600;
        }

        .total-amount {
            font-size: 36px;
            font-weight: bold;
        }

        .pay-button {
            width: 100%;
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 20px;
            font-size: 18px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 15px rgba(34, 197, 94, 0.4);
        }

        .pay-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(34, 197, 94, 0.6);
        }

        .pay-button:active {
            transform: translateY(0);
        }

        .pay-button:disabled {
            background: #ccc;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .loading {
            display: none;
            text-align: center;
            margin-top: 20px;
        }

        .loading.active {
            display: block;
        }

        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #22c55e;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading p {
            color: #22c55e;
            font-weight: 500;
        }

        .security-note {
            text-align: center;
            margin-top: 20px;
            color: #999;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .security-note svg {
            width: 16px;
            height: 16px;
            margin-right: 5px;
        }

        /* Responsive */
        @media (max-width: 768px) {
            .navbar-container {
                width: 100%;
                min-height: auto;
                position: relative;
            }

            .main-content {
                margin-left: 0;
                padding: 20px;
            }

            .payment-header h1 {
                font-size: 24px;
            }

            .total-amount {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <!-- Side Navbar -->
    <div class="navbar-container">
        <nav-bar></nav-bar>
    </div>

    <!-- Main Content -->
    <div class="main-content">
        <div class="payment-container">
            <div class="payment-header">
                <h1>Complete Your Payment</h1>
                <p>You're almost done! Complete the payment to confirm your order.</p>
            </div>

            <div class="order-summary">
                <h3>Order Summary</h3>
                <?php foreach ($orders as $order): ?>
                    <div class="order-item">
                        <h4><?= htmlspecialchars($order['store_name']) ?></h4>
                        <?php foreach ($order['items'] as $item): ?>
                            <div class="order-item-detail">
                                <span><?= htmlspecialchars($item['product_name'] ?? $item['name'] ?? 'Product') ?> × <?= $item['qty'] ?></span>
                                <span>Rp <?= number_format($item['price_at'] * $item['qty']) ?></span>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="total-section">
                <div class="total-row">
                    <div class="total-label">Total Payment</div>
                    <div class="total-amount">Rp <?= number_format($total) ?></div>
                </div>
            </div>

            <button id="payButton" class="pay-button">
                Pay Now with Midtrans
            </button>

            <div id="loading" class="loading">
                <div class="spinner"></div>
                <p>Creating payment session...</p>
            </div>

            <div class="security-note">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Secure payment powered by Midtrans
            </div>
        </div>
    </div>

    <!-- Load Navbar Web Component -->
    <script src="/components/Navbar.js"></script>

    <script>
        const orderId = <?= $first_order_id ?>;
        const userId = <?= $user['user_id'] ?>;
        const payButton = document.getElementById('payButton');
        const loading = document.getElementById('loading');

        payButton.addEventListener('click', async function() {
            payButton.disabled = true;
            loading.classList.add('active');

            try {
                console.log('[Payment] Creating payment for order:', orderId);

                // Call Node.js API to create payment
                const response = await fetch('http://localhost/api/node/payment/order', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        order_id: orderId,
                        user_id: userId
                    })
                });

                const data = await response.json();

                loading.classList.remove('active');

                if (data.ok && data.data.token) {
                    console.log('[Payment] Snap token received, opening payment page');

                    // Open Midtrans Snap
                    snap.pay(data.data.token, {
                        onSuccess: function(result) {
                            console.log('[Payment] Payment successful:', result);
                            window.location.href = '/checkout/success?order_id=<?= $_GET['order_id'] ?? '' ?>';
                        },
                        onPending: function(result) {
                            console.log('[Payment] Payment pending:', result);
                            alert('Payment is pending. Please complete your payment to process the order.');
                            window.location.href = '/orders';
                        },
                        onError: function(result) {
                            console.error('[Payment] Payment error:', result);
                            alert('Payment failed. Please try again.');
                            payButton.disabled = false;
                        },
                        onClose: function() {
                            console.log('[Payment] Payment popup closed');
                            payButton.disabled = false;
                        }
                    });
                } else {
                    throw new Error(data.error || 'Failed to create payment');
                }
            } catch (error) {
                console.error('[Payment] Error:', error);
                loading.classList.remove('active');
                alert('Error creating payment: ' + error.message);
                payButton.disabled = false;
            }
        });
    </script>
</body>
</html>
