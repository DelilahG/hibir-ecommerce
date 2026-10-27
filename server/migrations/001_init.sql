CREATE TABLE users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text NOT NULL,
  name          text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    bigint NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE categories (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  image_url        text,
  image_alt        text NOT NULL DEFAULT '',
  image_credit     text,
  image_credit_url text,
  position         integer NOT NULL DEFAULT 0,
  active           boolean NOT NULL DEFAULT true
);

CREATE TABLE products (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  details     text[] NOT NULL DEFAULT '{}',
  category_id bigint NOT NULL REFERENCES categories (id),
  active      boolean NOT NULL DEFAULT true,
  featured    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_category_idx ON products (category_id);

CREATE TABLE product_images (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  url         text NOT NULL,
  alt         text NOT NULL DEFAULT '',
  credit_name text,
  credit_url  text,
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX product_images_product_idx ON product_images (product_id, position);

CREATE TABLE variants (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id  bigint NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  sku         text NOT NULL UNIQUE,
  name        text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents > 0),
  stock       integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
  active      boolean NOT NULL DEFAULT true,
  position    integer NOT NULL DEFAULT 0
);
CREATE INDEX variants_product_idx ON variants (product_id, position);

CREATE TABLE carts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    bigint UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_items (
  cart_id    uuid NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
  variant_id bigint NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  quantity   integer NOT NULL CHECK (quantity > 0),
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, variant_id)
);

CREATE TABLE orders (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          bigint NOT NULL REFERENCES users (id),
  idempotency_key  uuid NOT NULL,
  status           text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status   text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  payment_method   text NOT NULL DEFAULT 'pay_on_delivery',
  subtotal_cents   integer NOT NULL CHECK (subtotal_cents >= 0),
  shipping_cents   integer NOT NULL CHECK (shipping_cents >= 0),
  total_cents      integer NOT NULL CHECK (total_cents >= 0),
  ship_name        text NOT NULL,
  ship_line1       text NOT NULL,
  ship_line2       text NOT NULL DEFAULT '',
  ship_city        text NOT NULL,
  ship_region      text NOT NULL DEFAULT '',
  ship_postal      text NOT NULL,
  ship_country     text NOT NULL,
  ship_phone       text NOT NULL,
  notes            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status);

CREATE TABLE order_items (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  variant_id       bigint REFERENCES variants (id) ON DELETE SET NULL,
  product_id       bigint REFERENCES products (id) ON DELETE SET NULL,
  product_name     text NOT NULL,
  variant_name     text NOT NULL,
  sku              text NOT NULL,
  image_url        text,
  unit_price_cents integer NOT NULL CHECK (unit_price_cents > 0),
  quantity         integer NOT NULL CHECK (quantity > 0),
  line_total_cents integer NOT NULL CHECK (line_total_cents > 0)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
