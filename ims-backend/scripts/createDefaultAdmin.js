const { sequelize } = require('../config/db');
const User = require('../models/user');

async function createDefaultAdmin() {
  try {
    // Connect to database
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Check if admin user already exists
    const existingAdmin = await User.findOne({
      where: { user_username: 'admin' }
    });

    if (existingAdmin) {
      console.log('Admin user already exists!');
      console.log('Username:', existingAdmin.user_username);
      console.log('Name:', existingAdmin.user_name);
      console.log('Role:', existingAdmin.user_type);
      process.exit(0);
      return;
    }

    // Create default SuperAdmin user
    const adminUser = await User.create({
      user_name: 'Admin',
      user_username: 'admin',
      user_password: 'asdf@112', // Will be hashed by the model hook
      user_email: 'admin@alusoft.com',
      user_type: 'SuperAdmin',
      user_status: 1
    });

    console.log('✅ Default SuperAdmin user created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Username: admin');
    console.log('   Password: asdf@112');
    console.log('   Email:    admin@alusoft.com');
    console.log('   Name:     Admin');
    console.log('   Role:     SuperAdmin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  Please change the default password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createDefaultAdmin();
