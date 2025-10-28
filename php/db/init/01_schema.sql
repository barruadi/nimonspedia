-- Case-insensitive text activation (for emails)
CREATE EXTENSION IF NOT EXISTS citext;


-- Enums

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('buyer', 'seller');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('waiting_approval','approved','on_delivery','received','rejected');
  END IF;
END$$;


-- USERS

CREATE TABLE IF NOT EXISTS users (
  user_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email          CITEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  role           user_role NOT NULL,
  balance        NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- STORES

CREATE TABLE IF NOT EXISTS stores (
  store_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  store_name     TEXT NOT NULL UNIQUE,
  description    TEXT,
  logo_path      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- CATEGORIES

CREATE TABLE IF NOT EXISTS categories (
  category_id    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           TEXT NOT NULL UNIQUE,
  description    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- PRODUCTS

CREATE TABLE IF NOT EXISTS products (
  product_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  store_id       INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
  category_id    INTEGER REFERENCES categories(category_id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock          INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_path     TEXT,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_products_store_name UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_not_deleted ON products(is_deleted) WHERE is_deleted = FALSE;


-- CARTS

CREATE TABLE IF NOT EXISTS carts (
  cart_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buyer_id       INTEGER NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- CART ITEMS

CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cart_id        INTEGER NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  qty            INTEGER NOT NULL CHECK (qty >= 1),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cart_product UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);


-- ORDERS

CREATE TABLE IF NOT EXISTS orders (
  order_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  buyer_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  store_id       INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
  status         order_status NOT NULL DEFAULT 'waiting_approval',
  total_amount   NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  delivery_time  TIMESTAMPTZ,
  reject_reason  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);


-- ORDER ITEMS

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id       INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  price_at       NUMERIC(12,2) NOT NULL CHECK (price_at >= 0),
  qty            INTEGER NOT NULL CHECK (qty >= 1),
  subtotal       NUMERIC(14,2) GENERATED ALWAYS AS (price_at * qty) STORED
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);