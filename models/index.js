const { Sequelize, DataTypes } = require('sequelize');

// Neon PostgreSQL connection
const sequelize = new Sequelize('postgresql://neondb_owner:npg_QEZkCS8ce9Mg@ep-tiny-star-a1t4r3yf-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require', {
    dialect: 'postgres',
    dialectModule: require('pg'),
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    },
    logging: false
});

// User Model
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING
    },
    address: {
        type: DataTypes.TEXT
    },
    googleId: {
        type: DataTypes.STRING
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'customer'
    }
});

// Product Model
const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING
    },
    images: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    category: {
        type: DataTypes.STRING
    },
    stock: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

// Discount Code Model
const DiscountCode = sequelize.define('DiscountCode', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    percentage: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    validFrom: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    validTo: {
        type: DataTypes.DATE
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    minOrderValue: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    maxDiscount: {
        type: DataTypes.FLOAT
    },
    usageLimit: {
        type: DataTypes.INTEGER
    },
    usedCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    // New fields for user-specific discounts
    type: {
        type: DataTypes.STRING,
        defaultValue: 'public'
    },
    assignedUserId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    displayOnHomepage: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    notifyUsers: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

// Push Subscription Model (for Web Push Notifications)
const PushSubscription = sequelize.define('PushSubscription', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true // null for anonymous users
    },
    endpoint: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    p256dh: {
        type: DataTypes.STRING,
        allowNull: false
    },
    auth: {
        type: DataTypes.STRING,
        allowNull: false
    },
    userAgent: {
        type: DataTypes.STRING
    },
    role: {
        type: DataTypes.STRING,
        defaultValue: 'customer'
    }
});

// Order Model
const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled'),
        defaultValue: 'pending'
    },
    total: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    discount: {
        type: DataTypes.FLOAT,
        defaultValue: 0
    },
    shippingAddress: {
        type: DataTypes.TEXT
    },
    shippingName: {
        type: DataTypes.STRING
    },
    shippingPhone: {
        type: DataTypes.STRING
    },
    notes: {
        type: DataTypes.TEXT
    },
    discountCode: {
        type: DataTypes.STRING
    },
    isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

// Order Item Model
const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    productName: {
        type: DataTypes.STRING
    },
    productImage: {
        type: DataTypes.STRING
    }
});

// Cart Model
const Cart = sequelize.define('Cart', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    }
});

// Product Discount Association
const ProductDiscount = sequelize.define('ProductDiscount', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    }
});

// Flash Sale Model
const FlashSale = sequelize.define('FlashSale', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        defaultValue: 'Flash Sale'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: false
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

// Flash Sale Item Model
const FlashSaleItem = sequelize.define('FlashSaleItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    discountPrice: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    sold: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
});

// Associations
User.hasMany(Order);
Order.belongsTo(User);

User.hasMany(Cart);
Cart.belongsTo(User);

Product.hasMany(Cart);
Cart.belongsTo(Product);

Order.hasMany(OrderItem);
OrderItem.belongsTo(Order);

Product.hasMany(OrderItem);
OrderItem.belongsTo(Product);

// Many-to-many: Product <-> DiscountCode
Product.belongsToMany(DiscountCode, { through: ProductDiscount });
DiscountCode.belongsToMany(Product, { through: ProductDiscount });

// User <-> PushSubscription
User.hasMany(PushSubscription);
PushSubscription.belongsTo(User);

// User <-> DiscountCode (for user-specific discounts)
User.hasMany(DiscountCode, { foreignKey: 'assignedUserId', as: 'assignedDiscounts' });
DiscountCode.belongsTo(User, { foreignKey: 'assignedUserId', as: 'assignedUser' });

// Flash Sale Associations
FlashSale.hasMany(FlashSaleItem);
FlashSaleItem.belongsTo(FlashSale);

Product.hasMany(FlashSaleItem);
FlashSaleItem.belongsTo(Product);

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
    FlashSaleItem
};
