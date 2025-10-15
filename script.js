// Elementos DOM principales
const sections = {
  principal: document.getElementById('principal'),
  categorias: document.getElementById('categorias'),
  about: document.getElementById('about'),
  contact: document.getElementById('contact'),
  'add-product': document.getElementById('add-product'),
  carrito: document.getElementById('carrito'),
};
const productsList = document.getElementById('products-list');
const categoryProducts = document.getElementById('category-products');
const cartList = document.getElementById('cart-list');
const cartCount = document.getElementById('cart-count');
const cartTotal = document.getElementById('cart-total');
const payOptions = document.getElementById('pay-options');
const bizumInfo = document.getElementById('bizum-info');
const cardInfo = document.getElementById('card-info');
const formMsg = document.getElementById('form-msg');

let products = [];
let cart = JSON.parse(localStorage.getItem('futurshop-cart')) || [];

// Navegación entre secciones
function showSection(id) {
  for (const key in sections) {
    sections[key].classList.toggle('shown', key === id);
    sections[key].classList.toggle('hidden', key !== id);
  }
  if (id === 'principal') loadProducts();
  if (id === 'categorias') loadProducts(true);
  if (id === 'carrito') renderCart();
}

// Cargar productos
async function loadProducts(forCategory = false) {
  try {
    const res = await fetch('/api/products');
    products = await res.json();
    renderProducts(forCategory ? categoryProducts : productsList, products);
  } catch {
    (forCategory ? categoryProducts : productsList).innerHTML = "<div style='color:red'>Error cargando productos</div>";
  }
}

// Renderizar productos
function renderProducts(container, prodList) {
  container.innerHTML = '';
  if (!prodList.length) {
    container.innerHTML = `<div style="color:var(--danger);font-weight:600;">No hay productos para mostrar.</div>`;
    return;
  }
  prodList.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
      <img src="${prod.images && prod.images[0] ? prod.images[0] : 'https://placehold.co/240x240?text=No+Img'}" alt="${prod.name}">
      <div class="category-tag">${getCatEmoji(prod.category)} ${capitalize(prod.category)}</div>
      <h3>${escapeHTML(prod.name)}</h3>
      <p>${escapeHTML(prod.description)}</p>
      <div class="price">${parseFloat(prod.price).toFixed(2)} €</div>
      <div class="product-btns">
        <button onclick="addToCart('${prod.id}')">Añadir</button>
        <button onclick="buyNow('${prod.id}')">Comprar</button>
      </div>
    `;
    container.appendChild(div);
  });
}

// Filtro por categoría
function filterCategory(cat) {
  if (cat === 'all') {
    renderProducts(categoryProducts, products);
  } else {
    renderProducts(
      categoryProducts,
      products.filter(p => p.category === cat)
    );
  }
}

// Carrito
function addToCart(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;
  cart.push(prod);
  localStorage.setItem('futurshop-cart', JSON.stringify(cart));
  updateCartCount();
  showAlert('Añadido al carrito', 'success');
}
async function buyNow(id) {
  const prod = products.find(p => p.id === id);
  if (!prod) return;

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: prod })
    });
    const result = await res.json();
    if (result.url) {
      window.location.href = result.url;
    } else {
      showAlert('Error al iniciar pago', 'danger');
    }
  } catch {
    showAlert('Error de red al pagar', 'danger');
  }
}
function renderCart() {
  cart = JSON.parse(localStorage.getItem('futurshop-cart')) || [];
  cartList.innerHTML = '';
  if (cart.length === 0) {
    cartList.innerHTML = '<li>Tu carrito está vacío.</li>';
    cartTotal.textContent = '';
    payOptions.classList.add('hidden');
    return;
  }
  cart.forEach((prod, i) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <img src="${prod.images && prod.images[0] ? prod.images[0] : 'https://placehold.co/80x80?text=No+Img'}" alt="">
      <div>
        <h3>${escapeHTML(prod.name)}</h3>
        <p>${escapeHTML(prod.description)}</p>
      </div>
      <div class="price">${parseFloat(prod.price).toFixed(2)} €</div>
      <button onclick="removeFromCart(${i})">✕</button>
    `;
    cartList.appendChild(li);
  });
  const total = cart.reduce((sum, p) => sum + Number(p.price), 0);
  cartTotal.textContent = `Total: ${total.toFixed(2)} €`;
  payOptions.classList.remove('hidden');
  bizumInfo.classList.add('hidden');
  cardInfo.classList.add('hidden');
}
function removeFromCart(idx) {
  cart.splice(idx, 1);
  localStorage.setItem('futurshop-cart', JSON.stringify(cart));
  renderCart();
  updateCartCount();
}
function updateCartCount() {
  cartCount.textContent = cart && cart.length ? cart.length : 0;
}

// Métodos de pago
function showBizum() {
  bizumInfo.classList.remove('hidden');
  cardInfo.classList.add('hidden');
}
function showCard() {
  cardInfo.classList.remove('hidden');
  bizumInfo.classList.add('hidden');
}

// Añadir producto
document.getElementById('product-form').onsubmit = async function (e) {
  e.preventDefault();
  formMsg.textContent = '';
  const form = e.target;
  const data = new FormData(form);

  // Validaciones extra
  if (!data.get('name') || !data.get('category') || !data.get('description') || !data.get('price')) {
    formMsg.textContent = '¡Todos los campos son obligatorios!';
    return;
  }
  const files = form.images.files;
  if (!files.length || files.length > 4) {
    formMsg.textContent = 'Debes subir de 1 a 4 imágenes.';
    return;
  }
  for (let i = 0; i < files.length; i++) {
    if (!files[i].type.startsWith('image/')) {
      formMsg.textContent = 'Solo imágenes permitidas.';
      return;
    }
  }
  try {
    formMsg.textContent = 'Subiendo...';
    const res = await fetch('/api/products', {
      method: 'POST',
      body: data
    });
    const result = await res.json();
    if (res.ok) {
      formMsg.style.color = 'var(--success)';
      formMsg.textContent = '¡Producto subido!';
      setTimeout(() => {
        form.reset();
        showSection('principal');
        loadProducts();
        formMsg.textContent = '';
        formMsg.style.color = '';
      }, 1300);
    } else {
      formMsg.style.color = 'var(--danger)';
      formMsg.textContent = result.error || 'Error en el servidor.';
    }
  } catch (err) {
    formMsg.style.color = 'var(--danger)';
    formMsg.textContent = 'Error de red al subir.';
  }
};

function showAlert(msg, type = 'success') {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.position = 'fixed';
  el.style.top = '20px';
  el.style.right = '18px';
  el.style.padding = '1.1em 2.2em';
  el.style.fontWeight = 'bold';
  el.style.borderRadius = '1.3em';
  el.style.zIndex = 9999;
  el.style.fontSize = '1.08em';
  el.style.color = '#222';
  el.style.background = type === 'success'
    ? 'linear-gradient(90deg, var(--success), var(--primary))'
    : 'linear-gradient(90deg, var(--danger), var(--secondary))';
  document.body.appendChild(el);
  setTimeout(() => { el.remove(); }, 1700);
}

// Utilidades
function getCatEmoji(cat) {
  return cat === 'ropa' ? '👕'
    : cat === 'airpods' ? '🎧'
    : cat === 'tecnologia' ? '💻'
    : '✨';
}
function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
function escapeHTML(str) {
  return (str || '').replace(/[<>"'&]/g, m => ({
    '<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'
  })[m]);
}

// Inicialización
window.onload = () => {
  showSection('principal');
  updateCartCount();
  loadProducts();
};