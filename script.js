// script.js — produtos com múltiplas imagens + variants + CTA "Tenho interesse" (sem carrinho)

let products = [];
let filteredProducts = [];

// (opcional) quando quiser ativar WhatsApp, use esta constante e a função buildWhatsAppUrl
const WHATSAPP_PHONE = "5599999999999"; // DDI+DDD+número, só dígitos (placeholder)

// ---------- Boot ----------
document.addEventListener('DOMContentLoaded', async function () {
  await loadProducts();
  renderProducts();
  setupFilters();
  setupSearch();
});

// ---------- Data ----------
async function loadProducts() {
  try {
    const res = await fetch('data/products.json', { cache: 'no-store' });
    products = await res.json();
    filteredProducts = [...products];
  } catch (e) {
    console.error('Erro ao carregar produtos:', e);
    showNotification('Não foi possível carregar os produtos.');
    products = [];
    filteredProducts = [];
  }
}

// ---------- Render ----------
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';

  filteredProducts.forEach(product => {
    const card = createProductCard(product);
    grid.appendChild(card);
  });
}

function createProductCard(product) {
  const card = document.createElement('div');
  card.className = 'product-card';
  card.onclick = () => openModal(product);

  const coverSrc = (product.images && product.images.length > 0) ? product.images[0] : null;
  const media = coverSrc
    ? `<img src="${coverSrc}" alt="${escapeHtml(product.title)}" loading="lazy">`
    : `<div class="product-emoji-fallback">${(product.title || '🧩').slice(0,1)}</div>`;

  // preço: se tiver variants, mostra "a partir de"
  let priceHtml = '';
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const min = getMinVariantPrice(product);
    const currency = product.variants[0]?.currency || 'BRL';
    priceHtml = `<span class="product-price">a partir de ${formatPrice(min, currency)}</span>`;
  } else {
    const currency = product.currency || 'BRL';
    priceHtml = `<span class="product-price">${formatPrice(product.price || 0, currency)}</span>`;
  }

  card.innerHTML = `
    <div class="product-image">
      ${media}
    </div>
    <div class="product-info">
      <span class="product-category">${getCategoryName(product.category)}</span>
      <h3 class="product-title">${escapeHtml(product.title)}</h3>
      <p class="product-description">${escapeHtml(product.description || '')}</p>
      <div class="product-footer">
        ${priceHtml}
        <button class="add-to-cart" onclick="event.stopPropagation(); openModalByButton(${Number(product.id)})">
          Ver detalhes
        </button>
      </div>
    </div>
  `;

  return card;
}

function openModalByButton(productId) {
  const product = products.find(p => p.id === productId);
  if (product) openModal(product);
}

function getCategoryName(category) {
  const names = {
    'miniaturas': 'Miniaturas',
    'utilitarios': 'Utilitários',
    'decoracao': 'Decoração',
    'jogos': 'Jogos'
  };
  return names[category] || category || 'Outros';
}

// ---------- Preço & Variants ----------
function formatPrice(value, currency = 'BRL', locale = 'pt-BR') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value ?? 0);
  } catch {
    const v = Number(value || 0);
    return `R$ ${v.toFixed(2)}`;
  }
}

function getMinVariantPrice(product) {
  if (!Array.isArray(product.variants) || product.variants.length === 0) return null;
  return product.variants.reduce((min, v) => Math.min(min, Number(v.price || 0)), Infinity);
}

function getVariant(product, index) {
  if (!Array.isArray(product.variants)) return null;
  const i = Number(index);
  return Number.isInteger(i) && i >= 0 && i < product.variants.length ? product.variants[i] : null;
}

// ---------- Filtros ----------
function setupFilters() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  if (!filterButtons.length) return;

  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      // estado ativo
      filterButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      const category = button.dataset.category;
      if (category === 'all') {
        filteredProducts = [...products];
      } else {
        filteredProducts = products.filter(p => p.category === category);
      }

      renderProducts();
    });
  });
}

// ---------- Busca ----------
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', searchProducts);
  }
}

function toggleSearch() {
  const searchSection = document.getElementById('search-section');
  if (!searchSection) return;

  searchSection.classList.toggle('active');

  if (searchSection.classList.contains('active')) {
    const input = document.getElementById('search-input');
    if (input) input.focus();
  }
}

function searchProducts() {
  const input = document.getElementById('search-input');
  const term = (input?.value || '').toLowerCase().trim();

  if (!term) {
    filteredProducts = [...products];
  } else {
    filteredProducts = products.filter(p => {
      const base = [
        p.title || '',
        p.description || '',
        getCategoryName(p.category) || ''
      ].join(' ').toLowerCase();

      const tags = Array.isArray(p.tags) ? p.tags.join(' ').toLowerCase() : '';
      return base.includes(term) || tags.includes(term);
    });
  }

  renderProducts();
}

// ---------- Modal (com galeria e variants, sem carrinho) ----------
function openModal(product) {
  const modal = document.getElementById('product-modal');
  const modalBody = document.getElementById('modal-body');
  if (!modal || !modalBody) return;

  const hasImages = Array.isArray(product.images) && product.images.length > 0;
  const firstImage = hasImages ? product.images[0] : null;

  // imagem principal
  const mainImage = firstImage
    ? `<img id="main-preview" src="${firstImage}" alt="${escapeHtml(product.title)}" class="product-main-image">`
    : `<div style="font-size:6rem; margin-bottom:20px; text-align:center;">🧩</div>`;

  // galeria
  const gallery = hasImages && product.images.length > 1
    ? `
      <div class="product-gallery">
        ${product.images.map((src) => `
          <img src="${src}" alt="${escapeHtml(product.title)}"
               onclick="swapPreview('${src.replace(/'/g, "\\'")}')">
        `).join('')}
      </div>
    `
    : '';

  // Seletor de variação (quando houver)
  let variantSelector = '';
  let initialPriceText = '';
  let initialVariantIndex = 0;

  if (Array.isArray(product.variants) && product.variants.length > 0) {
    const v0 = product.variants[0];
    const currency = v0?.currency || 'BRL';
    initialPriceText = formatPrice(v0?.price || 0, currency);

    variantSelector = `
      <div style="margin: 20px 0;">
        <label for="variant-select" style="display:block; margin-bottom:8px; color:#333; font-weight:600;">
          Escolha a opção:
        </label>
        <select id="variant-select" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px;">
          ${product.variants.map((v, idx) => `
            <option value="${idx}">
              ${escapeHtml(v.name)} — ${formatPrice(v.price || 0, v.currency || 'BRL')}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  } else {
    // Sem variants -> usa product.price/currency se existir
    const currency = product.currency || 'BRL';
    initialPriceText = formatPrice(product.price || 0, currency);
  }

  modalBody.innerHTML = `
    <div style="padding: 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        ${mainImage}
        <span class="product-category">${getCategoryName(product.category)}</span>
        <h2 style="margin: 15px 0; font-size: 2rem;">${escapeHtml(product.title)}</h2>
        <p style="color: #666; font-size: 1.2rem; margin-bottom: 20px;">${escapeHtml(product.description || '')}</p>
        <div id="price-display" style="font-size: 2rem; font-weight: bold; color: #667eea; margin-bottom: 10px;">
          ${initialPriceText}
        </div>
      </div>

      ${variantSelector}
      ${gallery}

      <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 20px 0 30px;">
        <h3 style="margin-bottom: 15px; color: #333;">Detalhes do Produto</h3>
        <p style="color: #666; line-height: 1.6;">${escapeHtml(product.details || '—')}</p>
      </div>

      <div style="text-align: center;">
        <button id="btn-interest"
                style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                       color: white; border: none; padding: 15px 40px;
                       border-radius: 8px; font-size: 1.1rem; font-weight: 600;
                       cursor: pointer; margin-right: 15px;">
          Tenho interesse
        </button>
        <button onclick="closeModal()"
                style="background: transparent; border: 2px solid #ddd;
                       color: #666; padding: 15px 40px; border-radius: 8px;
                       font-size: 1.1rem; cursor: pointer;">
          Fechar
        </button>
      </div>
    </div>
  `;

  // listeners pós-render
  const select = document.getElementById('variant-select');
  const priceDisplay = document.getElementById('price-display');
  const btnInterest = document.getElementById('btn-interest');

  if (select && priceDisplay) {
    select.addEventListener('change', () => {
      const v = getVariant(product, select.value);
      const currency = v?.currency || 'BRL';
      priceDisplay.textContent = formatPrice(v?.price || 0, currency);
    });
  }

  if (btnInterest) {
    btnInterest.addEventListener('click', (e) => {
      let variantIndex = null;
      if (select) variantIndex = Number(select.value);

      // Aqui, por enquanto, só mostramos uma notificação.
      // Depois, você pode trocar por: window.open(buildWhatsAppUrl(product, variantIndex), '_blank');
      const v = getVariant(product, variantIndex);
      const chosen = v ? ` — ${v.name} (${formatPrice(v.price, v.currency || 'BRL')})` : '';
      showNotification(`Interesse registrado: ${product.title}${chosen}`);
      // closeModal(); // se quiser fechar após clicar
    });
  }

  modal.style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function swapPreview(src) {
  const el = document.getElementById('main-preview');
  if (el) el.src = src;
}

function closeModal() {
  const modal = document.getElementById('product-modal');
  if (!modal) return;
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

// (opcional) quando quiser ativar WhatsApp, use esta função:
function buildWhatsAppUrl(product, variantIndex = null) {
  const v = getVariant(product, variantIndex);
  const price = v ? formatPrice(v.price, v.currency || 'BRL') : (product.price ? formatPrice(product.price, product.currency || 'BRL') : '');
  const variantText = v ? `\nOpção: ${v.name}\nPreço: ${price}` : (price ? `\nPreço: ${price}` : '');
  const msg =
    `Olá! Tenho interesse em:\n` +
    `Produto: ${product.title}\n` +
    `Categoria: ${getCategoryName(product.category)}` +
    variantText;
  const encoded = encodeURIComponent(msg);
  return `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;
}

// ---------- Navegação suave ----------
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', function (e) {
    e.preventDefault();
    const targetId = this.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth' });
    }

    // ativa o link atual
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');
  });
});

// ---------- Notificação ----------
function showNotification(message) {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    z-index: 3000;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;

  notification.textContent = message;
  document.body.appendChild(notification);

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ---------- Utils ----------
function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}
