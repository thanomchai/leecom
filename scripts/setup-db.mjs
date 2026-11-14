import mysql from "mysql2/promise";

const host = process.env.DB_HOST ?? "127.0.0.1";
const port = Number(process.env.DB_PORT ?? 3307);
const user = process.env.DB_USER ?? "root";
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME ?? "leecom";

if (password === undefined) {
  throw new Error("Set DB_PASSWORD in .env.local before setting up the database.");
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DB_PORT must be a valid TCP port.");
}
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}

const products = [
  {
    slug: "leecom-creator-mini",
    name: "LeeCom Creator Mini PC",
    category: "คอมพิวเตอร์",
    description:
      "คอมพิวเตอร์ขนาดกะทัดรัดสำหรับงานประจำวันและงานสร้างสรรค์ พร้อมหน่วยความจำ 16GB และ SSD 512GB",
    price: 16900,
    stock: 8,
    image: "/products/mini-pc.svg",
  },
  {
    slug: "leecom-gaming-starter",
    name: "LeeCom Gaming Starter",
    category: "คอมพิวเตอร์",
    description:
      "คอมพิวเตอร์ตั้งโต๊ะสำหรับเริ่มต้นเล่นเกมและทำงาน มาพร้อมเคสระบายอากาศดีและอัปเกรดได้",
    price: 24900,
    stock: 5,
    image: "/products/gaming-pc.svg",
  },
  {
    slug: "geforce-rtx-4060",
    name: "GeForce RTX 4060 8GB",
    category: "การ์ดจอ",
    description:
      "การ์ดจอประสิทธิภาพสูงสำหรับเล่นเกมและงานกราฟิก รองรับการสร้างสรรค์คอนเทนต์ได้อย่างลื่นไหล",
    price: 10900,
    stock: 7,
    image: "/products/graphics-card.svg",
  },
  {
    slug: "leecom-vision-27",
    name: "LeeCom Vision 27 QHD",
    category: "จอภาพ",
    description:
      "จอภาพขนาด 27 นิ้ว ความละเอียด QHD สีสันคมชัด เหมาะกับทั้งทำงาน เรียน และความบันเทิง",
    price: 7990,
    stock: 11,
    image: "/products/monitor.svg",
  },
  {
    slug: "leecom-mech-keyboard",
    name: "LeeCom Mech Keyboard",
    category: "อุปกรณ์เสริม",
    description:
      "คีย์บอร์ด Mechanical สัมผัสการพิมพ์ชัดเจน มีไฟแบ็กไลต์ และจัดวางโต๊ะทำงานได้อย่างลงตัว",
    price: 2290,
    stock: 16,
    image: "/products/keyboard.svg",
  },
  {
    slug: "leecom-wireless-mouse",
    name: "LeeCom Air Wireless Mouse",
    category: "อุปกรณ์เสริม",
    description:
      "เมาส์ไร้สายดีไซน์จับถนัดมือ เชื่อมต่อง่ายและตอบสนองแม่นยำสำหรับทุกวันทำงาน",
    price: 890,
    stock: 0,
    image: "/products/mouse.svg",
  },
];

const connection = await mysql.createConnection({
  host,
  port,
  user,
  password,
  charset: "utf8mb4",
});

try {
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\`
     CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${database}\``);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(254) NOT NULL,
      password_hash VARCHAR(255) NULL,
      role ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY users_email_unique (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [userColumns] = await connection.query(
    "SHOW COLUMNS FROM users LIKE 'password_hash'",
  );
  if (userColumns[0]?.Null === "NO") {
    await connection.query(
      "ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL",
    );
  }
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      token_hash CHAR(64) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY sessions_token_hash_unique (token_hash),
      KEY sessions_expiration_index (expires_at),
      KEY sessions_user_fk (user_id),
      CONSTRAINT sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_subject VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY oauth_accounts_provider_subject_unique (provider, provider_subject),
      UNIQUE KEY oauth_accounts_user_provider_unique (user_id, provider),
      CONSTRAINT oauth_accounts_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS products (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(120) NOT NULL,
      name VARCHAR(160) NOT NULL,
      category VARCHAR(80) NOT NULL,
      description TEXT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      stock INT UNSIGNED NOT NULL DEFAULT 0,
      image VARCHAR(255) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      archived_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY products_slug_unique (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS carts (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT carts_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      user_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, product_id),
      KEY cart_items_product_id_idx (product_id),
      CONSTRAINT cart_items_user_fk
        FOREIGN KEY (user_id) REFERENCES carts (user_id) ON DELETE CASCADE,
      CONSTRAINT cart_items_product_fk
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(40) NOT NULL,
      idempotency_key CHAR(36) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      recipient_name VARCHAR(160) NOT NULL,
      recipient_phone VARCHAR(20) NOT NULL,
      shipping_address TEXT NOT NULL,
      subtotal DECIMAL(22, 2) NOT NULL,
      shipping_fee DECIMAL(22, 2) NOT NULL DEFAULT 0,
      total DECIMAL(22, 2) NOT NULL,
      status ENUM('awaiting_payment', 'pending_review', 'paid') NOT NULL
        DEFAULT 'awaiting_payment',
      paid_at DATETIME(3) NULL,
      payment_provider ENUM('manual', 'stripe') NOT NULL DEFAULT 'manual',
      stripe_checkout_session_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      stripe_payment_intent_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
      stripe_checkout_attempt INT UNSIGNED NOT NULL DEFAULT 0,
      payment_slip_filename VARCHAR(41) NULL,
      transferred_at DATETIME NULL,
      transfer_amount DECIMAL(10, 2) NULL,
      payment_review_note TEXT NULL,
      payment_reviewed_by BIGINT UNSIGNED NULL,
      payment_reviewed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY orders_order_number_unique (order_number),
      UNIQUE KEY orders_idempotency_unique (idempotency_key),
      UNIQUE KEY orders_stripe_checkout_session_unique (stripe_checkout_session_id),
      UNIQUE KEY orders_stripe_payment_intent_unique (stripe_payment_intent_id),
      KEY orders_user_created_at_idx (user_id, created_at),
      KEY orders_payment_reviewed_by_index (payment_reviewed_by),
      CONSTRAINT orders_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
      CONSTRAINT orders_payment_reviewed_by_fk
        FOREIGN KEY (payment_reviewed_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const stripeOrderColumns = [
    [
      "paid_at",
      "ALTER TABLE orders ADD COLUMN paid_at DATETIME(3) NULL AFTER status",
    ],
    [
      "payment_provider",
      "ALTER TABLE orders ADD COLUMN payment_provider ENUM('manual', 'stripe') NOT NULL DEFAULT 'manual' AFTER status",
    ],
    [
      "stripe_checkout_session_id",
      "ALTER TABLE orders ADD COLUMN stripe_checkout_session_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER payment_provider",
    ],
    [
      "stripe_payment_intent_id",
      "ALTER TABLE orders ADD COLUMN stripe_payment_intent_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER stripe_checkout_session_id",
    ],
    [
      "stripe_checkout_attempt",
      "ALTER TABLE orders ADD COLUMN stripe_checkout_attempt INT UNSIGNED NOT NULL DEFAULT 0 AFTER stripe_payment_intent_id",
    ],
  ];
  for (const [columnName, alterStatement] of stripeOrderColumns) {
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM orders LIKE ?",
      [columnName],
    );
    if (columns.length === 0) {
      await connection.query(alterStatement);
    }
  }
  await connection.query(`
    UPDATE orders
    SET paid_at = payment_reviewed_at
    WHERE status = 'paid' AND payment_provider = 'manual'
      AND paid_at IS NULL AND payment_reviewed_at IS NOT NULL
  `);

  const stripeOrderIndexes = [
    ["orders_stripe_checkout_session_unique", "stripe_checkout_session_id"],
    ["orders_stripe_payment_intent_unique", "stripe_payment_intent_id"],
  ];
  for (const [indexName, columnName] of stripeOrderIndexes) {
    const [indexes] = await connection.query(
      "SHOW INDEX FROM orders WHERE Key_name = ?",
      [indexName],
    );
    if (indexes.length === 0) {
      await connection.query(
        `ALTER TABLE orders ADD UNIQUE KEY \`${indexName}\` (\`${columnName}\`)`,
      );
    }
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS stripe_webhook_events (
      event_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS payment_reviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT UNSIGNED NOT NULL,
      order_number VARCHAR(40) NOT NULL,
      decision ENUM('approved', 'rejected') NOT NULL,
      reviewer_id BIGINT UNSIGNED NULL,
      reviewer_name VARCHAR(80) NOT NULL,
      reviewer_email VARCHAR(254) NOT NULL,
      reviewed_at DATETIME(3) NOT NULL,
      note TEXT NULL,
      KEY payment_reviews_order_reviewed_idx (order_id, reviewed_at),
      KEY payment_reviews_reviewed_at_idx (reviewed_at),
      CONSTRAINT payment_reviews_order_fk
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE RESTRICT,
      CONSTRAINT payment_reviews_reviewer_fk
        FOREIGN KEY (reviewer_id) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await connection.query(`
    INSERT INTO payment_reviews (
      order_id, order_number, decision, reviewer_id, reviewer_name,
      reviewer_email, reviewed_at, note
    )
    SELECT o.id, o.order_number,
           CASE WHEN o.status = 'paid' THEN 'approved' ELSE 'rejected' END,
           o.payment_reviewed_by,
           COALESCE(u.name, 'ผู้ดูแลเดิม'),
           COALESCE(u.email, ''),
           o.payment_reviewed_at,
           o.payment_review_note
    FROM orders o
    LEFT JOIN users u ON u.id = o.payment_reviewed_by
    WHERE o.payment_reviewed_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM payment_reviews pr WHERE pr.order_id = o.id
      )
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      order_id BIGINT UNSIGNED NOT NULL,
      product_id BIGINT UNSIGNED NOT NULL,
      product_name VARCHAR(160) NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      line_total DECIMAL(22, 2) NOT NULL,
      KEY order_items_order_id_idx (order_id),
      KEY order_items_product_id_idx (product_id),
      CONSTRAINT order_items_order_fk
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
      CONSTRAINT order_items_product_fk
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [orderItemSlugColumns] = await connection.query(
    "SHOW COLUMNS FROM order_items LIKE 'product_slug'",
  );
  if (orderItemSlugColumns.length === 0) {
    await connection.query(
      "ALTER TABLE order_items ADD COLUMN product_slug VARCHAR(120) NOT NULL DEFAULT '' AFTER product_id",
    );
  }
  await connection.query(`
    UPDATE order_items oi
    INNER JOIN products p ON p.id = oi.product_id
    SET oi.product_slug = p.slug
    WHERE oi.product_slug = ''
  `);

  for (const product of products) {
    await connection.execute(
       `INSERT IGNORE INTO products
        (slug, name, category, description, price, stock, image)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        product.slug,
        product.name,
        product.category,
        product.description,
        product.price,
        product.stock,
        product.image,
      ],
    );
  }

  console.log(`Database "${database}" is ready with ${products.length} demo products.`);
} finally {
  await connection.end();
}
