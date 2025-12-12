-- Case-insensitive text activation (for emails)
CREATE EXTENSION IF NOT EXISTS citext;

-- ENUMS

-- 1.  User Role
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
    ELSE
        ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin';
    END IF;
END$$;

-- 2. Order Status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM ('waiting_approval','approved','on_delivery','received','rejected');
    END IF;
END$$;

-- 3. Auction Status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'auction_status') THEN
        CREATE TYPE auction_status AS ENUM ('scheduled', 'active', 'ended', 'cancelled');
    END IF;
END$$;

-- 4. Message Type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_type') THEN
        CREATE TYPE message_type AS ENUM ('text', 'image', 'item_preview');
    END IF;
END$$;

-- 5. Feature Names
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feature_name_enum') THEN
        CREATE TYPE feature_name_enum AS ENUM ('checkout_enabled', 'chat_enabled', 'auction_enabled');
    END IF;
END$$;


-- USERS

CREATE TABLE IF NOT EXISTS users (
    user_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email          CITEXT UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    full_name      TEXT NOT NULL,
    role           user_role NOT NULL,
    address        TEXT,
    balance        BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
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
    balance        BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
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
    price          INTEGER NOT NULL CHECK (price >= 1000),
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
CREATE INDEX IF NOT EXISTS idx_products_is_deleted ON products(is_deleted);


-- CATEGORY ITEMS

CREATE TABLE IF NOT EXISTS category_items (
    category_id    INTEGER NOT NULL REFERENCES categories(category_id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (category_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_category_items_product ON category_items(product_id);
CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(category_id);


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
    order_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    buyer_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    store_id         INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE RESTRICT,
    status           order_status NOT NULL DEFAULT 'waiting_approval',
    total_amount     BIGINT NOT NULL CHECK (total_amount >= 0),
    shipping_address TEXT,
    delivery_time    TIMESTAMPTZ,
    reject_reason    TEXT,
    confirmed_at     TIMESTAMPTZ,
    received_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_at ON orders(confirmed_at);


-- ORDER ITEMS

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id       INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    price_at       INTEGER NOT NULL CHECK (price_at >= 1000),
    qty            INTEGER NOT NULL CHECK (qty >= 1),
    subtotal       BIGINT GENERATED ALWAYS AS (price_at * qty) STORED
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);


-- AUCTIONS

CREATE TABLE IF NOT EXISTS auctions (
    auction_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Auto Increment
    product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
    starting_price INTEGER NOT NULL CHECK (starting_price >= 0),
    current_price  INTEGER NOT NULL, -- Constraint check below
    min_increment  INTEGER NOT NULL DEFAULT 1000,
    quantity       INTEGER NOT NULL CHECK (quantity > 0),
    start_time     TIMESTAMPTZ NOT NULL,
    end_time       TIMESTAMPTZ, -- Nullable, filled when ended
    status         auction_status NOT NULL DEFAULT 'scheduled',
    winner_id      INTEGER REFERENCES users(user_id) ON DELETE SET NULL, -- Nullable
    cancellation_reason TEXT, -- Nullable, filled when cancelled
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_auction_current_price CHECK (current_price >= starting_price)
);

CREATE INDEX IF NOT EXISTS idx_auctions_product ON auctions(product_id);
CREATE INDEX IF NOT EXISTS idx_auctions_winner ON auctions(winner_id);
CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status);
CREATE INDEX IF NOT EXISTS idx_auctions_start_end ON auctions(start_time, end_time);


-- AUCTION BIDS

CREATE TABLE IF NOT EXISTS auction_bids (
    bid_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Auto Increment
    auction_id     INTEGER NOT NULL REFERENCES auctions(auction_id) ON DELETE CASCADE,
    bidder_id      INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    bid_amount     INTEGER NOT NULL,
    bid_time       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder ON auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_amount_desc ON auction_bids(auction_id, bid_amount DESC);


-- CHART ROOMS

CREATE TABLE IF NOT EXISTS chat_rooms (
    store_id        INTEGER NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    buyer_id        INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    last_message_at TIMESTAMPTZ, -- Nullable
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (store_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_msg ON chat_rooms(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_buyer ON chat_rooms(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_store ON chat_rooms(store_id);


-- CHAT MESSAGES

CREATE TABLE IF NOT EXISTS chat_messages (
    message_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Auto Increment
    store_id        INTEGER NOT NULL,
    buyer_id        INTEGER NOT NULL,
    sender_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message_type    message_type NOT NULL DEFAULT 'text',
    content         TEXT NOT NULL, -- Text or image path
    product_id      INTEGER REFERENCES products(product_id) ON DELETE SET NULL, -- Nullable, for item_preview
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (store_id, buyer_id) REFERENCES chat_rooms(store_id, buyer_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(store_id, buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);


-- PUSH PREFERENCES

CREATE TABLE IF NOT EXISTS push_preferences (
    user_id         INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    chat_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    auction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    order_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_preferences_user_id ON push_preferences(user_id);

COMMENT ON TABLE push_preferences IS 'User preferences for push notifications';


-- PUSH SUBSCRIPTIONS

CREATE TABLE IF NOT EXISTS push_subscriptions (
    subscription_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    endpoint        TEXT NOT NULL,
    p256dh_key      TEXT NOT NULL,
    auth_key        TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_push_subscription_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

COMMENT ON TABLE push_subscriptions IS 'Stores push notification subscription endpoints per user device';


-- USER FEATURE ACCESS CONTROL

CREATE TABLE IF NOT EXISTS user_feature_access (
    access_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, -- Auto Increment
    user_id         INTEGER REFERENCES users(user_id) ON DELETE CASCADE, -- Nullable for GLOBAL flags
    feature_name    feature_name_enum NOT NULL,
    is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
    reason          TEXT, -- Nullable, reason for disable
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_user ON user_feature_access(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_name ON user_feature_access(feature_name);


-- REVIEWS

CREATE TABLE IF NOT EXISTS reviews (
    review_id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id       INTEGER NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id     INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    buyer_id       INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    rating         INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text    TEXT CHECK (review_text IS NULL OR char_length(review_text) <= 500),
    seller_reply   TEXT CHECK (seller_reply IS NULL OR char_length(seller_reply) <= 500),
    is_hidden      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    replied_at     TIMESTAMPTZ,
    CONSTRAINT uq_review_order_product UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id) WHERE is_hidden = FALSE;
CREATE INDEX IF NOT EXISTS idx_reviews_buyer ON reviews(buyer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON reviews(order_id);


-- REVIEW IMAGES

CREATE TABLE IF NOT EXISTS review_images (
    review_image_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    review_id       INTEGER NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    image_path      TEXT NOT NULL,
    display_order   INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_images_review ON review_images(review_id);
