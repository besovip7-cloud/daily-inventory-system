const pool = require('../config/database');

const DEFAULTS = { company_name: 'Saj Alreef Express', company_logo: '' };

const readSettings = async () => {
  const result = await pool.query('SELECT key, value FROM app_settings');
  const settings = { ...DEFAULTS };
  result.rows.forEach(r => { settings[r.key] = r.value; });
  return settings;
};

const getSettings = async (req, res) => {
  try {
    res.json(await readSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { company_name, company_logo } = req.body;

    if (company_name !== undefined) {
      const name = String(company_name).trim().slice(0, 100);
      if (!name) return res.status(400).json({ message: 'اسم الشركة مطلوب' });
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('company_name', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`, [name]
      );
    }

    if (company_logo !== undefined) {
      const logo = String(company_logo || '');
      if (logo && !/^data:image\/(png|jpe?g|webp);base64,/.test(logo)) {
        return res.status(400).json({ message: 'صيغة اللوكو غير مدعومة (PNG أو JPG)' });
      }
      if (logo.length > 1500000) {
        return res.status(400).json({ message: 'حجم اللوكو كبير جداً (الحد الأقصى ~1MB)' });
      }
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('company_logo', $1)
         ON CONFLICT (key) DO UPDATE SET value = $1`, [logo]
      );
    }

    res.json(await readSettings());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getSettings, updateSettings };
