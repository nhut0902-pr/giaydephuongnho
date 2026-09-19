const { createClient } = require('@libsql/client/web');
const { PrismaLibSQL } = require('@prisma/adapter-libsql/web');
const { PrismaClient } = require('@prisma/client');

const DEFAULT_LOCAL_DATABASE_URL = 'file:./prisma/dev.db';

function splitCombinedLibsqlValue(value) {
    if (typeof value !== 'string') {
        return { url: '', authToken: '' };
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith('libsql://') || !trimmed.includes(',')) {
        return { url: trimmed, authToken: '' };
    }

    const separatorIndex = trimmed.indexOf(',');
    return {
        url: trimmed.slice(0, separatorIndex),
        authToken: trimmed.slice(separatorIndex + 1)
    };
}

function isSupportedLibsqlUrl(value) {
    return typeof value === 'string' && (
        value.startsWith('libsql://') ||
        value.startsWith('https://') ||
        value.startsWith('http://') ||
        value.startsWith('file:')
    );
}

function resolveDatabaseConfig() {
    const explicitUrl = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL || '';
    const explicitToken = process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN || '';
    const legacyUrl = process.env.DATABASE_URL || '';
    const legacyToken = process.env.DATABASE_AUTH_TOKEN || process.env.DATABASE_TOKEN || '';

    const preferred = splitCombinedLibsqlValue(explicitUrl);
    if (isSupportedLibsqlUrl(preferred.url)) {
        return {
            url: preferred.url,
            authToken: explicitToken || preferred.authToken || legacyToken || undefined
        };
    }

    const legacy = splitCombinedLibsqlValue(legacyUrl);
    if (isSupportedLibsqlUrl(legacy.url)) {
        return {
            url: legacy.url,
            authToken: explicitToken || legacy.authToken || legacyToken || undefined
        };
    }

    return { url: DEFAULT_LOCAL_DATABASE_URL };
}

let _databaseConfig = null;
let _libsqlClient = null;
let _prisma = null;

function initDb() {
    if (_prisma) return;
    _databaseConfig = resolveDatabaseConfig();
    
    // In Cloudflare Workers environment, file: URLs are not supported by the web client.
    // During Cloudflare deploy validation/dry-run, env bindings might be empty.
    // Fallback to a dummy remote URL to pass validation without crashing.
    if (!_databaseConfig.url || _databaseConfig.url.startsWith('file:')) {
        const isCloudflare = typeof globalThis.WebSocket !== 'undefined' || process.env.CF_PAGES === '1';
        if (isCloudflare) {
            _databaseConfig = {
                url: 'libsql://dummy-db-validation.turso.io'
            };
        }
    }

    _libsqlClient = createClient(_databaseConfig);
    const prismaAdapter = new PrismaLibSQL(_databaseConfig);
    _prisma = new PrismaClient({ adapter: prismaAdapter });
}

const databaseConfig = new Proxy({}, {
    get(target, prop) {
        initDb();
        return _databaseConfig[prop];
    }
});

const libsqlClient = new Proxy({}, {
    get(target, prop) {
        initDb();
        const value = _libsqlClient[prop];
        if (typeof value === 'function') {
            return value.bind(_libsqlClient);
        }
        return value;
    }
});

const prisma = new Proxy({}, {
    get(target, prop) {
        initDb();
        const value = _prisma[prop];
        if (typeof value === 'function') {
            return value.bind(_prisma);
        }
        return value;
    }
});

const bootstrapStatements = [
    'PRAGMA foreign_keys = ON',
    `CREATE TABLE IF NOT EXISTS "GDNUsers" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "phone" TEXT,
        "address" TEXT,
        "googleId" TEXT,
        "role" TEXT NOT NULL DEFAULT 'customer',
        "emailVerified" INTEGER NOT NULL DEFAULT 0,
        "otpCode" TEXT,
        "otpExpiry" DATETIME,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNProducts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "price" REAL NOT NULL,
        "image" TEXT,
        "images" TEXT DEFAULT '[]',
        "category" TEXT,
        "stock" INTEGER NOT NULL DEFAULT 0,
        "sold" INTEGER NOT NULL DEFAULT 0,
        "sizes" TEXT DEFAULT '[]',
        "colors" TEXT DEFAULT '[]',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNDiscountCodes" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "code" TEXT NOT NULL UNIQUE,
        "percentage" REAL NOT NULL,
        "validFrom" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "validTo" DATETIME,
        "active" INTEGER NOT NULL DEFAULT 1,
        "minOrderValue" REAL NOT NULL DEFAULT 0,
        "maxDiscount" REAL,
        "usageLimit" INTEGER,
        "usedCount" INTEGER NOT NULL DEFAULT 0,
        "type" TEXT NOT NULL DEFAULT 'public',
        "assignedUserId" INTEGER,
        "displayOnHomepage" INTEGER NOT NULL DEFAULT 0,
        "notifyUsers" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("assignedUserId") REFERENCES "GDNUsers" ("id") ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNOrders" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "total" REAL NOT NULL,
        "discount" REAL NOT NULL DEFAULT 0,
        "shippingAddress" TEXT,
        "shippingName" TEXT,
        "shippingPhone" TEXT,
        "notes" TEXT,
        "discountCode" TEXT,
        "isRead" INTEGER NOT NULL DEFAULT 0,
        "returnStatus" TEXT NOT NULL DEFAULT 'none',
        "returnReason" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UserId" INTEGER,
        FOREIGN KEY ("UserId") REFERENCES "GDNUsers" ("id") ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNOrderItems" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "quantity" INTEGER NOT NULL,
        "price" REAL NOT NULL,
        "productName" TEXT,
        "productImage" TEXT,
        "size" TEXT,
        "color" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "OrderId" INTEGER NOT NULL,
        "ProductId" INTEGER NOT NULL,
        FOREIGN KEY ("OrderId") REFERENCES "GDNOrders" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("ProductId") REFERENCES "GDNProducts" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNCarts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "quantity" INTEGER NOT NULL DEFAULT 1,
        "size" TEXT,
        "color" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UserId" INTEGER NOT NULL,
        "ProductId" INTEGER NOT NULL,
        FOREIGN KEY ("UserId") REFERENCES "GDNUsers" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("ProductId") REFERENCES "GDNProducts" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNProductDiscounts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ProductId" INTEGER NOT NULL,
        "DiscountCodeId" INTEGER NOT NULL,
        FOREIGN KEY ("ProductId") REFERENCES "GDNProducts" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("DiscountCodeId") REFERENCES "GDNDiscountCodes" ("id") ON DELETE CASCADE,
        UNIQUE ("ProductId", "DiscountCodeId")
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNPushSubscriptions" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "userId" INTEGER,
        "endpoint" TEXT NOT NULL UNIQUE,
        "p256dh" TEXT NOT NULL,
        "auth" TEXT NOT NULL,
        "userAgent" TEXT,
        "role" TEXT NOT NULL DEFAULT 'customer',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "GDNUsers" ("id") ON DELETE SET NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNFlashSales" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL DEFAULT 'Flash Sale',
        "startTime" DATETIME NOT NULL,
        "endTime" DATETIME NOT NULL,
        "isActive" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNFlashSaleItems" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "discountPrice" REAL NOT NULL,
        "quantity" INTEGER NOT NULL DEFAULT 10,
        "sold" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "FlashSaleId" INTEGER NOT NULL,
        "ProductId" INTEGER NOT NULL,
        FOREIGN KEY ("FlashSaleId") REFERENCES "GDNFlashSales" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("ProductId") REFERENCES "GDNProducts" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNMarketingConfigs" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "key" TEXT NOT NULL UNIQUE DEFAULT 'homepage',
        "campaignsEnabled" INTEGER NOT NULL DEFAULT 1,
        "campaigns" TEXT DEFAULT '[]',
        "luckySpinEnabled" INTEGER NOT NULL DEFAULT 1,
        "luckySpinPopupEnabled" INTEGER NOT NULL DEFAULT 1,
        "luckySpinPopupDelay" INTEGER NOT NULL DEFAULT 2200,
        "luckySpinTitle" TEXT NOT NULL DEFAULT 'Vong Quay May Man 2026',
        "luckySpinDescription" TEXT NOT NULL DEFAULT 'Moi khach hang duoc quay 1 lan moi ngay de nhan voucher.',
        "luckySpinRewards" TEXT DEFAULT '[]',
        "popupAdsEnabled" INTEGER NOT NULL DEFAULT 0,
        "popupAdsDelay" INTEGER NOT NULL DEFAULT 1800,
        "popupAds" TEXT DEFAULT '[]',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNReviews" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "rating" INTEGER NOT NULL,
        "comment" TEXT,
        "likes" INTEGER NOT NULL DEFAULT 0,
        "dislikes" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UserId" INTEGER NOT NULL,
        "ProductId" INTEGER NOT NULL,
        FOREIGN KEY ("UserId") REFERENCES "GDNUsers" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("ProductId") REFERENCES "GDNProducts" ("id") ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNReviewVotes" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "vote" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UserId" INTEGER NOT NULL,
        "ReviewId" INTEGER NOT NULL,
        FOREIGN KEY ("UserId") REFERENCES "GDNUsers" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("ReviewId") REFERENCES "GDNReviews" ("id") ON DELETE CASCADE,
        UNIQUE ("UserId", "ReviewId")
    )`,
    `CREATE TABLE IF NOT EXISTS "GDNBlogPosts" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL UNIQUE,
        "content" TEXT NOT NULL,
        "excerpt" TEXT,
        "thumbnail" TEXT,
        "category" TEXT NOT NULL DEFAULT 'Tin tức',
        "published" INTEGER NOT NULL DEFAULT 0,
        "views" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "UserId" INTEGER NOT NULL,
        FOREIGN KEY ("UserId") REFERENCES "GDNUsers" ("id") ON DELETE CASCADE
    )`,
    'CREATE INDEX IF NOT EXISTS "idx_gdn_products_category" ON "GDNProducts" ("category")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_orders_user" ON "GDNOrders" ("UserId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_orders_status" ON "GDNOrders" ("status")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_orders_isRead" ON "GDNOrders" ("isRead")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_order_items_order" ON "GDNOrderItems" ("OrderId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_order_items_product" ON "GDNOrderItems" ("ProductId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_carts_user" ON "GDNCarts" ("UserId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_carts_product" ON "GDNCarts" ("ProductId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_discount_codes_assigned_user" ON "GDNDiscountCodes" ("assignedUserId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_push_subscriptions_user" ON "GDNPushSubscriptions" ("userId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_push_subscriptions_role" ON "GDNPushSubscriptions" ("role")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_flash_sale_items_sale" ON "GDNFlashSaleItems" ("FlashSaleId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_flash_sale_items_product" ON "GDNFlashSaleItems" ("ProductId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_reviews_product" ON "GDNReviews" ("ProductId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_reviews_user" ON "GDNReviews" ("UserId")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_blog_posts_slug" ON "GDNBlogPosts" ("slug")',
    'CREATE INDEX IF NOT EXISTS "idx_gdn_blog_posts_published" ON "GDNBlogPosts" ("published")'
];

let schemaReadyPromise = null;

async function ensureDatabaseSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = (async () => {
            await libsqlClient.execute('PRAGMA foreign_keys = ON');

            for (const statement of bootstrapStatements) {
                await libsqlClient.execute(statement);
            }
        })().catch(error => {
            schemaReadyPromise = null;
            throw error;
        });
    }

    return schemaReadyPromise;
}

async function checkDatabaseConnection() {
    await ensureDatabaseSchema();
    await libsqlClient.execute('SELECT 1');
}

module.exports = {
    prisma,
    libsqlClient,
    ensureDatabaseSchema,
    checkDatabaseConnection,
    databaseConfig
};
