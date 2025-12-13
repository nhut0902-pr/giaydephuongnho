const { sequelize, Product } = require('./models');

async function migrateImages() {
    try {
        console.log('Starting image migration...');
        
        // Sync database to add new images column
        await sequelize.sync({ alter: true });
        console.log('Database synced successfully');
        
        // Get all products that don't have images array but have image
        const products = await Product.findAll({
            where: {
                images: null,
                image: { [require('sequelize').Op.ne]: null }
            }
        });
        
        console.log(`Found ${products.length} products to migrate`);
        
        // Update each product to move single image to images array
        for (const product of products) {
            if (product.image) {
                await product.update({
                    images: [{ url: product.image, fileId: null }]
                });
                console.log(`Migrated product: ${product.name}`);
            }
        }
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateImages();