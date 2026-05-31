const { Op } = require('sequelize');
const { prisma, ensureDatabaseSchema, checkDatabaseConnection } = require('../lib/db');

const READ_ONLY_FIELDS = new Set(['id', 'createdAt', 'updatedAt']);

const MODEL_SCHEMAS = {
    User: {
        delegate: 'user',
        scalarFields: ['id', 'name', 'email', 'password', 'phone', 'address', 'googleId', 'role', 'emailVerified', 'otpCode', 'otpExpiry', 'createdAt', 'updatedAt']
    },
    Product: {
        delegate: 'product',
        scalarFields: ['id', 'name', 'description', 'price', 'image', 'images', 'category', 'stock', 'sold', 'sizes', 'colors', 'createdAt', 'updatedAt']
    },
    DiscountCode: {
        delegate: 'discountCode',
        scalarFields: ['id', 'code', 'percentage', 'validFrom', 'validTo', 'active', 'minOrderValue', 'maxDiscount', 'usageLimit', 'usedCount', 'type', 'assignedUserId', 'displayOnHomepage', 'notifyUsers', 'createdAt', 'updatedAt']
    },
    Order: {
        delegate: 'order',
        scalarFields: ['id', 'status', 'total', 'discount', 'shippingAddress', 'shippingName', 'shippingPhone', 'notes', 'discountCode', 'isRead', 'returnStatus', 'returnReason', 'createdAt', 'updatedAt', 'UserId']
    },
    OrderItem: {
        delegate: 'orderItem',
        scalarFields: ['id', 'quantity', 'price', 'productName', 'productImage', 'size', 'color', 'createdAt', 'updatedAt', 'OrderId', 'ProductId']
    },
    Cart: {
        delegate: 'cart',
        scalarFields: ['id', 'quantity', 'size', 'color', 'createdAt', 'updatedAt', 'UserId', 'ProductId']
    },
    ProductDiscount: {
        delegate: 'productDiscount',
        scalarFields: ['id', 'createdAt', 'updatedAt', 'ProductId', 'DiscountCodeId']
    },
    PushSubscription: {
        delegate: 'pushSubscription',
        scalarFields: ['id', 'userId', 'endpoint', 'p256dh', 'auth', 'userAgent', 'role', 'createdAt', 'updatedAt']
    },
    FlashSale: {
        delegate: 'flashSale',
        scalarFields: ['id', 'name', 'startTime', 'endTime', 'isActive', 'createdAt', 'updatedAt']
    },
    FlashSaleItem: {
        delegate: 'flashSaleItem',
        scalarFields: ['id', 'discountPrice', 'quantity', 'sold', 'createdAt', 'updatedAt', 'FlashSaleId', 'ProductId']
    },
    MarketingConfig: {
        delegate: 'marketingConfig',
        scalarFields: ['id', 'key', 'campaignsEnabled', 'campaigns', 'luckySpinEnabled', 'luckySpinPopupEnabled', 'luckySpinPopupDelay', 'luckySpinTitle', 'luckySpinDescription', 'luckySpinRewards', 'popupAdsEnabled', 'popupAdsDelay', 'popupAds', 'createdAt', 'updatedAt']
    },
    Review: {
        delegate: 'review',
        scalarFields: ['id', 'rating', 'comment', 'likes', 'dislikes', 'createdAt', 'updatedAt', 'UserId', 'ProductId']
    },
    ReviewVote: {
        delegate: 'reviewVote',
        scalarFields: ['id', 'vote', 'createdAt', 'updatedAt', 'UserId', 'ReviewId']
    },
    BlogPost: {
        delegate: 'blogPost',
        scalarFields: ['id', 'title', 'slug', 'content', 'excerpt', 'thumbnail', 'category', 'published', 'views', 'createdAt', 'updatedAt', 'UserId']
    }
};

const RELATIONS = {
    User: {
        assignedDiscounts: { target: 'DiscountCode', many: true },
        BlogPosts: { target: 'BlogPost', many: true },
        Carts: { target: 'Cart', many: true },
        Orders: { target: 'Order', many: true },
        PushSubscriptions: { target: 'PushSubscription', many: true },
        Reviews: { target: 'Review', many: true },
        ReviewVotes: { target: 'ReviewVote', many: true }
    },
    Product: {
        Carts: { target: 'Cart', many: true },
        DiscountCodes: { target: 'DiscountCode', many: true, special: 'productDiscountJoin' },
        FlashSaleItems: { target: 'FlashSaleItem', many: true },
        OrderItems: { target: 'OrderItem', many: true },
        ProductDiscounts: { target: 'ProductDiscount', many: true },
        Reviews: { target: 'Review', many: true }
    },
    DiscountCode: {
        assignedUser: { target: 'User', many: false },
        ProductDiscounts: { target: 'ProductDiscount', many: true },
        Products: { target: 'Product', many: true, special: 'discountProductJoin' }
    },
    Order: {
        OrderItems: { target: 'OrderItem', many: true },
        User: { target: 'User', many: false }
    },
    OrderItem: {
        Order: { target: 'Order', many: false },
        Product: { target: 'Product', many: false }
    },
    Cart: {
        Product: { target: 'Product', many: false },
        User: { target: 'User', many: false }
    },
    ProductDiscount: {
        DiscountCode: { target: 'DiscountCode', many: false },
        Product: { target: 'Product', many: false }
    },
    PushSubscription: {
        User: { target: 'User', many: false }
    },
    FlashSale: {
        FlashSaleItems: { target: 'FlashSaleItem', many: true }
    },
    FlashSaleItem: {
        FlashSale: { target: 'FlashSale', many: false },
        Product: { target: 'Product', many: false }
    },
    MarketingConfig: {},
    Review: {
        Product: { target: 'Product', many: false },
        ReviewVotes: { target: 'ReviewVote', many: true },
        User: { target: 'User', many: false }
    },
    ReviewVote: {
        Review: { target: 'Review', many: false },
        User: { target: 'User', many: false }
    },
    BlogPost: {
        User: { target: 'User', many: false }
    }
};

function clonePlain(value) {
    return structuredClone(value);
}

function isDateField(field) {
    return field === 'validFrom' ||
        field === 'validTo' ||
        field === 'otpExpiry' ||
        field.endsWith('At') ||
        field.endsWith('Time');
}

function isBooleanField(field) {
    return field.startsWith('is') ||
        [
            'active',
            'published',
            'emailVerified',
            'displayOnHomepage',
            'notifyUsers',
            'campaignsEnabled',
            'luckySpinEnabled',
            'luckySpinPopupEnabled',
            'popupAdsEnabled'
        ].includes(field);
}

function coerceFieldValue(field, value) {
    if (value === undefined || value === null) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => coerceFieldValue(field, item));
    }

    if (typeof value === 'string') {
        if ((field === 'id' || field.endsWith('Id')) && value.trim() !== '' && !Number.isNaN(Number(value))) {
            return Number(value);
        }

        if (isBooleanField(field)) {
            if (value === 'true') return true;
            if (value === 'false') return false;
        }

        if (isDateField(field) && value.trim() !== '') {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
    }

    return value;
}

function translateLikePattern(pattern) {
    if (typeof pattern !== 'string') {
        return { equals: pattern };
    }

    const startsWithWildcard = pattern.startsWith('%');
    const endsWithWildcard = pattern.endsWith('%');
    const stripped = pattern.replace(/^%+|%+$/g, '');

    if (startsWithWildcard && endsWithWildcard) {
        return { contains: stripped };
    }

    if (startsWithWildcard) {
        return { endsWith: stripped };
    }

    if (endsWithWildcard) {
        return { startsWith: stripped };
    }

    return { equals: pattern };
}

function translateWhere(modelName, where = {}) {
    if (!where || typeof where !== 'object') {
        return undefined;
    }

    const translated = {};

    for (const [field, rawValue] of Object.entries(where)) {
        if (rawValue === undefined) {
            continue;
        }

        if (Array.isArray(rawValue)) {
            translated[field] = { in: rawValue.map(value => coerceFieldValue(field, value)) };
            continue;
        }

        if (rawValue instanceof Date || rawValue === null || typeof rawValue !== 'object') {
            translated[field] = coerceFieldValue(field, rawValue);
            continue;
        }

        const operatorEntries = Reflect.ownKeys(rawValue)
            .filter(key => typeof key === 'symbol')
            .map(key => [key, rawValue[key]]);

        if (operatorEntries.length === 0) {
            translated[field] = coerceFieldValue(field, rawValue);
            continue;
        }

        const filter = {};
        for (const [operator, value] of operatorEntries) {
            if (operator === Op.like || operator === Op.iLike) {
                Object.assign(filter, translateLikePattern(value));
                continue;
            }
            if (operator === Op.gte) {
                filter.gte = coerceFieldValue(field, value);
                continue;
            }
            if (operator === Op.lte) {
                filter.lte = coerceFieldValue(field, value);
                continue;
            }
            if (operator === Op.gt) {
                filter.gt = coerceFieldValue(field, value);
                continue;
            }
            if (operator === Op.lt) {
                filter.lt = coerceFieldValue(field, value);
                continue;
            }
            if (operator === Op.ne || operator === Op.not) {
                filter.not = coerceFieldValue(field, value);
                continue;
            }
            if (operator === Op.in) {
                filter.in = Array.isArray(value) ? value.map(item => coerceFieldValue(field, item)) : [coerceFieldValue(field, value)];
            }
        }

        translated[field] = filter;
    }

    return Object.keys(translated).length ? translated : undefined;
}

function translateOrder(order) {
    if (!order) {
        return undefined;
    }

    const clauses = Array.isArray(order[0]) ? order : [order];
    const orderBy = clauses
        .filter(clause => Array.isArray(clause) && clause[0])
        .map(([field, direction]) => ({
            [field]: String(direction || 'ASC').toLowerCase() === 'desc' ? 'desc' : 'asc'
        }));

    return orderBy.length ? orderBy : undefined;
}

function getModelName(modelRef) {
    if (!modelRef) return null;
    if (typeof modelRef === 'string') return modelRef;
    if (modelRef.modelName) return modelRef.modelName;
    if (modelRef.name) return modelRef.name;
    return null;
}

function resolveRelationAlias(sourceModel, targetModel, explicitAlias) {
    if (explicitAlias) {
        return explicitAlias;
    }

    const relations = RELATIONS[sourceModel] || {};
    for (const [alias, config] of Object.entries(relations)) {
        if (config.target === targetModel) {
            return alias;
        }
    }

    return targetModel;
}

function normalizeIncludeItem(sourceModel, item) {
    if (!item) return null;

    const targetModel = getModelName(item.model || item);
    if (!targetModel) return null;

    const alias = resolveRelationAlias(sourceModel, targetModel, item.as);
    const relation = (RELATIONS[sourceModel] || {})[alias];
    if (!relation) return null;

    return {
        alias,
        targetModel,
        relation,
        include: Array.isArray(item.include) ? item.include : [],
        attributes: Array.isArray(item.attributes) ? item.attributes : null,
        where: item.where,
        required: item.required
    };
}

function buildPrismaInclude(modelName, includeItems = []) {
    const normalized = includeItems
        .map(item => normalizeIncludeItem(modelName, item))
        .filter(Boolean);

    if (!normalized.length) {
        return undefined;
    }

    const include = {};

    for (const item of normalized) {
        if (item.relation.special === 'productDiscountJoin') {
            const nestedInclude = buildPrismaInclude('DiscountCode', item.include);
            include.ProductDiscounts = {
                ...(item.where ? { where: { DiscountCode: translateWhere('DiscountCode', item.where) } } : {}),
                include: {
                    DiscountCode: nestedInclude ? { include: nestedInclude } : true
                }
            };
            continue;
        }

        if (item.relation.special === 'discountProductJoin') {
            const nestedInclude = buildPrismaInclude('Product', item.include);
            include.ProductDiscounts = {
                ...(item.where ? { where: { Product: translateWhere('Product', item.where) } } : {}),
                include: {
                    Product: nestedInclude ? { include: nestedInclude } : true
                }
            };
            continue;
        }

        const nestedInclude = buildPrismaInclude(item.targetModel, item.include);

        if (item.relation.many) {
            if (!item.where && !nestedInclude) {
                include[item.alias] = true;
            } else {
                include[item.alias] = {
                    ...(item.where ? { where: translateWhere(item.targetModel, item.where) } : {}),
                    ...(nestedInclude ? { include: nestedInclude } : {})
                };
            }
            continue;
        }

        include[item.alias] = nestedInclude ? { include: nestedInclude } : true;
    }

    return Object.keys(include).length ? include : undefined;
}

function shouldUseGroupedDistinct(options = {}) {
    return Array.isArray(options.group) &&
        options.group.length === 1 &&
        Array.isArray(options.attributes) &&
        options.attributes.length === 1 &&
        options.group[0] === options.attributes[0];
}

function toPlain(value) {
    if (value === null || value === undefined) {
        return value;
    }

    if (value instanceof Date) {
        return new Date(value);
    }

    if (Array.isArray(value)) {
        return value.map(item => toPlain(item));
    }

    if (value instanceof CompatRecord) {
        const plain = {};
        for (const key of Object.keys(value)) {
            plain[key] = toPlain(value[key]);
        }
        return plain;
    }

    if (typeof value === 'object') {
        const plain = {};
        for (const [key, item] of Object.entries(value)) {
            plain[key] = toPlain(item);
        }
        return plain;
    }

    return value;
}

function areEqual(left, right) {
    const normalize = value => JSON.stringify(toPlain(value), (_, current) => (
        current instanceof Date ? current.toISOString() : current
    ));

    return normalize(left) === normalize(right);
}

function resolveIncludedValue(modelName, record, item) {
    if (item.relation.special === 'productDiscountJoin') {
        const joins = Array.isArray(record.ProductDiscounts) ? record.ProductDiscounts : [];
        return joins.map(join => join.DiscountCode).filter(Boolean);
    }

    if (item.relation.special === 'discountProductJoin') {
        const joins = Array.isArray(record.ProductDiscounts) ? record.ProductDiscounts : [];
        return joins.map(join => join.Product).filter(Boolean);
    }

    if (Object.prototype.hasOwnProperty.call(record, item.alias)) {
        return record[item.alias];
    }

    return item.relation.many ? [] : null;
}

function shapeRecord(modelName, record, options = {}) {
    if (!record) {
        return record;
    }

    const output = { ...record };
    const normalizedIncludes = (options.include || [])
        .map(item => normalizeIncludeItem(modelName, item))
        .filter(Boolean);
    const includedAliases = new Set();

    for (const item of normalizedIncludes) {
        includedAliases.add(item.alias);
        const relationValue = resolveIncludedValue(modelName, output, item);

        if (Array.isArray(relationValue)) {
            output[item.alias] = relationValue.map(entry => shapeRecord(item.targetModel, entry, {
                include: item.include,
                attributes: item.attributes
            }));
        } else {
            output[item.alias] = relationValue ? shapeRecord(item.targetModel, relationValue, {
                include: item.include,
                attributes: item.attributes
            }) : relationValue;
        }
    }

    if (modelName === 'Product' && !includedAliases.has('ProductDiscounts')) {
        delete output.ProductDiscounts;
    }

    if (modelName === 'DiscountCode' && !includedAliases.has('ProductDiscounts')) {
        delete output.ProductDiscounts;
    }

    if (Array.isArray(options.attributes) && options.attributes.length > 0) {
        const pruned = {};
        for (const attribute of options.attributes) {
            if (Object.prototype.hasOwnProperty.call(output, attribute)) {
                pruned[attribute] = output[attribute];
            }
        }
        for (const alias of includedAliases) {
            if (Object.prototype.hasOwnProperty.call(output, alias)) {
                pruned[alias] = output[alias];
            }
        }
        return pruned;
    }

    return output;
}

function preserveLoadedRelations(modelName, previousData, nextData) {
    const relations = RELATIONS[modelName] || {};
    const merged = { ...nextData };

    for (const alias of Object.keys(relations)) {
        if (Object.prototype.hasOwnProperty.call(previousData, alias) && !Object.prototype.hasOwnProperty.call(merged, alias)) {
            merged[alias] = previousData[alias];
        }
    }

    return merged;
}

function assignRecordData(instance, modelName, data) {
    for (const key of Object.keys(instance)) {
        delete instance[key];
    }

    const relations = RELATIONS[modelName] || {};
    for (const [key, value] of Object.entries(data)) {
        const relation = relations[key];
        if (relation) {
            if (relation.many) {
                instance[key] = Array.isArray(value)
                    ? value.map(entry => hydrateRecord(relation.target, entry))
                    : [];
            } else {
                instance[key] = value ? hydrateRecord(relation.target, value) : value;
            }
            continue;
        }

        instance[key] = value;
    }

    instance.__originalData = clonePlain(toPlain(data));
}

class CompatRecord {
    constructor(modelName, data) {
        Object.defineProperty(this, '__modelName', {
            value: modelName,
            enumerable: false,
            writable: false
        });
        Object.defineProperty(this, '__originalData', {
            value: {},
            enumerable: false,
            writable: true
        });

        assignRecordData(this, modelName, data);
    }

    toJSON() {
        return toPlain(this);
    }

    async update(values) {
        const schema = MODEL_SCHEMAS[this.__modelName];
        const delegate = prisma[schema.delegate];
        const data = normalizeWriteData(this.__modelName, values);
        const previous = this.toJSON();

        await ensureDatabaseSchema();
        const updated = await delegate.update({
            where: { id: Number(this.id) },
            data
        });

        assignRecordData(
            this,
            this.__modelName,
            preserveLoadedRelations(this.__modelName, previous, shapeRecord(this.__modelName, updated))
        );
        return this;
    }

    async destroy() {
        const schema = MODEL_SCHEMAS[this.__modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        await delegate.delete({ where: { id: Number(this.id) } });
    }

    async save() {
        const schema = MODEL_SCHEMAS[this.__modelName];
        const current = toPlain(this);
        const diff = {};

        for (const field of schema.scalarFields) {
            if (READ_ONLY_FIELDS.has(field)) {
                continue;
            }

            if (!areEqual(current[field], this.__originalData[field])) {
                diff[field] = current[field];
            }
        }

        if (!Object.keys(diff).length) {
            return this;
        }

        return this.update(diff);
    }

    async increment(field, amount = 1) {
        const schema = MODEL_SCHEMAS[this.__modelName];
        const delegate = prisma[schema.delegate];
        const previous = this.toJSON();

        await ensureDatabaseSchema();
        const updated = await delegate.update({
            where: { id: Number(this.id) },
            data: {
                [field]: { increment: amount }
            }
        });

        assignRecordData(
            this,
            this.__modelName,
            preserveLoadedRelations(this.__modelName, previous, shapeRecord(this.__modelName, updated))
        );
        return this;
    }

    async setProducts(products = []) {
        if (this.__modelName !== 'DiscountCode') {
            throw new Error('setProducts is only supported on DiscountCode records');
        }

        const productIds = products
            .map(product => Number(product.id))
            .filter(id => Number.isInteger(id));

        await ensureDatabaseSchema();
        await prisma.productDiscount.deleteMany({
            where: { DiscountCodeId: Number(this.id) }
        });

        for (const productId of productIds) {
            await prisma.productDiscount.create({
                data: {
                    DiscountCodeId: Number(this.id),
                    ProductId: productId
                }
            });
        }

        return this;
    }
}

function hydrateRecord(modelName, data) {
    if (data === null || data === undefined) {
        return data;
    }
    return new CompatRecord(modelName, data);
}

function normalizeWriteData(modelName, payload = {}) {
    const schema = MODEL_SCHEMAS[modelName];
    const data = {};

    for (const [field, value] of Object.entries(payload)) {
        if (!schema.scalarFields.includes(field)) {
            continue;
        }
        if (READ_ONLY_FIELDS.has(field)) {
            continue;
        }
        if (value === undefined) {
            continue;
        }
        data[field] = coerceFieldValue(field, value);
    }

    return data;
}

function buildBaseQuery(modelName, options = {}) {
    const query = {};
    const where = translateWhere(modelName, options.where);
    const include = buildPrismaInclude(modelName, options.include);
    const orderBy = translateOrder(options.order);
    const limit = options.limit !== undefined ? Number(options.limit) : undefined;
    const offset = options.offset !== undefined ? Number(options.offset) : undefined;

    if (where) query.where = where;
    if (include) query.include = include;
    if (orderBy) query.orderBy = orderBy;
    if (Number.isFinite(limit)) query.take = limit;
    if (Number.isFinite(offset) && offset > 0) query.skip = offset;

    return query;
}

class CompatModel {
    constructor(modelName) {
        this.modelName = modelName;
    }

    async findAll(options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();

        if (shouldUseGroupedDistinct(options)) {
            const field = options.group[0];
            const rows = await delegate.findMany({
                ...(translateWhere(this.modelName, options.where) ? { where: translateWhere(this.modelName, options.where) } : {}),
                distinct: [field],
                select: { [field]: true }
            });
            return rows.map(row => hydrateRecord(this.modelName, row));
        }

        const rows = await delegate.findMany(buildBaseQuery(this.modelName, options));
        return rows.map(row => hydrateRecord(this.modelName, shapeRecord(this.modelName, row, options)));
    }

    async findOne(options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        const row = await delegate.findFirst(buildBaseQuery(this.modelName, options));
        return row ? hydrateRecord(this.modelName, shapeRecord(this.modelName, row, options)) : null;
    }

    async findByPk(id, options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];
        const numericId = Number(id);

        if (!Number.isInteger(numericId)) {
            return null;
        }

        await ensureDatabaseSchema();
        const row = await delegate.findUnique({
            where: { id: numericId },
            include: buildPrismaInclude(this.modelName, options.include)
        });

        return row ? hydrateRecord(this.modelName, shapeRecord(this.modelName, row, options)) : null;
    }

    async create(values) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        const row = await delegate.create({
            data: normalizeWriteData(this.modelName, values)
        });

        return hydrateRecord(this.modelName, shapeRecord(this.modelName, row));
    }

    async bulkCreate(values = []) {
        const records = [];
        for (const value of values) {
            records.push(await this.create(value));
        }
        return records;
    }

    async count(options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        return delegate.count({
            ...(translateWhere(this.modelName, options.where) ? { where: translateWhere(this.modelName, options.where) } : {})
        });
    }

    async update(values, options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        const result = await delegate.updateMany({
            data: normalizeWriteData(this.modelName, values),
            ...(translateWhere(this.modelName, options.where) ? { where: translateWhere(this.modelName, options.where) } : {})
        });

        return result.count;
    }

    async destroy(options = {}) {
        const schema = MODEL_SCHEMAS[this.modelName];
        const delegate = prisma[schema.delegate];

        await ensureDatabaseSchema();
        const result = await delegate.deleteMany({
            ...(translateWhere(this.modelName, options.where) ? { where: translateWhere(this.modelName, options.where) } : {})
        });

        return result.count;
    }

    async findAndCountAll(options = {}) {
        const rows = await this.findAll(options);
        const count = await this.count({ where: options.where });
        return { rows, count };
    }
}

const sequelize = {
    async authenticate() {
        await checkDatabaseConnection();
    },
    async sync() {
        await ensureDatabaseSchema();
    },
    async close() {
        await prisma.$disconnect();
    }
};

const User = new CompatModel('User');
const Product = new CompatModel('Product');
const DiscountCode = new CompatModel('DiscountCode');
const Order = new CompatModel('Order');
const OrderItem = new CompatModel('OrderItem');
const Cart = new CompatModel('Cart');
const ProductDiscount = new CompatModel('ProductDiscount');
const PushSubscription = new CompatModel('PushSubscription');
const FlashSale = new CompatModel('FlashSale');
const FlashSaleItem = new CompatModel('FlashSaleItem');
const MarketingConfig = new CompatModel('MarketingConfig');
const Review = new CompatModel('Review');
const ReviewVote = new CompatModel('ReviewVote');
const BlogPost = new CompatModel('BlogPost');

module.exports = {
    sequelize,
    User,
    Product,
    DiscountCode,
    Order,
    OrderItem,
    Cart,
    ProductDiscount,
    PushSubscription,
    FlashSale,
    FlashSaleItem,
    MarketingConfig,
    Review,
    ReviewVote,
    BlogPost
};
