<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feature Disabled - Nimonspedia</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            padding: 48px;
            text-align: center;
            animation: slideUp 0.5s ease-out;
        }

        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .icon {
            width: 120px;
            height: 120px;
            margin: 0 auto 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 60px;
            color: white;
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
        }

        h1 {
            font-size: 32px;
            color: #1a202c;
            margin-bottom: 16px;
            font-weight: 700;
        }

        .feature-name {
            display: inline-block;
            background: #f7fafc;
            color: #667eea;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 24px;
            text-transform: capitalize;
        }

        .message {
            font-size: 18px;
            color: #4a5568;
            line-height: 1.6;
            margin-bottom: 12px;
        }

        .reason {
            background: #fff5f5;
            border-left: 4px solid #fc8181;
            padding: 16px;
            border-radius: 8px;
            margin: 24px 0;
            text-align: left;
        }

        .reason-label {
            font-weight: 600;
            color: #c53030;
            margin-bottom: 8px;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .reason-text {
            color: #742a2a;
            font-size: 16px;
            line-height: 1.5;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
        }

        .badge-global {
            background: #fed7d7;
            color: #c53030;
        }

        .badge-user {
            background: #feebc8;
            color: #c05621;
        }

        .actions {
            margin-top: 32px;
            display: flex;
            gap: 12px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-block;
            padding: 12px 32px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            font-size: 16px;
            transition: all 0.3s ease;
            cursor: pointer;
            border: none;
        }

        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
        }

        .btn-secondary {
            background: #edf2f7;
            color: #4a5568;
        }

        .btn-secondary:hover {
            background: #e2e8f0;
            transform: translateY(-2px);
        }

        @media (max-width: 640px) {
            .container {
                padding: 32px 24px;
            }

            h1 {
                font-size: 24px;
            }

            .icon {
                width: 100px;
                height: 100px;
                font-size: 50px;
            }

            .message {
                font-size: 16px;
            }

            .actions {
                flex-direction: column;
            }

            .btn {
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">
            🚫
        </div>

        <h1>Feature Temporarily Disabled</h1>

        <div class="feature-name">
            <?= htmlspecialchars($featureName ?? 'Unknown Feature') ?>
        </div>

        <?php if ($isGlobal): ?>
            <p class="message">
                This feature is currently under maintenance and unavailable for all users.
            </p>
        <?php else: ?>
            <p class="message">
                This feature has been disabled for your account.
            </p>
        <?php endif; ?>

        <?php if (!empty($reason)): ?>
            <div class="reason">
                <div class="reason-label">
                    <?= $isGlobal ? 'Maintenance Notice' : 'Reason' ?>
                </div>
                <div class="reason-text">
                    <?= htmlspecialchars($reason) ?>
                </div>
                <span class="badge <?= $isGlobal ? 'badge-global' : 'badge-user' ?>">
                    <?= $isGlobal ? 'Global Maintenance' : 'Account Specific' ?>
                </span>
            </div>
        <?php endif; ?>

        <div class="actions">
            <a href="/products" class="btn btn-primary">
                Go to Home
            </a>
            <button onclick="window.history.back()" class="btn btn-secondary">
                Go Back
            </button>
        </div>
    </div>
</body>
</html>
