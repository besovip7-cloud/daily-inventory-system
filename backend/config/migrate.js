const pool = require('./database');

const createTables = async () => {
  try {
    console.log('🔄 Running migrations...');

    // Branches
    await pool.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        location VARCHAR(200),
        manager_name VARCHAR(100),
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Users (managers & staff)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'manager' CHECK (role IN ('admin', 'manager', 'staff')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inventory Items (master list per branch)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS inventory_items (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) CHECK (category IN ('raw', 'packaging', 'beverages', 'cleaning')),
        unit VARCHAR(20) NOT NULL,
        min_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        current_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        cost_per_unit DECIMAL(10,2) DEFAULT 0,
        barcode VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily Inventory Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_inventory (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
        record_date DATE NOT NULL,
        opening_qty DECIMAL(10,2) NOT NULL DEFAULT 0,
        received_qty DECIMAL(10,2) DEFAULT 0,
        consumed_qty DECIMAL(10,2) DEFAULT 0,
        closing_qty DECIMAL(10,2) NOT NULL,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, item_id, record_date)
      )
    `);

    // Menu Items (for sales tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50),
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Daily Sales Records
    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_sales (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
        record_date DATE NOT NULL,
        quantity_sold INTEGER NOT NULL DEFAULT 0,
        total_revenue DECIMAL(10,2) DEFAULT 0,
        payment_card DECIMAL(10,2) DEFAULT 0,
        payment_cash DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(branch_id, item_id, record_date)
      )
    `);

    // Alerts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
        alert_type VARCHAR(20) CHECK (alert_type IN ('critical', 'warning', 'info')),
        title VARCHAR(200) NOT NULL,
        message TEXT,
        is_resolved BOOLEAN DEFAULT FALSE,
        resolved_by INTEGER REFERENCES users(id),
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Activity Logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        branch_id INTEGER REFERENCES branches(id),
        action VARCHAR(50) NOT NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default branches
    await pool.query(`
      INSERT INTO branches (name, location, manager_name) VALUES
      ('فرع الرياض', 'الطريق الرئيسي', 'أحمد العلي'),
      ('فرع جدة', 'شارع التحلية', 'خالد السعيد'),
      ('فرع الدمام', 'الخليج', 'فهد الحربي'),
      ('فرع أبها', 'الفيصلية', 'سعد القحطاني')
      ON CONFLICT DO NOTHING
    `);

    // Insert default admin
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('Admin', 'admin@system.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING
    `, [hashedPassword]);

    console.log('✅ All tables created successfully!');
    console.log('✅ 4 branches seeded');
    console.log('✅ Default admin created: admin@system.com / admin123');

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    pool.end();
  }
};

createTables();
