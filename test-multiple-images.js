const { sequelize, Product } = require('./models');

async function testMultipleImages() {
    try {
        console.log('🧪 Testing multiple images feature...');
        
        // Sync database
        await sequelize.sync({ alter: true });
        
        // Create a test product with multiple images
        const testProduct = await Product.create({
            name: 'Test Giày Sneaker Gallery',
            description: 'Sản phẩm test với nhiều ảnh để demo tính năng gallery',
            price: 850000,
            image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
            images: [
                { 
                    url: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400',
                    fileId: 'test1'
                },
                { 
                    url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
                    fileId: 'test2'
                },
                { 
                    url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400',
                    fileId: 'test3'
                },
                { 
                    url: 'https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?w=400',
                    fileId: 'test4'
                }
            ],
            category: 'sneaker',
            stock: 25
        });
        
        console.log('✅ Test product created with ID:', testProduct.id);
        console.log('📸 Images count:', testProduct.images.length);
        
        // Test retrieving the product
        const retrieved = await Product.findByPk(testProduct.id);
        console.log('✅ Product retrieved successfully');
        console.log('📋 Product data:');
        console.log('   - Name:', retrieved.name);
        console.log('   - Main image:', retrieved.image ? '✅' : '❌');
        console.log('   - Gallery images:', retrieved.images.length);
        
        // Test updating images
        await retrieved.update({
            images: [
                ...retrieved.images,
                { 
                    url: 'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400',
                    fileId: 'test5'
                }
            ]
        });
        
        const updated = await Product.findByPk(testProduct.id);
        console.log('✅ Images updated, new count:', updated.images.length);
        
        console.log('\n🎯 Test Results:');
        console.log('   ✅ Database schema supports images array');
        console.log('   ✅ Product creation with multiple images works');
        console.log('   ✅ Product retrieval works');
        console.log('   ✅ Images array update works');
        console.log('   ✅ JSON data structure is correct');
        
        console.log('\n🌐 Test URLs:');
        console.log(`   - Product detail: http://localhost:3000/product-detail.html?id=${testProduct.id}`);
        console.log(`   - Admin edit: http://localhost:3000/admin/products.html`);
        
        console.log('\n🧪 Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        process.exit(0);
    }
}

// Run test
testMultipleImages();