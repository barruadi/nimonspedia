\set ON_ERROR_STOP on

BEGIN;

-- ============================================================
-- 0. CLEANUP & PREPARATION
-- ============================================================

-- Ensure extension/enums exist
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
  ELSE
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('waiting_approval','approved','on_delivery','received','rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auction_status') THEN
    CREATE TYPE auction_status AS ENUM ('scheduled', 'active', 'ended', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
    CREATE TYPE message_type AS ENUM ('text', 'image', 'item_preview');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_name_enum') THEN
    CREATE TYPE feature_name_enum AS ENUM ('checkout_enabled', 'chat_enabled', 'auction_enabled');
  END IF;
END$$;

-- Truncate tables (Updated with new tables)
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'user_feature_access',
      'push_preferences',
      'push_subscriptions',
      'chat_messages',
      'chat_rooms',
      'auction_bids',
      'auctions',
      'order_items',
      'orders',
      'cart_items',
      'carts',
      'category_items',
      'products',
      'categories',
      'stores',
      'users'
    ]) AS t
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) THEN
      EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE;', t);
    END IF;
  END LOOP;
END$$;


-- ============================================================
-- 1. USERS (Added Admin)
-- ============================================================
-- Passwords:
-- Sellers/Admin: Seller123* ($2y$10$R.bgkavrMB3/1fDjim6HAOZz4g992xbGslFKj6sJCXmf.Prwa8BEO)
-- Buyers: Buyer123* ($2y$10$pmYiDOAeFaNT57lj5b0vi.33dH2k1kBb73AW1b5ZR1WQfq.NUekl.)

INSERT INTO users (email, password_hash, full_name, role, address, balance)
VALUES
  -- ADMIN (NEW)
  ('admin@nimonspedia.com', '$2y$10$R.bgkavrMB3/1fDjim6HAOZz4g992xbGslFKj6sJCXmf.Prwa8BEO', 'Super Admin', 'admin', 'Nimonspedia HQ, Bandung', 0),

  -- SELLERS
  ('rina@gadgethub.com',     '$2y$10$R.bgkavrMB3/1fDjim6HAOZz4g992xbGslFKj6sJCXmf.Prwa8BEO', 'Rina Pratama',   'seller', 'Jl. Sudirman No. 123, Jakarta Pusat', 5000000),
  ('budi@freshmart.com',     '$2y$10$R.bgkavrMB3/1fDjim6HAOZz4g992xbGslFKj6sJCXmf.Prwa8BEO', 'Budi Santoso',   'seller', 'Jl. Gatot Subroto No. 45, Bandung', 3500000),
  ('charlie@fashionista.com','$2y$10$R.bgkavrMB3/1fDjim6HAOZz4g992xbGslFKj6sJCXmf.Prwa8BEO', 'Charlie Wijaya', 'seller', 'Jl. Asia Afrika No. 78, Surabaya', 2800000),
  
  -- BUYERS
  ('alice@buyer.com',        '$2y$10$pmYiDOAeFaNT57lj5b0vi.33dH2k1kBb73AW1b5ZR1WQfq.NUekl.', 'Alice Wardhani', 'buyer',  'Jl. Merdeka No. 67, Jakarta Selatan', 15000000), -- Balance increased for bidding
  ('bob@buyer.com',          '$2y$10$pmYiDOAeFaNT57lj5b0vi.33dH2k1kBb73AW1b5ZR1WQfq.NUekl.', 'Bob Saputra',    'buyer',  'Jl. Diponegoro No. 89, Yogyakarta', 20000000),
  ('carol@buyer.com',        '$2y$10$pmYiDOAeFaNT57lj5b0vi.33dH2k1kBb73AW1b5ZR1WQfq.NUekl.', 'Carol Susanto',  'buyer',  'Jl. Thamrin No. 34, Medan', 12000000)
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- 2. STORES
-- ============================================================
INSERT INTO stores (owner_id, store_name, description, logo_path, balance)
SELECT u.user_id, s.store_name, s.description, s.logo, s.balance
FROM (
  VALUES
   ('rina@gadgethub.com',     'Gadget Hub',        'Your one-stop shop for electronics and accessories',     '/uploads/stores/gadgethub.png',    8500000),
   ('budi@freshmart.com',     'FreshMart',         'Fresh groceries and organic produce delivered daily',    '/uploads/stores/freshmart.png',    5200000),
   ('charlie@fashionista.com','Fashionista Store', 'Trendy fashion and accessories for the modern lifestyle', '/uploads/stores/fashionista.png',  3800000)
) AS s(owner_email, store_name, description, logo, balance)
JOIN users u ON u.email = s.owner_email
ON CONFLICT (store_name) DO NOTHING;


-- ============================================================
-- 3. CATEGORIES
-- ============================================================
INSERT INTO categories (name, description)
VALUES
  ('Electronics',        'Electronic devices, gadgets, and accessories'),
  ('Computers & Laptops','Computing devices, peripherals, and accessories'),
  ('Audio & Video',      'Headphones, speakers, and audio equipment'),
  ('Mobile & Tablets',   'Smartphones, tablets, and mobile accessories'),
  ('Food & Beverages',   'Fresh food, groceries, and beverages'),
  ('Dairy & Eggs',       'Milk, cheese, eggs, and dairy products'),
  ('Beverages',          'Coffee, tea, juices, and soft drinks'),
  ('Fresh Produce',      'Fresh fruits and vegetables'),
  ('Fashion',            'Clothing, shoes, and fashion accessories'),
  ('Men''s Fashion',     'Men''s clothing and accessories'),
  ('Women''s Fashion',   'Women''s clothing and accessories'),
  ('Sports & Outdoors',  'Sports equipment and outdoor gear')
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- 4. PRODUCTS
-- ============================================================
WITH s AS (
  SELECT store_id, store_name FROM stores
),
c AS (
  SELECT category_id, name AS category_name FROM categories
)
INSERT INTO products (store_id, category_id, name, description, price, stock, image_path)
SELECT s.store_id, c.category_id, p.name, p.description, p.price, p.stock, p.img
FROM s
CROSS JOIN c
JOIN (
  -- Gadget Hub
  SELECT 'Gadget Hub'::text AS store_name, 'Electronics'::text AS category_name, * FROM (
    VALUES
      ('Wireless Mouse Logitech',       'Ergonomic 2.4GHz wireless mouse with precision tracking',             149900, 85,  '/uploads/products/mouse-logitech.png'),
      ('USB-C Hub 7-in-1',              'Multi-port USB-C hub with HDMI, USB 3.0, and SD card reader',         399000, 60,  '/uploads/products/usb-hub.png'),
      ('Bluetooth Speaker JBL',         'Portable waterproof speaker with deep bass',                          899000, 45,  '/uploads/products/speaker-jbl.png'),
      ('Smart LED Bulb Philips',        'WiFi-enabled RGB LED bulb with app control',                          189000, 120, '/uploads/products/led-bulb.png')
  ) g1(name, description, price, stock, img)
  UNION ALL
  SELECT 'Gadget Hub', 'Computers & Laptops', * FROM (
    VALUES
      ('Mechanical Keyboard RGB',       'Gaming keyboard with Cherry MX Blue switches and RGB lighting',       799000, 50,  '/uploads/products/keyboard-rgb.png'),
      ('Webcam Full HD 1080p',          'USB webcam with auto-focus and built-in microphone',                  549000, 40,  '/uploads/products/webcam-hd.png'),
      ('Gaming Mouse Pad XXL',          'Extended mouse pad with non-slip rubber base',                        129000, 95,  '/uploads/products/mousepad-xxl.png')
  ) g2(name, description, price, stock, img)
  UNION ALL
  SELECT 'Gadget Hub', 'Audio & Video', * FROM (
    VALUES
      ('Noise-Canceling Headphones Sony','Over-ear ANC headphones with 30-hour battery life',                  2490000, 28,  '/uploads/products/headphones-sony.png'),
      ('True Wireless Earbuds',         'In-ear earbuds with charging case and touch controls',                599000, 75,  '/uploads/products/earbuds-tws.png'),
      ('Condenser Microphone',          'USB studio microphone with pop filter and stand',                     899000, 35,  '/uploads/products/mic-condenser.png')
  ) g3(name, description, price, stock, img)
  UNION ALL
  SELECT 'Gadget Hub', 'Mobile & Tablets', * FROM (
    VALUES
      ('Phone Case iPhone 15 Pro',      'Shockproof transparent case with raised edges',                       249000, 150, '/uploads/products/case-iphone.png'),
      ('Screen Protector Tempered Glass','9H hardness tempered glass screen protector',                        79000,  200, '/uploads/products/screen-protector.png'),
      ('Power Bank 20000mAh',           'Fast charging power bank with dual USB ports',                        349000, 80,  '/uploads/products/powerbank-20k.png')
  ) g4(name, description, price, stock, img)
  
  UNION ALL
  
  -- FreshMart
  SELECT 'FreshMart', 'Fresh Produce', * FROM (
    VALUES
      ('Organic Apples Fuji (1kg)',     'Fresh imported Fuji apples, crisp and sweet',                         49900, 180, '/uploads/products/apples-fuji.png'),
      ('Organic Bananas Cavendish (1kg)','Premium Cavendish bananas, rich in potassium',                       25900, 220, '/uploads/products/bananas.png'),
      ('Fresh Tomatoes (500g)',         'Vine-ripened red tomatoes, perfect for salads',                       18900, 150, '/uploads/products/tomatoes.png'),
      ('Baby Spinach (250g)',           'Fresh organic baby spinach leaves',                                   22900, 100, '/uploads/products/spinach.png')
  ) f1(name, description, price, stock, img)
  UNION ALL
  SELECT 'FreshMart', 'Dairy & Eggs', * FROM (
    VALUES
      ('Free-Range Eggs Large (10pcs)', 'Grade A large eggs from free-range chickens',                         32900, 140, '/uploads/products/eggs-large.png'),
      ('Whole Milk UHT (1L)',           'Fresh whole milk, pasteurized and homogenized',                       16900, 200, '/uploads/products/milk-uht.png'),
      ('Greek Yogurt Plain (500g)',     'Thick and creamy Greek yogurt, high in protein',                      38900, 90,  '/uploads/products/yogurt-greek.png'),
      ('Cheddar Cheese Block (200g)',   'Aged cheddar cheese, perfect for sandwiches',                         45900, 75,  '/uploads/products/cheese-cheddar.png')
  ) f2(name, description, price, stock, img)
  UNION ALL
  SELECT 'FreshMart', 'Beverages', * FROM (
    VALUES
      ('Arabica Coffee Beans (500g)',   'Premium single-origin Arabica beans, medium roast',                   89900, 85,  '/uploads/products/coffee-arabica.png'),
      ('Green Tea Matcha Powder (100g)','Ceremonial grade matcha powder from Japan',                           129000, 60,  '/uploads/products/matcha-powder.png'),
      ('Orange Juice Fresh (1L)',       'Freshly squeezed orange juice, no added sugar',                       28900, 110, '/uploads/products/orange-juice.png'),
      ('Mineral Water (12x600ml)',      'Premium mineral water, sourced from mountain springs',                35900, 150, '/uploads/products/mineral-water.png')
  ) f3(name, description, price, stock, img)
  
  UNION ALL
  
  -- Fashionista
  SELECT 'Fashionista Store', 'Fashion', * FROM (
    VALUES
      ('Classic White T-Shirt',         'Premium cotton crew neck t-shirt, unisex fit',                        129000, 200, '/uploads/products/tshirt-white.png'),
      ('Denim Jeans Slim Fit',          'Stretch denim jeans with modern slim fit',                            449000, 120, '/uploads/products/jeans-slim.png'),
      ('Sneakers Canvas Unisex',        'Comfortable canvas sneakers for everyday wear',                       299000, 95,  '/uploads/products/sneakers-canvas.png')
  ) fs1(name, description, price, stock, img)
  UNION ALL
  SELECT 'Fashionista Store', 'Men''s Fashion', * FROM (
    VALUES
      ('Men''s Formal Shirt Blue',      'Long-sleeve formal shirt, wrinkle-resistant fabric',                  249000, 80,  '/uploads/products/shirt-formal-blue.png'),
      ('Men''s Leather Belt Brown',     'Genuine leather belt with classic buckle',                            179000, 110, '/uploads/products/belt-leather.png'),
      ('Men''s Polo Shirt Navy',        'Cotton polo shirt with embroidered logo',                             189000, 140, '/uploads/products/polo-navy.png')
  ) fs2(name, description, price, stock, img)
  UNION ALL
  SELECT 'Fashionista Store', 'Women''s Fashion', * FROM (
    VALUES
      ('Women''s Floral Dress',         'Summer dress with floral print and flowing silhouette',               359000, 70,  '/uploads/products/dress-floral.png'),
      ('Women''s Cardigan Gray',        'Soft knit cardigan, perfect for layering',                            269000, 90,  '/uploads/products/cardigan-gray.png'),
      ('Women''s Tote Bag Leather',     'Spacious leather tote bag with multiple compartments',                549000, 55,  '/uploads/products/tote-leather.png'),
      ('Women''s Sunglasses Aviator',   'UV protection aviator sunglasses with metal frame',                   189000, 85,  '/uploads/products/sunglasses-aviator.png')
  ) fs3(name, description, price, stock, img)
  
) p ON p.store_name = s.store_name AND p.category_name = c.category_name
ON CONFLICT ON CONSTRAINT uq_products_store_name DO NOTHING;


-- ============================================================
-- 5. CATEGORY ITEMS
-- ============================================================
INSERT INTO category_items (category_id, product_id)
SELECT p.category_id, p.product_id
FROM products p
ON CONFLICT (category_id, product_id) DO NOTHING;


-- ============================================================
-- 6. AUCTIONS (NEW!)
-- ============================================================
-- 1. Active Auction (Ends in 2 days) - Mechanical Keyboard
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Mechanical Keyboard RGB' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 200000, price - 50000, 10000, 5, NOW() - INTERVAL '1 hour', NOW() + INTERVAL '2 days', 'active'
FROM p;

-- 2. Scheduled Auction (Starts tomorrow) - Sony Headphones
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Noise-Canceling Headphones Sony' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 500000, price - 500000, 25000, 2, NOW() + INTERVAL '1 day', NULL, 'scheduled'
FROM p;

-- 3. Ended Auction (Winner: Alice) - JBL Speaker
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Bluetooth Speaker JBL' LIMIT 1),
     u AS (SELECT user_id FROM users WHERE email = 'alice@buyer.com')
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status, winner_id)
SELECT p.product_id, p.price - 300000, p.price - 100000, 15000, 1, NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day', 'ended', u.user_id
FROM p CROSS JOIN u;

-- 4. Scheduled Auction 1 (Starts in 3 days) - Wireless Mouse Logitech
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Wireless Mouse Logitech' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 30000, price - 30000, 5000, 10, NOW() + INTERVAL '3 days', NOW() + INTERVAL '5 days', 'scheduled'
FROM p;

-- 5. Scheduled Auction 2 (Starts in 2 days, ends in 5 days) - Women's Floral Dress
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Women''s Floral Dress' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 80000, price - 80000, 15000, 3, NOW() + INTERVAL '2 days', NOW() + INTERVAL '5 days', 'scheduled'
FROM p;

-- 6. Scheduled Auction 3 (Starts in 4 days, ends in 7 days) - Arabica Coffee Beans
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Arabica Coffee Beans (500g)' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 20000, price - 20000, 5000, 8, NOW() + INTERVAL '4 days', NOW() + INTERVAL '7 days', 'scheduled'
FROM p;

-- 7. Scheduled Auction 4 (Starts tomorrow, ends in 3 days) - Mechanical Keyboard RGB (berbeda dengan active)
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Power Bank 20000mAh' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 50000, price - 50000, 10000, 6, NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 'scheduled'
FROM p;

-- 8. Scheduled Auction 5 (Starts in 5 days) - USB-C Hub
WITH p AS (SELECT product_id, price FROM products WHERE name = 'USB-C Hub 7-in-1' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 60000, price - 60000, 12000, 4, NOW() + INTERVAL '5 days', NOW() + INTERVAL '8 days', 'scheduled'
FROM p;

-- 9. Scheduled Auction 6 (Starts in 6 days) - Men's Formal Shirt Blue
WITH p AS (SELECT product_id, price FROM products WHERE name = 'Men''s Formal Shirt Blue' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 40000, price - 40000, 8000, 5, NOW() + INTERVAL '6 days', NOW() + INTERVAL '9 days', 'scheduled'
FROM p;

-- 10. Scheduled Auction 7 (Starts in 1.5 days) - True Wireless Earbuds
WITH p AS (SELECT product_id, price FROM products WHERE name = 'True Wireless Earbuds' LIMIT 1)
INSERT INTO auctions (product_id, starting_price, current_price, min_increment, quantity, start_time, end_time, status)
SELECT product_id, price - 100000, price - 100000, 15000, 3, NOW() + INTERVAL '36 hours', NOW() + INTERVAL '4 days', 'scheduled'
FROM p;


-- ============================================================
-- 7. AUCTION BIDS (NEW!)
-- ============================================================
-- Bids for Active Auction (Keyboard)
WITH a AS (SELECT auction_id, starting_price FROM auctions WHERE status = 'active' LIMIT 1),
     bob AS (SELECT user_id FROM users WHERE email = 'bob@buyer.com'),
     carol AS (SELECT user_id FROM users WHERE email = 'carol@buyer.com')
INSERT INTO auction_bids (auction_id, bidder_id, bid_amount, bid_time)
SELECT a.auction_id, bob.user_id, a.starting_price + 20000, NOW() - INTERVAL '45 minutes'
FROM a CROSS JOIN bob
UNION ALL
SELECT a.auction_id, carol.user_id, a.starting_price + 50000, NOW() - INTERVAL '10 minutes'
FROM a CROSS JOIN carol;

-- Bids for Ended Auction (Speaker)
WITH a AS (SELECT auction_id, starting_price FROM auctions WHERE status = 'ended' LIMIT 1),
     alice AS (SELECT user_id FROM users WHERE email = 'alice@buyer.com')
INSERT INTO auction_bids (auction_id, bidder_id, bid_amount, bid_time)
SELECT a.auction_id, alice.user_id, a.starting_price + 200000, NOW() - INTERVAL '1 day 2 hours'
FROM a CROSS JOIN alice;


-- ============================================================
-- 8. CARTS & CART ITEMS
-- ============================================================
INSERT INTO carts (buyer_id)
SELECT user_id FROM users WHERE role='buyer'
ON CONFLICT (buyer_id) DO NOTHING;

WITH
alice_cart AS (SELECT cart_id FROM carts c JOIN users u ON u.user_id=c.buyer_id WHERE u.email='alice@buyer.com'),
bob_cart AS (SELECT cart_id FROM carts c JOIN users u ON u.user_id=c.buyer_id WHERE u.email='bob@buyer.com'),
carol_cart AS (SELECT cart_id FROM carts c JOIN users u ON u.user_id=c.buyer_id WHERE u.email='carol@buyer.com')
INSERT INTO cart_items (cart_id, product_id, qty)
-- Alice's cart
SELECT (SELECT cart_id FROM alice_cart), p.product_id, 2 FROM products p WHERE p.name = 'Wireless Mouse Logitech'
UNION ALL
SELECT (SELECT cart_id FROM alice_cart), p.product_id, 1 FROM products p WHERE p.name = 'Noise-Canceling Headphones Sony'
UNION ALL
SELECT (SELECT cart_id FROM alice_cart), p.product_id, 3 FROM products p WHERE p.name = 'Organic Apples Fuji (1kg)'
UNION ALL
-- Bob's cart
SELECT (SELECT cart_id FROM bob_cart), p.product_id, 1 FROM products p WHERE p.name = 'Mechanical Keyboard RGB'
UNION ALL
SELECT (SELECT cart_id FROM bob_cart), p.product_id, 2 FROM products p WHERE p.name = 'Arabica Coffee Beans (500g)'
UNION ALL
SELECT (SELECT cart_id FROM bob_cart), p.product_id, 1 FROM products p WHERE p.name = 'Denim Jeans Slim Fit'
UNION ALL
-- Carol's cart
SELECT (SELECT cart_id FROM carol_cart), p.product_id, 1 FROM products p WHERE p.name = 'Women''s Floral Dress'
UNION ALL
SELECT (SELECT cart_id FROM carol_cart), p.product_id, 2 FROM products p WHERE p.name = 'Free-Range Eggs Large (10pcs)'
ON CONFLICT (cart_id, product_id) DO NOTHING;


-- ============================================================
-- 9. ORDERS & ORDER ITEMS
-- ============================================================

-- Order 1: Alice from Gadget Hub - APPROVED
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, confirmed_at)
  SELECT u.user_id, s.store_id, 'approved', 0, u.address, NOW() - INTERVAL '3 hours'
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@buyer.com' AND s.store_name='Gadget Hub'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'USB-C Hub 7-in-1'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 2 FROM products p WHERE p.name = 'True Wireless Earbuds';

-- Order 2: Bob from FreshMart - WAITING_APPROVAL
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address)
  SELECT u.user_id, s.store_id, 'waiting_approval', 0, u.address
  FROM users u CROSS JOIN stores s
  WHERE u.email='bob@buyer.com' AND s.store_name='FreshMart'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 5 FROM products p WHERE p.name = 'Organic Bananas Cavendish (1kg)'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 3 FROM products p WHERE p.name = 'Whole Milk UHT (1L)'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 2 FROM products p WHERE p.name = 'Greek Yogurt Plain (500g)';

-- Order 3: Carol from Fashionista Store - ON_DELIVERY
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, delivery_time, confirmed_at)
  SELECT u.user_id, s.store_id, 'on_delivery', 0, u.address, NOW() + INTERVAL '2 days', NOW() - INTERVAL '1 day'
  FROM users u CROSS JOIN stores s
  WHERE u.email='carol@buyer.com' AND s.store_name='Fashionista Store'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 2 FROM products p WHERE p.name = 'Women''s Cardigan Gray'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Women''s Tote Bag Leather';

-- Order 4: Alice from Fashionista Store - RECEIVED
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, delivery_time, confirmed_at, received_at)
  SELECT u.user_id, s.store_id, 'received', 0, u.address, NOW() - INTERVAL '5 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days'
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@buyer.com' AND s.store_name='Fashionista Store'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Classic White T-Shirt'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Sneakers Canvas Unisex';

-- Order 5: Bob from Gadget Hub - RECEIVED
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, delivery_time, confirmed_at, received_at)
  SELECT u.user_id, s.store_id, 'received', 0, u.address, NOW() - INTERVAL '10 days', NOW() - INTERVAL '12 days', NOW() - INTERVAL '9 days'
  FROM users u CROSS JOIN stores s
  WHERE u.email='bob@buyer.com' AND s.store_name='Gadget Hub'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Bluetooth Speaker JBL'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Power Bank 20000mAh';

-- Order 6: Carol from FreshMart - REJECTED
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, reject_reason, confirmed_at)
  SELECT u.user_id, s.store_id, 'rejected', 0, u.address, 'Payment verification failed - insufficient funds', NOW() - INTERVAL '4 days'
  FROM users u CROSS JOIN stores s
  WHERE u.email='carol@buyer.com' AND s.store_name='FreshMart'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 10 FROM products p WHERE p.name = 'Organic Apples Fuji (1kg)';

-- Order 7: Alice from FreshMart - WAITING_APPROVAL
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address)
  SELECT u.user_id, s.store_id, 'waiting_approval', 0, u.address
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@buyer.com' AND s.store_name='FreshMart'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 2 FROM products p WHERE p.name = 'Arabica Coffee Beans (500g)'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Green Tea Matcha Powder (100g)';

-- Order 8: Bob from Fashionista Store - APPROVED
WITH o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, shipping_address, confirmed_at)
  SELECT u.user_id, s.store_id, 'approved', 0, u.address, NOW() - INTERVAL '6 hours'
  FROM users u CROSS JOIN stores s
  WHERE u.email='bob@buyer.com' AND s.store_name='Fashionista Store'
  RETURNING order_id
)
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), p.product_id, p.price, 2 FROM products p WHERE p.name = 'Men''s Polo Shirt Navy'
UNION ALL
SELECT (SELECT order_id FROM o), p.product_id, p.price, 1 FROM products p WHERE p.name = 'Men''s Leather Belt Brown';

-- UPDATE ORDER TOTALS
UPDATE orders o
SET total_amount = COALESCE(oi.sum_sub, 0), updated_at = NOW()
FROM (
  SELECT order_id, SUM(subtotal) AS sum_sub
  FROM order_items
  GROUP BY order_id
) oi
WHERE o.order_id = oi.order_id;


-- ============================================================
-- 10. CHAT ROOMS & MESSAGES
-- ============================================================
-- Room 1: Alice & Gadget Hub
WITH u AS (SELECT user_id FROM users WHERE email='alice@buyer.com'),
     s AS (SELECT store_id FROM stores WHERE store_name='Gadget Hub')
INSERT INTO chat_rooms (store_id, buyer_id, last_message_at)
SELECT s.store_id, u.user_id, NOW()
FROM u CROSS JOIN s;

-- Messages for Room 1
WITH r AS (
    SELECT cr.store_id, cr.buyer_id, u.user_id as alice_id, s.owner_id as rina_id
    FROM chat_rooms cr
    JOIN users u ON u.user_id = cr.buyer_id
    JOIN stores s ON s.store_id = cr.store_id
    WHERE u.email='alice@buyer.com' AND s.store_name='Gadget Hub'
)
INSERT INTO chat_messages (store_id, buyer_id, sender_id, message_type, content, is_read, created_at)
SELECT store_id, buyer_id, alice_id, 'text'::message_type, 'Halo, apakah keyboard RGB ready stock?', true, NOW() - INTERVAL '1 hour' FROM r
UNION ALL
SELECT store_id, buyer_id, rina_id, 'text'::message_type, 'Halo kak Alice! Iya ready stock ya, silakan diorder.', true, NOW() - INTERVAL '55 minutes' FROM r
UNION ALL
SELECT store_id, buyer_id, alice_id, 'text'::message_type, 'Oke terima kasih infonya.', false, NOW() - INTERVAL '5 minutes' FROM r;


-- ============================================================
-- 11. PUSH PREFERENCES
-- ============================================================
INSERT INTO push_preferences (user_id, chat_enabled, auction_enabled, order_enabled)
SELECT user_id, true, true, true
FROM users
ON CONFLICT (user_id) DO NOTHING;


-- ============================================================
-- 12. USER FEATURE ACCESS
-- ============================================================
-- Global Feature Flags (user_id IS NULL)
INSERT INTO user_feature_access (user_id, feature_name, is_enabled, reason)
VALUES
  (NULL, 'checkout_enabled', true, 'Global checkout feature'),
  (NULL, 'chat_enabled', true, 'Global chat feature'),
  (NULL, 'auction_enabled', true, 'Global auction feature');

COMMIT;