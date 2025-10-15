const express = require('express');
const multer = require('multer');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // clave en .env
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer para imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const fname = Date.now() + '-' + Math.round(Math.random() * 1E8) + ext;
    cb(null, fname);
  }
});
const upload = multer({
  storage,
  limits: { files: 4, fileSize: 4*1024*1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Solo imágenes permitidas'));
    cb(null, true);
  }
});

function loadDB() {
  if (!fs.existsSync('data.json')) fs.writeFileSync('data.json', '[]');
  return JSON.parse(fs.readFileSync('data.json', 'utf8'));
}
function saveDB(data) {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
}

// Obtener productos
app.get('/api/products', (req, res) => {
  res.json(loadDB());
});

// Subir producto
app.post('/api/products', upload.array('images', 4), (req, res) => {
  try {
    const { name, description, category, price } = req.body;
    if (!req.files?.length || !name || !description || !category || !price)
      return res.status(400).json({ error: "Todos los campos son obligatorios." });
    if (isNaN(Number(price)) || Number(price) < 0)
      return res.status(400).json({ error: "Precio inválido." });

    const images = req.files.map(f => '/uploads/' + f.filename);
    const newProd = {
      id: Date.now().toString() + Math.round(Math.random()*1e6),
      name, description, category,
      price: Number(price),
      images
    };
    const db = loadDB();
    db.unshift(newProd);
    saveDB(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Error en el servidor: " + (err.message || err) });
  }
});


// Stripe checkout
app.post('/api/checkout', async (req, res) => {
  const { product } = req.body;
  if (!product || !product.price) return res.status(400).json({ error: 'Producto inválido' });

  const amount = Math.round(product.price * 100 * 1.05); // comisión del 5%

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'http://localhost:3000?success=true',
      cancel_url: 'http://localhost:3000?cancel=true',
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Carpeta uploads
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.listen(PORT, () => console.log('FuturShop en http://localhost:' + PORT));