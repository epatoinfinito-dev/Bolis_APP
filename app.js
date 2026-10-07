/* ============================================================
   BoliOS — Lógica de negocio (ventas, inventario, gastos, análisis)
   Datos 100% locales (localStorage). Sin servidor.
   ============================================================ */
"use strict";

/* ---------- Estado ---------- */
const LS_KEY = "bolios_v1";
const FLAVOR_COLORS = ["#ff5d8f", "#ffb020", "#8bd346", "#38bdf8", "#a78bfa", "#f472b6", "#fb7185", "#34d399", "#f97316", "#6b5bff"];

const state = {
  products: [],
  sales: [],
  expenses: [],
  settings: { name: "Mi negocio de bolis", currency: "$", goal: 0 },
};

function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      state.products = d.products || [];
      state.sales = d.sales || [];
      state.expenses = d.expenses || [];
      state.settings = Object.assign(state.settings, d.settings || {});
    }
  } catch (e) { console.error("Error cargando datos", e); }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = (n) => `${state.settings.currency}${(Math.round(n * 100) / 100).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const dayKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const todayKey = () => dayKey(new Date());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const TYPE_LABEL = { agua: "De agua", leche: "De leche", especial: "Especial" };

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("#toastZone").appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, 2400);
}

let confirmCb = null;
function confirmDlg(title, text, cb) {
  $("#confirmTitle").textContent = title;
  $("#confirmText").textContent = text;
  confirmCb = cb;
  $("#confirmModal").showModal();
}
$("#confirmYes").addEventListener("click", () => { $("#confirmModal").close(); if (confirmCb) confirmCb(); });
$$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

/* ---------- Animación de entrada escalonada ---------- */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      e.target.style.transitionDelay = `${(e.target.dataset.ri || 0) * 70}ms`;
      e.target.classList.add("in");
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.08 });
function bindReveals(root = document) {
  let i = 0;
  $$(".reveal:not(.in)", root).forEach((el) => { el.dataset.ri = i++ % 6; revealObs.observe(el); });
}

/* ---------- Navegación ---------- */
let chartsBuilt = false;
function goTo(view) {
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));
  window.scrollTo({ top: 0, behavior: "instant" });
  bindReveals();
  if (view === "vender") renderPOS();
  if (view === "productos") renderProducts();
  if (view === "gastos") renderExpenses();
  if (view === "analisis") { renderAnalysis(); }
  if (view === "inicio") renderDashboard();
}
$$(".nav-btn").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.view)));
$$("[data-goto]").forEach((b) => b.addEventListener("click", () => goTo(b.dataset.goto)));

/* ---------- Dashboard ---------- */
function salesOn(key) { return state.sales.filter((s) => dayKey(s.date) === key); }

function renderDashboard() {
  $("#brandName").textContent = state.settings.name || "BoliOS";
  const now = new Date();
  $("#headerDate").textContent = now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const h = now.getHours();
  $("#heroGreeting").textContent = h < 12 ? "¡Buenos días!" : h < 19 ? "¡Buenas tardes!" : "¡Buenas noches!";

  const tSales = salesOn(todayKey());
  const income = tSales.reduce((a, s) => a + s.total, 0);
  const profit = tSales.reduce((a, s) => a + s.profit, 0);
  const units = tSales.reduce((a, s) => a + s.items.reduce((x, i) => x + i.qty, 0), 0);

  $("#statVentasHoy").textContent = money(income);
  $("#statVentasCount").textContent = `${tSales.length} venta${tSales.length === 1 ? "" : "s"} · ${units} bolis`;
  $("#statGananciaHoy").textContent = money(profit);
  const goal = state.settings.goal || 0;
  $("#statMeta").textContent = goal > 0
    ? `Meta diaria: ${money(goal)} · ${Math.min(999, Math.round((income / goal) * 100))}%`
    : "Define tu meta diaria en ajustes";
  $("#statTicket").textContent = money(tSales.length ? income / tSales.length : 0);
  const totalStock = state.products.reduce((a, p) => a + p.stock, 0);
  $("#statStock").textContent = totalStock;
  $("#statStockFoot").textContent = `${state.products.length} producto${state.products.length === 1 ? "" : "s"} activos`;

  $("#heroSummary").textContent = tSales.length
    ? `Hoy llevas ${units} bolis vendidos en ${tSales.length} ventas. Ganancia del día: ${money(profit)}.`
    : "Registra tu primera venta del día para ver tus números moverse.";

  // Alertas de stock
  const low = state.products.filter((p) => p.stock <= (p.minStock ?? 5)).sort((a, b) => a.stock - b.stock);
  $("#lowStockList").innerHTML = low.length
    ? low.slice(0, 6).map((p) => `
      <li>
        <span class="dot ${p.stock === 0 ? "crit" : ""}"></span>
        <span class="grow"><span class="name">${esc(p.name)}</span>
        <span class="sub">${p.stock === 0 ? "Agotado — repón cuanto antes" : `Mínimo: ${p.minStock ?? 5}`}</span></span>
        <span class="qty-pill ${p.stock === 0 ? "crit" : ""}">${p.stock} pzas</span>
      </li>`).join("")
    : `<li><span class="grow" style="color:var(--ink-faint);font-size:13px">Todo el inventario está en niveles sanos.</span></li>`;

  // Top productos (7 días)
  const since = Date.now() - 7 * 864e5;
  const tally = {};
  state.sales.filter((s) => new Date(s.date) >= since).forEach((s) =>
    s.items.forEach((i) => {
      tally[i.productId] = tally[i.productId] || { name: i.name, qty: 0, color: "#2cadfd" };
      tally[i.productId].qty += i.qty;
    }));
  const top = Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxQ = top.length ? top[0].qty : 1;
  $("#topProducts").innerHTML = top.length
    ? top.map((t, idx) => {
        const prod = state.products.find((p) => p.name === t.name);
        return `<li>
          <span class="top-rank">${idx + 1}</span>
          <span class="swatch" style="background:${prod ? prod.color : "#2cadfd"}"></span>
          <span class="grow"><span class="name">${esc(t.name)}</span>
          <span class="top-bar"><i style="width:${(t.qty / maxQ) * 100}%"></i></span></span>
          <span class="units">${t.qty} pzas</span>
        </li>`;
      }).join("")
    : `<li><span class="grow" style="color:var(--ink-faint);font-size:13px">Sin ventas en los últimos 7 días.</span></li>`;

  drawWeekChart();
}

let weekChart = null;
function drawWeekChart() {
  if (typeof Chart === "undefined") return;
  const labels = [], data = [], profits = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    labels.push(d.toLocaleDateString("es-MX", { weekday: "short" }).replace(".", ""));
    const ss = salesOn(dayKey(d));
    data.push(ss.reduce((a, s) => a + s.total, 0));
    profits.push(ss.reduce((a, s) => a + s.profit, 0));
  }
  const ctx = $("#weekChart");
  if (weekChart) weekChart.destroy();
  weekChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Ventas", data, backgroundColor: "rgba(44,173,253,0.85)", borderRadius: 7, barPercentage: 0.62 },
        { label: "Ganancia", data: profits, backgroundColor: "rgba(255,217,13,0.9)", borderRadius: 7, barPercentage: 0.62 },
      ],
    },
    options: chartBase({ stacked: false }),
  });
}

function chartBase(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { font: { family: "Inter", size: 11, weight: 600 }, color: "#4b5064", boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true } },
      tooltip: {
        backgroundColor: "#12141f", titleFont: { family: "Sora", weight: 700 }, bodyFont: { family: "JetBrains Mono", size: 12 },
        padding: 11, cornerRadius: 10, displayColors: false,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y ?? c.parsed)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "Inter", size: 11, weight: 600 }, color: "#7c8296" }, border: { display: false } },
      y: { grid: { color: "rgba(18,20,31,0.07)" }, ticks: { font: { family: "JetBrains Mono", size: 10.5 }, color: "#7c8296", callback: (v) => state.settings.currency + v }, border: { display: false } },
    },
  }, extra);
}

/* ============================================================
   POS — Punto de venta
   ============================================================ */
let cart = [];
let posFilter = { q: "", type: "todos" };
let payMethod = "efectivo";

function renderPOS() {
  // Filtros por tipo
  const types = ["todos", "agua", "leche", "especial"];
  $("#posCats").innerHTML = types.map((t) =>
    `<button class="chip ${posFilter.type === t ? "active" : ""}" data-t="${t}">${t === "todos" ? "Todos" : TYPE_LABEL[t]}</button>`).join("");
  $$("#posCats .chip").forEach((c) => c.addEventListener("click", () => { posFilter.type = c.dataset.t; renderPOS(); }));

  const q = posFilter.q.toLowerCase();
  const list = state.products.filter((p) =>
    (posFilter.type === "todos" || p.type === posFilter.type) &&
    p.name.toLowerCase().includes(q));

  $("#posGrid").innerHTML = list.length
    ? list.map((p) => `
      <button class="pos-item ${p.stock === 0 ? "out" : ""}" data-id="${p.id}" style="--pc:${p.color}">
        <span class="p-name">${esc(p.name)}</span>
        <span class="p-price">${money(p.price)}</span>
        <span class="p-stock ${p.stock === 0 ? "out" : p.stock <= (p.minStock ?? 5) ? "low" : ""}">
          ${p.stock === 0 ? "Agotado" : `${p.stock} en stock`}
        </span>
      </button>`).join("")
    : `<p class="empty-note" style="grid-column:1/-1">${state.products.length ? "Sin resultados para tu búsqueda." : "Aún no tienes productos. Ve a la pestaña Productos y crea el primero."}</p>`;

  $$("#posGrid .pos-item").forEach((b) => b.addEventListener("click", () => addToCart(b.dataset.id)));
  renderCart();
  renderRecentSales();
}

$("#posSearch").addEventListener("input", (e) => { posFilter.q = e.target.value; renderPOS(); });
$$("#payMethod .pay-btn").forEach((b) => b.addEventListener("click", () => {
  payMethod = b.dataset.pay;
  $$("#payMethod .pay-btn").forEach((x) => x.classList.toggle("active", x === b));
}));

function addToCart(id) {
  const p = state.products.find((x) => x.id === id);
  if (!p || p.stock === 0) return;
  const line = cart.find((l) => l.id === id);
  const inCart = line ? line.qty : 0;
  if (inCart + 1 > p.stock) { toast(`Solo quedan ${p.stock} de ${p.name}`); return; }
  if (line) line.qty++;
  else cart.push({ id: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1 });
  renderCart();
}

function changeQty(id, delta) {
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  const p = state.products.find((x) => x.id === id);
  line.qty += delta;
  if (p && line.qty > p.stock) { line.qty = p.stock; toast(`Stock máximo: ${p.stock}`); }
  if (line.qty <= 0) cart = cart.filter((l) => l.id !== id);
  renderCart();
}

function renderCart() {
  const n = cart.reduce((a, l) => a + l.qty, 0);
  const total = cart.reduce((a, l) => a + l.qty * l.price, 0);
  $("#cartCount").textContent = n;
  $("#cartTotal").textContent = money(total);
  $("#confirmSale").disabled = cart.length === 0;
  $("#cartEmpty").classList.toggle("show", cart.length === 0);
  $("#cartItems").innerHTML = cart.map((l) => `
    <li>
      <span class="c-name">${esc(l.name)}</span>
      <span class="qty-ctrl">
        <button data-id="${l.id}" data-d="-1" aria-label="Quitar uno">−</button>
        <span class="q">${l.qty}</span>
        <button data-id="${l.id}" data-d="1" aria-label="Agregar uno">+</button>
      </span>
      <span class="c-sub">${money(l.qty * l.price)}</span>
    </li>`).join("");
  $$("#cartItems .qty-ctrl button").forEach((b) =>
    b.addEventListener("click", () => changeQty(b.dataset.id, Number(b.dataset.d))));
}

$("#confirmSale").addEventListener("click", () => {
  if (!cart.length) return;
  const items = cart.map((l) => ({ productId: l.id, name: l.name, qty: l.qty, price: l.price, cost: l.cost }));
  const total = items.reduce((a, i) => a + i.qty * i.price, 0);
  const cost = items.reduce((a, i) => a + i.qty * i.cost, 0);
  const sale = { id: uid(), date: new Date().toISOString(), items, total, cost, profit: total - cost, pay: payMethod };
  state.sales.push(sale);
  items.forEach((i) => {
    const p = state.products.find((x) => x.id === i.productId);
    if (p) p.stock = Math.max(0, p.stock - i.qty);
  });
  save();
  // Ticket
  $("#ticketItems").innerHTML = items.map((i) =>
    `<li><span>${i.qty} × ${esc(i.name)}</span><span>${money(i.qty * i.price)}</span></li>`).join("");
  $("#ticketTotal").textContent = money(total);
  $("#ticketMeta").textContent = `${payMethod} · ${new Date().toLocaleString("es-MX", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })} · Ganancia ${money(total - cost)}`;
  cart = [];
  renderPOS();
  $("#ticketModal").showModal();
  if (navigator.vibrate) navigator.vibrate(30);
});

function renderRecentSales() {
  const list = salesOn(todayKey()).slice().reverse();
  $("#recentSales").innerHTML = list.length
    ? list.map((s) => `
      <li>
        <span class="grow">
          <span class="name">${s.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(", ")}</span>
          <span class="sub">${new Date(s.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} · ${s.pay}</span>
        </span>
        <span class="li-amount pos">${money(s.total)}</span>
        <button class="li-del" data-id="${s.id}" aria-label="Cancelar venta" title="Cancelar venta (devuelve stock)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </li>`).join("")
    : `<li><span class="grow" style="color:var(--ink-faint);font-size:13px">Todavía no hay ventas hoy.</span></li>`;
  $$("#recentSales .li-del").forEach((b) => b.addEventListener("click", () => {
    confirmDlg("Cancelar esta venta", "El dinero se resta de hoy y el stock regresa al inventario.", () => {
      const s = state.sales.find((x) => x.id === b.dataset.id);
      if (!s) return;
      s.items.forEach((i) => { const p = state.products.find((x) => x.id === i.productId); if (p) p.stock += i.qty; });
      state.sales = state.sales.filter((x) => x.id !== s.id);
      save(); renderPOS(); toast("Venta cancelada");
    });
  }));
}

/* ============================================================
   PRODUCTOS
   ============================================================ */
let selColor = FLAVOR_COLORS[0];

function renderProducts() {
  const ps = state.products;
  const totalUnits = ps.reduce((a, p) => a + p.stock, 0);
  const invValue = ps.reduce((a, p) => a + p.stock * p.cost, 0);
  $("#productsSummary").textContent = `${ps.length} producto${ps.length === 1 ? "" : "s"} · ${totalUnits} bolis en stock · valor del inventario ${money(invValue)}`;

  $("#productsList").innerHTML = ps.length
    ? ps.map((p) => {
        const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
        const low = p.stock === 0 ? "out" : p.stock <= (p.minStock ?? 5) ? "low" : "";
        return `
        <article class="product-card glass reveal">
          <span class="product-swatch" style="background:${p.color}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2.5" width="8" height="12" rx="4"/><path d="M12 14.5V21"/></svg>
          </span>
          <div class="product-info">
            <span class="name">${esc(p.name)}</span>
            <div class="meta">${TYPE_LABEL[p.type] || ""} · ${money(p.price)} · costo ${money(p.cost)} · margen <b>${margin.toFixed(0)}%</b></div>
            <div class="stock-adjust" style="margin-top:7px">
              <button data-adj="-1" data-id="${p.id}" aria-label="Restar stock">−</button>
              <span style="font:700 12px var(--font-mono);color:var(--ink-faint)">stock</span>
              <button data-adj="1" data-id="${p.id}" aria-label="Sumar stock">+</button>
            </div>
          </div>
          <div class="product-side">
            <span class="stock-num ${low}">${p.stock}</span>
            <span class="stock-lbl">${p.stock === 0 ? "agotado" : "en stock"}</span>
            <div class="product-actions">
              <button data-edit="${p.id}" aria-label="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>
              <button class="del" data-del="${p.id}" aria-label="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
            </div>
          </div>
        </article>`;
      }).join("")
    : `<article class="panel glass" style="text-align:center;padding:34px">
         <p class="empty-note" style="font-size:14.5px">Aún no tienes productos.<br>Crea tu primer boli con el botón “Nuevo producto”.</p>
       </article>`;

  $$("#productsList [data-edit]").forEach((b) => b.addEventListener("click", () => openProductModal(b.dataset.edit)));
  $$("#productsList [data-del]").forEach((b) => b.addEventListener("click", () => {
    const p = state.products.find((x) => x.id === b.dataset.del);
    confirmDlg("Eliminar producto", `“${p.name}” se eliminará del catálogo (el historial de ventas se conserva).`, () => {
      state.products = state.products.filter((x) => x.id !== b.dataset.del);
      save(); renderProducts(); toast("Producto eliminado");
    });
  }));
  $$("#productsList [data-adj]").forEach((b) => b.addEventListener("click", () => {
    const p = state.products.find((x) => x.id === b.dataset.id);
    p.stock = Math.max(0, p.stock + Number(b.dataset.adj));
    save(); renderProducts();
  }));
  bindReveals($("#productsList"));
}

function openProductModal(id = null) {
  const p = id ? state.products.find((x) => x.id === id) : null;
  $("#productModalTitle").textContent = p ? "Editar producto" : "Nuevo producto";
  $("#pId").value = p ? p.id : "";
  $("#pName").value = p ? p.name : "";
  $("#pType").value = p ? p.type : "agua";
  $("#pCost").value = p ? p.cost : "";
  $("#pPrice").value = p ? p.price : "";
  $("#pStock").value = p ? p.stock : "";
  $("#pMinStock").value = p ? (p.minStock ?? 5) : 5;
  selColor = p ? p.color : FLAVOR_COLORS[state.products.length % FLAVOR_COLORS.length];
  $("#pColors").innerHTML = FLAVOR_COLORS.map((c) =>
    `<button type="button" class="color-dot ${c === selColor ? "sel" : ""}" data-c="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("");
  $$("#pColors .color-dot").forEach((b) => b.addEventListener("click", () => {
    selColor = b.dataset.c;
    $$("#pColors .color-dot").forEach((x) => x.classList.toggle("sel", x === b));
  }));
  updateMarginHint();
  $("#productModal").showModal();
}
function updateMarginHint() {
  const c = parseFloat($("#pCost").value), p = parseFloat($("#pPrice").value);
  $("#pMarginHint").textContent = (c >= 0 && p > 0 && p >= c)
    ? `Ganancia por boli: ${money(p - c)} · margen ${(((p - c) / p) * 100).toFixed(0)}%`
    : "";
}
$("#pCost").addEventListener("input", updateMarginHint);
$("#pPrice").addEventListener("input", updateMarginHint);
$("#addProductBtn").addEventListener("click", () => openProductModal());

$("#productForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const id = $("#pId").value;
  const data = {
    name: $("#pName").value.trim(),
    type: $("#pType").value,
    cost: Math.max(0, parseFloat($("#pCost").value) || 0),
    price: Math.max(0, parseFloat($("#pPrice").value) || 0),
    stock: Math.max(0, parseInt($("#pStock").value) || 0),
    minStock: Math.max(0, parseInt($("#pMinStock").value) || 0),
    color: selColor,
  };
  if (!data.name) return;
  if (data.price < data.cost) { toast("Ojo: el precio es menor que el costo"); }
  if (id) Object.assign(state.products.find((x) => x.id === id), data);
  else state.products.push(Object.assign({ id: uid(), createdAt: new Date().toISOString() }, data));
  save();
  $("#productModal").close();
  renderProducts();
  toast(id ? "Producto actualizado" : "Producto creado");
});

/* ============================================================
   GASTOS
   ============================================================ */
const EXP_LABEL = { insumos: "Insumos", empaque: "Empaque", servicios: "Servicios", transporte: "Transporte", otros: "Otros" };
let expFilter = "todos";

function renderExpenses() {
  const monthK = todayKey().slice(0, 7);
  const monthTotal = state.expenses.filter((e) => dayKey(e.date).startsWith(monthK)).reduce((a, e) => a + e.amount, 0);
  $("#expenseMonthTotal").textContent = money(monthTotal);

  const cats = ["todos", ...Object.keys(EXP_LABEL)];
  $("#expenseFilter").innerHTML = cats.map((c) =>
    `<button class="chip ${expFilter === c ? "active" : ""}" data-c="${c}">${c === "todos" ? "Todos" : EXP_LABEL[c]}</button>`).join("");
  $$("#expenseFilter .chip").forEach((b) => b.addEventListener("click", () => { expFilter = b.dataset.c; renderExpenses(); }));

  const list = state.expenses
    .filter((e) => expFilter === "todos" || e.category === expFilter)
    .slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60);

  $("#expensesList").innerHTML = list.length
    ? list.map((e) => `
      <li class="glass" style="padding:13px 16px;margin-bottom:9px;border-radius:var(--r-md)">
        <span class="exp-cat">${EXP_LABEL[e.category] || "Otros"}</span>
        <span class="grow">
          <span class="name">${esc(e.note || EXP_LABEL[e.category] || "Gasto")}</span>
          <span class="sub">${new Date(e.date).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
        </span>
        <span class="li-amount neg">−${money(e.amount)}</span>
        <button class="li-del" data-id="${e.id}" aria-label="Eliminar gasto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </li>`).join("")
    : `<li style="border:none"><span class="grow" style="color:var(--ink-faint);font-size:13.5px">Sin gastos registrados${expFilter === "todos" ? "" : " en esta categoría"}.</span></li>`;

  $$("#expensesList .li-del").forEach((b) => b.addEventListener("click", () => {
    confirmDlg("Eliminar gasto", "Este gasto se quitará del registro.", () => {
      state.expenses = state.expenses.filter((x) => x.id !== b.dataset.id);
      save(); renderExpenses(); toast("Gasto eliminado");
    });
  }));
}

$("#addExpenseBtn").addEventListener("click", () => {
  $("#eDate").value = todayKey();
  $("#eAmount").value = ""; $("#eNote").value = "";
  $("#expenseModal").showModal();
});
$("#expenseForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const amount = parseFloat($("#eAmount").value);
  if (!(amount > 0)) return;
  state.expenses.push({
    id: uid(), category: $("#eCategory").value, amount,
    note: $("#eNote").value.trim(),
    date: new Date($("#eDate").value + "T12:00:00").toISOString(),
  });
  save();
  $("#expenseModal").close();
  renderExpenses();
  toast("Gasto registrado");
});

/* ============================================================
   ANÁLISIS Y RENTABILIDAD
   ============================================================ */
let period = "7";
let dailyChart = null, productChart = null;

function periodRange() {
  const now = new Date();
  if (period === "all") return { from: new Date(2000, 0, 1), to: now };
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
  const days = Number(period);
  return { from: new Date(now.getTime() - (days - 1) * 864e5), to: now };
}
const inRange = (d, r) => { const t = new Date(d); return t >= r.from && t <= new Date(r.to.getTime() + 86399999); };

function renderAnalysis() {
  const r = periodRange();
  const sales = state.sales.filter((s) => inRange(s.date, r));
  const expenses = state.expenses.filter((e) => inRange(e.date, r));

  const income = sales.reduce((a, s) => a + s.total, 0);
  const cogs = sales.reduce((a, s) => a + s.cost, 0);
  const gross = income - cogs;
  const expTotal = expenses.reduce((a, e) => a + e.amount, 0);
  const net = gross - expTotal;
  const margin = income > 0 ? (net / income) * 100 : 0;

  $("#kpiIngresos").textContent = money(income);
  $("#kpiCostos").textContent = money(cogs);
  $("#kpiBruta").textContent = money(gross);
  $("#kpiGastos").textContent = money(expTotal);
  const kN = $("#kpiNeta");
  kN.textContent = money(net);
  kN.className = net >= 0 ? "good" : "bad";
  const kM = $("#kpiMargen");
  kM.textContent = `${margin.toFixed(1)}%`;
  kM.className = margin >= 15 ? "good" : margin < 0 ? "bad" : "";

  drawDailyChart(sales, expenses, r);
  drawProductChart(sales);
  renderProfitTable(sales);
  render3DBars(sales);
}

function drawDailyChart(sales, expenses, r) {
  if (typeof Chart === "undefined") return;
  const days = {};
  const cur = new Date(r.from);
  while (cur <= r.to) { days[dayKey(cur)] = { inc: 0, exp: 0 }; cur.setDate(cur.getDate() + 1); }
  sales.forEach((s) => { const k = dayKey(s.date); if (days[k]) days[k].inc += s.total; });
  expenses.forEach((e) => { const k = dayKey(e.date); if (days[k]) days[k].exp += e.amount; });
  const keys = Object.keys(days).sort();
  const labels = keys.map((k) => new Date(k + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" }));
  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart($("#dailyChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Ingresos", data: keys.map((k) => days[k].inc), borderColor: "#2cadfd", backgroundColor: "rgba(44,173,253,0.16)", fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#2cadfd", borderWidth: 2.5 },
        { label: "Gastos", data: keys.map((k) => days[k].exp), borderColor: "#e5484d", backgroundColor: "rgba(229,72,77,0.08)", fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: "#e5484d", borderWidth: 2 },
      ],
    },
    options: chartBase(),
  });
}

function drawProductChart(sales) {
  if (typeof Chart === "undefined") return;
  const tally = {};
  sales.forEach((s) => s.items.forEach((i) => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const colors = entries.map(([name], i) => {
    const p = state.products.find((x) => x.name === name);
    return p ? p.color : FLAVOR_COLORS[i % FLAVOR_COLORS.length];
  });
  if (productChart) productChart.destroy();
  productChart = new Chart($("#productChart"), {
    type: "doughnut",
    data: { labels: entries.map((e) => e[0]), datasets: [{ data: entries.map((e) => e[1]), backgroundColor: colors, borderColor: "rgba(255,255,255,0.7)", borderWidth: 2.5, hoverOffset: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "58%",
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "Inter", size: 11, weight: 600 }, color: "#4b5064", boxWidth: 10, boxHeight: 10, borderRadius: 3, useBorderRadius: true, padding: 14 } },
        tooltip: { backgroundColor: "#12141f", bodyFont: { family: "JetBrains Mono", size: 12 }, padding: 11, cornerRadius: 10, callbacks: { label: (c) => ` ${c.parsed} bolis` } },
      },
    },
  });
}

function renderProfitTable(sales) {
  const tally = {};
  sales.forEach((s) => s.items.forEach((i) => {
    tally[i.name] = tally[i.name] || { qty: 0, inc: 0, cost: 0 };
    tally[i.name].qty += i.qty;
    tally[i.name].inc += i.qty * i.price;
    tally[i.name].cost += i.qty * i.cost;
  }));
  const rows = Object.entries(tally).map(([name, t]) => ({ name, ...t, profit: t.inc - t.cost, margin: t.inc > 0 ? ((t.inc - t.cost) / t.inc) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit);
  $("#profitEmpty").hidden = rows.length > 0;
  $("#profitTable").style.display = rows.length ? "" : "none";
  $("#profitTable tbody").innerHTML = rows.map((r) => {
    const p = state.products.find((x) => x.name === r.name);
    const mCls = r.margin < 0 ? "neg" : r.margin < 25 ? "low" : "";
    return `<tr>
      <td><span class="cell-name"><span class="swatch" style="background:${p ? p.color : "#2cadfd"}"></span>${esc(r.name)}</span></td>
      <td>${r.qty}</td><td>${money(r.inc)}</td><td>${money(r.cost)}</td>
      <td class="${r.profit >= 0 ? "pos" : "neg"}">${money(r.profit)}</td>
      <td><span class="margin-pill ${mCls}">${r.margin.toFixed(0)}%</span></td>
    </tr>`;
  }).join("");
}

/* ---------- Gráfico 3D (Three.js) ---------- */
function render3DBars(sales) {
  if (typeof window.updateSales3D !== "function") return;
  const totals = [0, 0, 0, 0, 0, 0, 0]; // dom..sáb
  sales.forEach((s) => { totals[new Date(s.date).getDay()] += s.total; });
  // Reordenar: lun..dom
  const ordered = [totals[1], totals[2], totals[3], totals[4], totals[5], totals[6], totals[0]];
  window.updateSales3D(ordered, state.settings.currency);
}

/* ============================================================
   RESPALDO / EXPORTAR / IMPORTAR
   ============================================================ */
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

$("#exportJson").addEventListener("click", () => {
  download(`bolios-respaldo-${todayKey()}.json`, JSON.stringify(state, null, 2), "application/json");
  toast("Respaldo descargado");
});

$("#exportCsv").addEventListener("click", () => {
  const rows = [["fecha", "producto", "cantidad", "precio_unitario", "costo_unitario", "total_linea", "ganancia_linea", "metodo_pago"]];
  state.sales.forEach((s) => s.items.forEach((i) =>
    rows.push([s.date, `"${i.name.replace(/"/g, '""')}"`, i.qty, i.price, i.cost, i.qty * i.price, i.qty * (i.price - i.cost), s.pay])));
  download(`bolios-ventas-${todayKey()}.csv`, rows.map((r) => r.join(",")).join("\n"), "text/csv");
  toast("CSV de ventas descargado");
});

$("#importJson").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (!Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("formato inválido");
      confirmDlg("Restaurar respaldo", "Se reemplazarán TODOS los datos actuales con los del archivo.", () => {
        state.products = d.products; state.sales = d.sales;
        state.expenses = d.expenses || [];
        state.settings = Object.assign({ name: "Mi negocio de bolis", currency: "$", goal: 0 }, d.settings || {});
        save(); goTo("inicio"); toast("Respaldo restaurado");
      });
    } catch (err) { toast("Archivo inválido"); }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ============================================================
   AJUSTES
   ============================================================ */
$("#settingsBtn").addEventListener("click", () => {
  $("#sName").value = state.settings.name;
  $("#sCurrency").value = state.settings.currency;
  $("#sGoal").value = state.settings.goal || "";
  $("#settingsModal").showModal();
});
$("#settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings.name = $("#sName").value.trim() || "BoliOS";
  state.settings.currency = $("#sCurrency").value.trim() || "$";
  state.settings.goal = Math.max(0, parseFloat($("#sGoal").value) || 0);
  save();
  $("#settingsModal").close();
  renderDashboard();
  toast("Ajustes guardados");
});
$("#clearData").addEventListener("click", () => {
  confirmDlg("Borrar todos los datos", "Se eliminarán productos, ventas y gastos. Esta acción no se puede deshacer.", () => {
    localStorage.removeItem(LS_KEY);
    state.products = []; state.sales = []; state.expenses = [];
    state.settings = { name: "Mi negocio de bolis", currency: "$", goal: 0 };
    $("#settingsModal").close();
    goTo("inicio");
    toast("Datos eliminados");
  });
});

/* ---------- Datos de ejemplo ---------- */
$("#seedDemo").addEventListener("click", () => {
  confirmDlg("Cargar datos de ejemplo", "Se agregarán productos y 30 días de ventas de prueba (sin borrar lo que ya tengas).", () => {
    seedDemoData();
    $("#settingsModal").close();
    goTo("inicio");
    toast("Datos de ejemplo cargados");
  });
});

function seedDemoData() {
  const demo = [
    ["Boli de fresa con crema", "leche", 6, 12, "#ff5d8f"],
    ["Boli de limón", "agua", 3.5, 8, "#8bd346"],
    ["Boli de mango con chamoy", "agua", 4.5, 10, "#ffb020"],
    ["Boli de coco", "leche", 6, 12, "#fff6e0"],
    ["Boli de uva", "agua", 3.5, 8, "#a78bfa"],
    ["Boli de chocolate", "leche", 7, 14, "#7c4a21"],
    ["Boli de tamarindo", "agua", 4, 9, "#f97316"],
    ["Boli relleno de gomita", "especial", 8, 16, "#38bdf8"],
  ];
  const prods = demo.map(([name, type, cost, price, color]) => ({
    id: uid(), name, type, cost, price, color,
    stock: 15 + Math.floor(Math.random() * 30), minStock: 5,
    createdAt: new Date().toISOString(),
  }));
  state.products.push(...prods);

  for (let d = 29; d >= 0; d--) {
    const date = new Date(Date.now() - d * 864e5);
    const dow = date.getDay();
    const base = dow === 0 || dow === 6 ? 6 : 3; // fines de semana venden más
    const nSales = base + Math.floor(Math.random() * 5);
    for (let s = 0; s < nSales; s++) {
      const items = [];
      const nItems = 1 + Math.floor(Math.random() * 3);
      for (let it = 0; it < nItems; it++) {
        const p = prods[Math.floor(Math.random() * prods.length)];
        const ex = items.find((x) => x.productId === p.id);
        if (ex) ex.qty += 1 + Math.floor(Math.random() * 2);
        else items.push({ productId: p.id, name: p.name, qty: 1 + Math.floor(Math.random() * 2), price: p.price, cost: p.cost });
      }
      const total = items.reduce((a, i) => a + i.qty * i.price, 0);
      const cost = items.reduce((a, i) => a + i.qty * i.cost, 0);
      date.setHours(10 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60));
      state.sales.push({ id: uid(), date: new Date(date).toISOString(), items, total, cost, profit: total - cost, pay: ["efectivo", "efectivo", "tarjeta", "transferencia"][Math.floor(Math.random() * 4)] });
    }
    if (Math.random() < 0.3) {
      const cats = ["insumos", "empaque", "servicios", "transporte"];
      state.expenses.push({
        id: uid(), category: cats[Math.floor(Math.random() * cats.length)],
        amount: 30 + Math.floor(Math.random() * 180),
        note: "", date: new Date(date).toISOString(),
      });
    }
  }
  save();
}

/* ============================================================
   PWA — instalación y service worker
   ============================================================ */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  $("#installBtn").hidden = false;
});
$("#installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $("#installBtn").hidden = true;
});
window.addEventListener("appinstalled", () => { $("#installBtn").hidden = true; toast("¡App instalada!"); });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW no registrado", e));
  });
}

/* ============================================================
   INIT
   ============================================================ */
load();
renderDashboard();
bindReveals();
if (typeof window.initHero3D === "function") window.initHero3D();
