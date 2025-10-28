\set ON_ERROR_STOP on

BEGIN;

-- Ensure extension/enums exist; safe if already present
CREATE EXTENSION IF NOT EXISTS citext;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('buyer', 'seller');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('waiting_approval','approved','on_delivery','received','rejected');
  END IF;
END$$;

-- Helper: truncate only if table exists
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'order_items','orders','cart_items','carts','products','categories','stores','users'
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

-- USERS
INSERT INTO users (email, password_hash, full_name, role, balance)
VALUES
  ('owner@gadgethub.example',  '$2b$12$placeholderhashseller1', 'Rina Pratama', 'seller', 2500.00),
  ('owner@freshmart.example', '$2b$12$placeholderhashseller2', 'Budi Santoso', 'seller', 1750.00),
  ('alice@example.com',        '$2b$12$placeholderhashbuyer1',  'Alice Wardhani', 'buyer', 500.00),
  ('bob@example.com',          '$2b$12$placeholderhashbuyer2',  'Bob Saputra',    'buyer', 1200.00)
ON CONFLICT (email) DO NOTHING;

-- STORES (needs users)
INSERT INTO stores (owner_id, store_name, description, logo_path)
SELECT u.user_id, s.store_name, s.description, s.logo
FROM (
  VALUES
   ('owner@gadgethub.example','Gadget Hub','Electronics and accessories','/logos/gadgethub.png'),
   ('owner@freshmart.example','FreshMart','Daily groceries and fresh produce','/logos/freshmart.png')
) AS s(owner_email, store_name, description, logo)
JOIN users u ON u.email = s.owner_email
ON CONFLICT (store_name) DO NOTHING;

-- CATEGORIES (NEW)
INSERT INTO categories (name, description)
VALUES
  ('Electronics', 'Electronic devices and accessories'),
  ('Computers & Laptops', 'Computing devices and peripherals'),
  ('Audio & Video', 'Audio and video equipment'),
  ('Food & Beverages', 'Fresh and packaged food items'),
  ('Dairy Products', 'Milk, cheese, and dairy items'),
  ('Beverages', 'Coffee, tea, and drinks'),
  ('Fresh Produce', 'Fruits and vegetables'),
  ('Fashion', 'Clothing and accessories'),
  ('Home & Living', 'Home decor and furniture'),
  ('Sports & Outdoors', 'Sports equipment and outdoor gear')
ON CONFLICT (name) DO NOTHING;

-- PRODUCTS (updated with category_id)
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
  -- Gadget Hub products
  SELECT 'Gadget Hub'::text AS store_name, 'Electronics'::text AS category_name, * FROM (
    VALUES
      ('Wireless Mouse','2.4GHz ergonomic mouse',12.99,120,'/img/mouse.jpg'),
      ('USB-C Charger 65W','PD fast charger',29.50,80,'/img/charger.jpg')
  ) g(name,description,price,stock,img)
  UNION ALL
  SELECT 'Gadget Hub', 'Computers & Laptops', * FROM (
    VALUES
      ('Mechanical Keyboard','RGB blue switch keyboard',59.90,60,'/img/keyboard.jpg')
  ) g2(name,description,price,stock,img)
  UNION ALL
  SELECT 'Gadget Hub', 'Audio & Video', * FROM (
    VALUES
      ('Noise-Canceling Headphones','Over-ear ANC',129.00,35,'/img/headphones.jpg')
  ) g3(name,description,price,stock,img)
  UNION ALL
  -- FreshMart products
  SELECT 'FreshMart', 'Fresh Produce', * FROM (
    VALUES
      ('Organic Apples (1kg)','Crisp & sweet',3.99,200,'/img/apples.jpg')
  ) f(name,description,price,stock,img)
  UNION ALL
  SELECT 'FreshMart', 'Dairy Products', * FROM (
    VALUES
      ('Free-Range Eggs (10)','Large, Grade A',2.89,150,'/img/eggs.jpg'),
      ('Whole Milk (1L)','Fresh dairy milk',1.39,180,'/img/milk.jpg')
  ) f2(name,description,price,stock,img)
  UNION ALL
  SELECT 'FreshMart', 'Beverages', * FROM (
    VALUES
      ('Arabica Coffee Beans (500g)','Medium roast',8.49,90,'/img/coffee.jpg')
  ) f3(name,description,price,stock,img)
) p ON p.store_name = s.store_name AND p.category_name = c.category_name
ON CONFLICT ON CONSTRAINT uq_products_store_name DO NOTHING;

-- CARTS
INSERT INTO carts (buyer_id)
SELECT user_id FROM users WHERE role='buyer'
ON CONFLICT (buyer_id) DO NOTHING;

-- CART ITEMS
WITH
cb1 AS (SELECT cart_id FROM carts c JOIN users u ON u.user_id=c.buyer_id WHERE u.email='alice@example.com'),
cb2 AS (SELECT cart_id FROM carts c JOIN users u ON u.user_id=c.buyer_id WHERE u.email='bob@example.com'),
pm AS (SELECT product_id FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='Gadget Hub' AND p.name='Wireless Mouse'),
pa AS (SELECT product_id FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart'   AND p.name='Organic Apples (1kg)'),
pc AS (SELECT product_id FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='Gadget Hub'  AND p.name='USB-C Charger 65W'),
pk AS (SELECT product_id FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart'   AND p.name='Arabica Coffee Beans (500g)')
INSERT INTO cart_items (cart_id, product_id, qty)
SELECT (SELECT cart_id FROM cb1), (SELECT product_id FROM pm), 2
UNION ALL
SELECT (SELECT cart_id FROM cb1), (SELECT product_id FROM pa), 3
UNION ALL
SELECT (SELECT cart_id FROM cb2), (SELECT product_id FROM pc), 1
UNION ALL
SELECT (SELECT cart_id FROM cb2), (SELECT product_id FROM pk), 2
ON CONFLICT (cart_id, product_id) DO NOTHING;

-- ORDERS + ORDER ITEMS (same as before, products will auto-match)
-- Order A: Alice from Gadget Hub (approved)
WITH
o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, delivery_time)
  SELECT u.user_id, s.store_id, 'approved', 0.00, NOW() + INTERVAL '2 days'
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@example.com' AND s.store_name='Gadget Hub'
  ON CONFLICT DO NOTHING
  RETURNING order_id
),
k AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='Gadget Hub' AND p.name='Mechanical Keyboard'),
c AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='Gadget Hub' AND p.name='USB-C Charger 65W')
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), (SELECT product_id FROM k), (SELECT price FROM k), 1
UNION ALL
SELECT (SELECT order_id FROM o), (SELECT product_id FROM c), (SELECT price FROM c), 2
ON CONFLICT DO NOTHING;

-- Order B: Alice from FreshMart (waiting_approval)
WITH
o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount)
  SELECT u.user_id, s.store_id, 'waiting_approval', 0.00
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@example.com' AND s.store_name='FreshMart'
  ON CONFLICT DO NOTHING
  RETURNING order_id
),
a AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart' AND p.name='Organic Apples (1kg)'),
m AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart' AND p.name='Whole Milk (1L)')
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), (SELECT product_id FROM a), (SELECT price FROM a), 5
UNION ALL
SELECT (SELECT order_id FROM o), (SELECT product_id FROM m), (SELECT price FROM m), 6
ON CONFLICT DO NOTHING;

-- Order C: Bob from Gadget Hub (on_delivery)
WITH
o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, delivery_time)
  SELECT u.user_id, s.store_id, 'on_delivery', 0.00, NOW() + INTERVAL '1 day'
  FROM users u CROSS JOIN stores s
  WHERE u.email='bob@example.com' AND s.store_name='Gadget Hub'
  ON CONFLICT DO NOTHING
  RETURNING order_id
),
h AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='Gadget Hub' AND p.name='Noise-Canceling Headphones')
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), (SELECT product_id FROM h), (SELECT price FROM h), 1
ON CONFLICT DO NOTHING;

-- Order D: Bob from FreshMart (received)
WITH
o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, delivery_time)
  SELECT u.user_id, s.store_id, 'received', 0.00, NOW() - INTERVAL '1 day'
  FROM users u CROSS JOIN stores s
  WHERE u.email='bob@example.com' AND s.store_name='FreshMart'
  ON CONFLICT DO NOTHING
  RETURNING order_id
),
e AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart' AND p.name='Free-Range Eggs (10)'),
cf AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart' AND p.name='Arabica Coffee Beans (500g)')
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), (SELECT product_id FROM e), (SELECT price FROM e), 2
UNION ALL
SELECT (SELECT order_id FROM o), (SELECT product_id FROM cf), (SELECT price FROM cf), 1
ON CONFLICT DO NOTHING;

-- Order E: Alice from FreshMart (rejected)
WITH
o AS (
  INSERT INTO orders (buyer_id, store_id, status, total_amount, reject_reason)
  SELECT u.user_id, s.store_id, 'rejected', 0.00, 'Payment verification failed'
  FROM users u CROSS JOIN stores s
  WHERE u.email='alice@example.com' AND s.store_name='FreshMart'
  ON CONFLICT DO NOTHING
  RETURNING order_id
),
a AS (SELECT product_id, price FROM products p JOIN stores s ON s.store_id=p.store_id WHERE s.store_name='FreshMart' AND p.name='Organic Apples (1kg)')
INSERT INTO order_items (order_id, product_id, price_at, qty)
SELECT (SELECT order_id FROM o), (SELECT product_id FROM a), (SELECT price FROM a), 1
ON CONFLICT DO NOTHING;

-- Update all order totals
UPDATE orders o
SET total_amount = COALESCE(oi.sum_sub, 0), updated_at = NOW()
FROM (
  SELECT order_id, SUM(subtotal) AS sum_sub
  FROM order_items
  GROUP BY order_id
) oi
WHERE o.order_id = oi.order_id;

COMMIT;