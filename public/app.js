const API_URL = "/productos";
// Apply saved theme options (so configuration persists across pages)
(function () {
  try {
    const STORAGE_KEY = "siteThemeOptions_v1";
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const opts = JSON.parse(raw);
      if (opts.navColor) {
        document.documentElement.style.setProperty(
          "--nav-color",
          opts.navColor,
        );
        // derive rgb
        const h = opts.navColor.replace("#", "");
        let rgb = null;
        if (h.length === 3)
          rgb = [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
          ];
        else if (h.length === 6)
          rgb = [
            parseInt(h.slice(0, 2), 16),
            parseInt(h.slice(2, 4), 16),
            parseInt(h.slice(4, 6), 16),
          ];
        if (rgb)
          document.documentElement.style.setProperty(
            "--nav-rgb",
            rgb.join(","),
          );
      }
      if (opts.brandColor)
        document
          .querySelector(".brand")
          ?.style.setProperty("color", opts.brandColor);
      if (opts.sidebarColor)
        document
          .querySelector(".sidebar")
          ?.style.setProperty("background", opts.sidebarColor);
      if (opts.navStyle === "dark") document.body.classList.add("dark");
      else document.body.classList.remove("dark");
      if (typeof opts.cardShadows === "boolean")
        document.documentElement.style.setProperty(
          "--card-shadow",
          opts.cardShadows ? "0 6px 18px rgba(2,6,23,0.08)" : "none",
        );
      if (typeof opts.compactMode === "boolean")
        document.documentElement.setAttribute(
          "data-compact",
          opts.compactMode ? "1" : "0",
        );
    }
  } catch (e) {
    console.warn("applySavedTheme error", e);
  }
})();

// Toast mixin with longer default duration
const Toast = Swal.mixin({
  toast: true,
  position: "top-end",
  showConfirmButton: false,
  timer: 5000,
  timerProgressBar: true,
});

const formulario = document.getElementById("productoForm");
const tabla = document.getElementById("tablaProductos");
const btnCrear = document.getElementById("btnCrear");
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("closeModal");
const modalTitle = document.getElementById("modalTitle");
const loadingOverlay = document.getElementById("loadingOverlay");
const perPageSelect = document.getElementById("perPageSelect");
const searchInput = document.getElementById("searchInput");
const paginationEl = document.getElementById("pagination");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const paginationInfoEl = document.getElementById("paginationInfo");

let productosData = [];
let currentPage = 1;
let perPage = Number(perPageSelect.value || 10);
let sortKey = null; // 'nombre' or 'precio'
let sortDir = "asc";
let editingId = null;
let _loadingShownAt = 0;
const MIN_LOADING_MS = 300;

function showLoading() {
  if (loadingOverlay) {
    loadingOverlay.style.display = "flex";
    _loadingShownAt = Date.now();
  }
}
function hideLoading() {
  if (!loadingOverlay) return;
  const elapsed = Date.now() - _loadingShownAt;
  const rem = Math.max(0, MIN_LOADING_MS - elapsed);
  if (rem > 0) setTimeout(() => (loadingOverlay.style.display = "none"), rem);
  else loadingOverlay.style.display = "none";
}

async function cargarProductos() {
  // setup submenu toggles (only once)
  if (!setupShellControls._submenusBound) {
    setupSidebarSubmenus();
    setupShellControls._submenusBound = true;
  }
  showLoading();

  // Submenu toggling: finds .has-submenu items and wires chevrons
  function setupSidebarSubmenus() {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar) return;
    const items = Array.from(sidebar.querySelectorAll("li"));
    items.forEach((li) => {
      const submenu = li.querySelector(".submenu");
      if (submenu) {
        li.classList.add("has-submenu");
        const link = li.querySelector("a");
        const chev = link.querySelector(".chev");
        if (chev && !chev.dataset.bound) {
          chev.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open = li.classList.toggle("open");
            link.setAttribute("aria-expanded", open ? "true" : "false");
            // smooth scroll the toggled item into view when opened
            if (open) {
              try {
                li.scrollIntoView({ behavior: "smooth", block: "nearest" });
              } catch (err) {
                /* ignore */
              }
            }
          });
          chev.dataset.bound = "1";
        }
        // also allow clicking the parent link area (except actual navigation)
        link.addEventListener("click", (e) => {
          // if the href is '#', toggle instead of navigating
          const href = link.getAttribute("href");
          if (href === "#" || href === "") {
            e.preventDefault();
            const opened = li.classList.toggle("open");
            if (opened) {
              try {
                li.scrollIntoView({ behavior: "smooth", block: "nearest" });
              } catch (err) {
                /* ignore */
              }
            }
          }
        });
      }
    });
  }
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Error al obtener productos");
    productosData = await res.json();
    currentPage = 1;
    applyFiltersAndRender();
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudieron cargar productos",
    });
  } finally {
    hideLoading();
  }
}

function formatPrice(v) {
  if (v === null || v === undefined) return "-";
  // Try to parse strings like "1.900,00", "1900,00", "1,900.00", "$1,900.00"
  const parsed = parsePriceString(v);
  if (parsed === null || Number.isNaN(parsed)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(parsed));
}

function parsePriceString(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim();
  // remove currency symbols and whitespace
  s = s.replace(/[^0-9.,\-]/g, "");
  if (s === "") return null;
  // If contains both '.' and ',', assume '.' thousands and ',' decimal
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(/,/g, ".");
  } else if (s.includes(",") && !s.includes(".")) {
    // If the part after last comma has length 3 -> comma likely thousands separator
    const lastComma = s.lastIndexOf(",");
    const fracLen = s.length - lastComma - 1;
    if (fracLen === 3) {
      s = s.replace(/,/g, "");
    } else {
      // treat last comma as decimal separator
      s = s.replace(/,/g, ".");
    }
  } else if (s.includes(".") && !s.includes(",")) {
    // If multiple dots, assume dots are thousand separators except possibly last
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      const lastDot = s.lastIndexOf(".");
      const fracLen = s.length - lastDot - 1;
      if (fracLen > 0 && fracLen <= 4) {
        const withoutDots = s.replace(/\./g, "");
        s =
          withoutDots.slice(0, withoutDots.length - fracLen) +
          "." +
          withoutDots.slice(-fracLen);
      } else {
        s = s.replace(/\./g, "");
      }
    }
    // otherwise keep as-is
  }
  // remove any remaining non-number except dot and minus
  s = s.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function sortData(arr) {
  if (!sortKey) return arr.slice();
  const dir = sortDir === "asc" ? 1 : -1;
  return arr.slice().sort((a, b) => {
    let va = a[sortKey];
    let vb = b[sortKey];
    if (sortKey === "precio") {
      va = Number(va);
      vb = Number(vb);
      if (isNaN(va)) va = 0;
      if (isNaN(vb)) vb = 0;
      return (va - vb) * dir;
    }
    va = (va || "").toString().toLowerCase();
    vb = (vb || "").toString().toLowerCase();
    if (va > vb) return 1 * dir;
    if (va < vb) return -1 * dir;
    return 0;
  });
}

function applyFiltersAndRender() {
  const term = (searchInput && searchInput.value.trim().toLowerCase()) || "";
  const filtered = productosData.filter((p) => {
    if (!term) return true;
    const hay = (v) => (v || "").toString().toLowerCase();
    return hay(p.nombre).includes(term) || hay(p.descripcion).includes(term);
  });
  renderTable(filtered);
  renderPagination(filtered.length);
}

function renderTable(data) {
  tabla.innerHTML = "";
  perPage = Number(perPageSelect.value || perPage);
  const total = data.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * perPage;
  const pageItems = sortData(data).slice(start, start + perPage);
  if (pageItems.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="6">No hay productos.</td>`;
    tabla.appendChild(tr);
    return;
  }
  pageItems.forEach((p) => {
    const tr = document.createElement("tr");
    const img = p.imagen ? `<img src="${p.imagen}" class="thumb">` : "";
    tr.innerHTML = `
      <td>${p.idProducto}</td>
      <td>${img}</td>
      <td>${p.nombre || ""}</td>
      <td>${formatPrice(p.precio)}</td>
      <td>${p.descripcion || ""}</td>
      <td></td>
    `;
    const accionesTd = tr.querySelector("td:last-child");
    const btnVer = document.createElement("button");
    btnVer.className = "btn-ver";
    btnVer.title = "Ver";
    btnVer.innerHTML = "<i class='fa-solid fa-eye' aria-hidden='true'></i>";
    btnVer.addEventListener("click", () => abrirVerProducto(p));
    accionesTd.appendChild(btnVer);

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-editar";
    btnEditar.textContent = "Editar";
    btnEditar.addEventListener("click", () => abrirEditarProducto(p));
    accionesTd.appendChild(btnEditar);

    const btnEliminar = document.createElement("button");
    btnEliminar.className = "btn-eliminar";
    btnEliminar.textContent = "Eliminar";
    btnEliminar.addEventListener("click", () => eliminarProducto(p.idProducto));
    accionesTd.appendChild(btnEliminar);
    tabla.appendChild(tr);
  });
}

function abrirVerProducto(p) {
  const detailModal = document.getElementById("detailModal");
  if (!detailModal) return;
  const img = document.getElementById("detailImage");
  const name = document.getElementById("detailName");
  const price = document.getElementById("detailPrice");
  const desc = document.getElementById("detailDescription");
  if (img) {
    if (p.imagen) {
      img.src = p.imagen;
      img.style.display = "block";
    } else {
      img.src = "";
      img.style.display = "none";
    }
  }
  if (name) name.textContent = p.nombre || "";
  if (price) price.textContent = formatPrice(p.precio);
  if (desc) desc.textContent = p.descripcion || "";
  detailModal.classList.add("show");
  detailModal.setAttribute("aria-hidden", "false");
}

function closeDetailModal() {
  const detailModal = document.getElementById("detailModal");
  if (!detailModal) return;
  detailModal.classList.remove("show");
  detailModal.setAttribute("aria-hidden", "true");
}

function renderPagination(totalItems) {
  if (!paginationEl) return;
  paginationEl.innerHTML = "";
  perPage = Number(perPageSelect.value || perPage);
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const totalAll = productosData.length;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(totalItems, currentPage * perPage);
  if (paginationInfoEl) {
    if (totalItems === totalAll)
      paginationInfoEl.textContent = `Mostrando ${startItem} a ${endItem} de ${totalItems} registros`;
    else
      paginationInfoEl.textContent = `Mostrando ${startItem} a ${endItem} de ${totalItems} registros (filtrado de ${totalAll})`;
  }
  const btn = (text, disabled, cb) => {
    const b = document.createElement("button");
    b.textContent = text;
    b.disabled = !!disabled;
    b.addEventListener("click", cb);
    return b;
  };
  paginationEl.appendChild(
    btn("Anterior", currentPage <= 1, () => {
      if (currentPage > 1) {
        currentPage--;
        applyFiltersAndRender();
      }
    }),
  );
  const maxButtons = 7;
  let start = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons - 1) start = Math.max(1, end - maxButtons + 1);
  for (let p = start; p <= end; p++) {
    const b = document.createElement("button");
    b.textContent = String(p);
    if (p === currentPage) {
      b.classList.add("active");
      b.disabled = true;
    } else
      b.addEventListener("click", () => {
        currentPage = p;
        applyFiltersAndRender();
      });
    paginationEl.appendChild(b);
  }
  paginationEl.appendChild(
    btn("Siguiente", currentPage >= totalPages, () => {
      if (currentPage < totalPages) {
        currentPage++;
        applyFiltersAndRender();
      }
    }),
  );
}

async function eliminarProducto(id) {
  const r = await Swal.fire({
    title: "Eliminar producto?",
    text: "Esta acción no se puede deshacer",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, eliminar",
    cancelButtonText: "Cancelar",
  });
  if (!r.isConfirmed) return;
  try {
    showLoading();
    const resp = await fetch(`${API_URL}/${id}`, { method: "DELETE" });
    hideLoading();
    if (resp.ok) {
      Toast.fire({ icon: "success", title: "Eliminado", timer: 7000 });
      await cargarProductos();
    } else {
      const body = await resp.json().catch(() => ({}));
      Swal.fire({
        icon: "error",
        title: "Error",
        text: body.error || "No se pudo eliminar",
      });
    }
  } catch (err) {
    hideLoading();
    Swal.fire({ icon: "error", title: "Error", text: String(err) });
  }
}

// Form handling: only POST (create)
formulario.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = document.getElementById("nombre").value;
  const precio = document.getElementById("precio").value;
  const descripcion = document.getElementById("descripcion").value;
  const imagenInput = document.getElementById("imagen");
  const file =
    imagenInput && imagenInput.files && imagenInput.files[0]
      ? imagenInput.files[0]
      : null;
  try {
    showLoading();
    const idField = document.getElementById("idProducto").value;
    const isEdit = idField && idField.length > 0;
    if (file) {
      const fd = new FormData();
      fd.append("nombre", nombre);
      fd.append("precio", precio);
      if (descripcion) fd.append("descripcion", descripcion);
      fd.append("imagen", file);
      const url = isEdit ? `${API_URL}/${idField}` : API_URL;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        body: fd,
      });
      hideLoading();
      if (res.ok) {
        Toast.fire({
          icon: "success",
          title: isEdit ? "Actualizado" : "Creado",
          timer: 7000,
        });
        formulario.reset();
        document.getElementById("previewImg").style.display = "none";
        await cargarProductos();
        closeModal();
      } else {
        let b = {};
        try {
          b = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          b = { error: txt || `HTTP ${res.status}` };
        }
        Swal.fire({
          icon: "error",
          title: "Error",
          text: b.error || b.details || "No se pudo crear",
        });
        console.error("Create product failed:", b);
      }
    } else {
      const body = { nombre, precio, descripcion };
      const idField = document.getElementById("idProducto").value;
      const isEdit = idField && idField.length > 0;
      const url = isEdit ? `${API_URL}/${idField}` : API_URL;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      hideLoading();
      if (res.ok) {
        Toast.fire({
          icon: "success",
          title: isEdit ? "Actualizado" : "Creado",
          timer: 7000,
        });
        formulario.reset();
        await cargarProductos();
        closeModal();
      } else {
        let b = {};
        try {
          b = await res.json();
        } catch (e) {
          const txt = await res.text().catch(() => "");
          b = { error: txt || `HTTP ${res.status}` };
        }
        Swal.fire({
          icon: "error",
          title: "Error",
          text: b.error || b.details || "No se pudo crear",
        });
        console.error("Create product failed:", b);
      }
    }
  } catch (err) {
    hideLoading();
    console.error(err);
    Swal.fire({ icon: "error", title: "Error", text: String(err) });
  }
});

// Drag&drop
function setupImageDragDrop() {
  const dropArea = document.getElementById("dropArea");
  const fileInput = document.getElementById("imagen");
  const preview = document.getElementById("previewImg");
  if (!dropArea || !fileInput) return;
  const dropPlus = dropArea.querySelector(".drop-plus");
  // default to create state when no preview present
  if (preview && (!preview.src || preview.src === "")) {
    dropArea.classList.add("create");
  }
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  ["dragenter", "dragover", "dragleave", "drop"].forEach((ev) =>
    dropArea.addEventListener(ev, preventDefaults, false),
  );
  dropArea.addEventListener("dragover", () =>
    dropArea.classList.add("dragover"),
  );
  dropArea.addEventListener("dragleave", () =>
    dropArea.classList.remove("dragover"),
  );
  dropArea.addEventListener("drop", (e) => {
    dropArea.classList.remove("dragover");
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      fileInput.files = dt.files;
      showPreview(dt.files[0]);
    }
  });
  dropArea.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (f) showPreview(f);
  });
  function showPreview(file) {
    if (!preview) return;
    if (typeof file === "string") {
      preview.src = file;
      preview.style.display = "block";
      dropArea.classList.add("has-preview");
      dropArea.classList.remove("create");
      return;
    }
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = "block";
    dropArea.classList.add("has-preview");
    dropArea.classList.remove("create");
  }
  formulario.addEventListener("reset", () => {
    if (preview) {
      preview.style.display = "none";
      preview.src = "";
      dropArea.classList.remove("has-preview");
      dropArea.classList.add("create");
    }
  });
}

function openModal() {
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
  document.getElementById("nombre").focus();
}
function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

document.addEventListener("DOMContentLoaded", () => {
  const isProductsPage = Boolean(
    document.getElementById("tablaProductos") ||
    document.getElementById("productoForm"),
  );

  if (isProductsPage) {
    // product page initialization
    setupImageDragDrop();
    if (perPageSelect) {
      const storedPer = localStorage.getItem("perPage");
      if (storedPer) {
        perPageSelect.value = storedPer;
        perPage = Number(storedPer || perPage);
      }
      perPageSelect.addEventListener("change", () => {
        localStorage.setItem("perPage", String(perPageSelect.value));
        currentPage = 1;
        applyFiltersAndRender();
      });
    }

    if (searchInput) {
      let t = null;
      searchInput.addEventListener("input", () => {
        clearSearchBtn.style.display = searchInput.value
          ? "inline-block"
          : "none";
        clearTimeout(t);
        t = setTimeout(() => {
          currentPage = 1;
          applyFiltersAndRender();
        }, 250);
      });
    }
    if (clearSearchBtn)
      clearSearchBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        clearSearchBtn.style.display = "none";
        currentPage = 1;
        applyFiltersAndRender();
        if (searchInput) searchInput.focus();
      });

    // sorting headers
    const keys = [
      "idProducto",
      "imagen",
      "nombre",
      "precio",
      "descripcion",
      null,
    ];
    const ths = document.querySelectorAll("table thead th");
    ths.forEach((th, idx) => {
      const key = keys[idx];
      if (!key) return;
      th.style.cursor = "pointer";
      th.addEventListener("click", () => {
        if (sortKey !== key) {
          sortKey = key;
          sortDir = "asc";
        } else sortDir = sortDir === "asc" ? "desc" : "asc";
        ths.forEach((t) => {
          t.classList.remove("sorted-asc", "sorted-desc");
          const ic = t.querySelector(".sort-icon");
          if (ic) ic.className = "fa-solid fa-sort sort-icon";
        });
        if (sortDir === "asc") {
          th.classList.add("sorted-asc");
          const ic = th.querySelector(".sort-icon");
          if (ic) ic.className = "fa-solid fa-sort-up sort-icon";
        } else {
          th.classList.add("sorted-desc");
          const ic = th.querySelector(".sort-icon");
          if (ic) ic.className = "fa-solid fa-sort-down sort-icon";
        }
        applyFiltersAndRender();
      });
    });

    if (btnCrear)
      btnCrear.addEventListener("click", () => {
        const pf = document.getElementById("productoForm");
        if (pf) pf.reset();
        const preview = document.getElementById("previewImg");
        if (preview) preview.style.display = "none";
        const dropArea = document.getElementById("dropArea");
        if (dropArea) {
          dropArea.classList.add("create");
          dropArea.classList.remove("has-preview");
          const p = document.getElementById("previewImg");
          if (p) {
            p.src = "";
            p.style.display = "none";
          }
        }
        const idEl = document.getElementById("idProducto");
        if (idEl) idEl.value = "";
        if (modalTitle) modalTitle.textContent = "Crear Producto";
        editingId = null;
        openModal();
      });

    if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
    const closeDetailBtn = document.getElementById("closeDetail");
    if (closeDetailBtn)
      closeDetailBtn.addEventListener("click", closeDetailModal);
    if (modal)
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
      });
    const detailModal = document.getElementById("detailModal");
    if (detailModal)
      detailModal.addEventListener("click", (e) => {
        if (e.target === detailModal) closeDetailModal();
      });

    cargarProductos();
  }

  // setup topbar dropdowns for email and notifications if present
  if (typeof setupTopbarDropdowns === "function") setupTopbarDropdowns();

  // wire email view all link to open messages modal
  const emailViewAll = document.getElementById("emailViewAll");
  const messagesModal = document.getElementById("messagesModal");
  const closeMessages = document.getElementById("closeMessages");
  const messagesListModal = document.getElementById("messagesListModal");
  if (emailViewAll && messagesModal && messagesListModal) {
    emailViewAll.addEventListener("click", (e) => {
      e.preventDefault();
      const emailPanel = document.getElementById("emailPanel");
      // If panel exists, toggle expanded view inside the dropdown (show all messages)
      if (emailPanel) {
        const expanded = emailPanel.classList.toggle("expanded");
        emailViewAll.textContent = expanded ? "Show Less" : "View All";
        // ensure panel is open and repositioned when expanded
        if (expanded) {
          emailPanel.classList.add("open");
          positionPanel(document.getElementById("emailBtn"), emailPanel);
        }
        return;
      }
      // fallback: populate messages modal from small panel items
      const smallItems = document.querySelectorAll(".email-panel .msg-item");
      messagesListModal.innerHTML = "";
      smallItems.forEach((it) => {
        const subj = it.getAttribute("data-subject") || "(sin asunto)";
        const body = it.getAttribute("data-body") || "";
        const time = it.getAttribute("data-time") || "";
        const avatar =
          it.getAttribute("data-avatar") || "/uploads/default-avatar.png";
        const online = it.getAttribute("data-online") === "true";
        const wrap = document.createElement("div");
        wrap.className = "msg-item";
        wrap.style.display = "flex";
        wrap.style.gap = "10px";
        wrap.style.padding = "10px";
        wrap.style.borderBottom = "1px solid rgba(0,0,0,0.04)";
        wrap.innerHTML = `
          <div style="width:56px;flex-shrink:0;position:relative">
            <img src="${avatar}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">
            <span style="position:absolute;bottom:6px;left:40px;width:10px;height:10px;border-radius:50%;border:2px solid var(--card);background:${online ? "#16a34a" : "#ef4444"}"></span>
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px"><strong>${subj}</strong><span style="color:var(--muted);font-size:12px;margin-left:auto">${time}</span></div>
            <div style="color:var(--muted);margin-top:6px">${body}</div>
          </div>
        `;
        messagesListModal.appendChild(wrap);
      });
      messagesModal.classList.add("show");
      messagesModal.setAttribute("aria-hidden", "false");
    });
  }
  if (closeMessages && messagesModal)
    closeMessages.addEventListener("click", () => {
      messagesModal.classList.remove("show");
      messagesModal.setAttribute("aria-hidden", "true");
    });
  if (messagesModal)
    messagesModal.addEventListener("click", (e) => {
      if (e.target === messagesModal) {
        messagesModal.classList.remove("show");
        messagesModal.setAttribute("aria-hidden", "true");
      }
    });

  // Email panel inline search (filters .msg-item inside the dropdown)
  (function setupEmailPanelSearch() {
    const emailPanel = document.querySelector(".email-panel");
    if (!emailPanel) return;
    const searchBox = emailPanel.querySelector(
      ".dropdown-search input[type=search]",
    );
    if (!searchBox) return;
    const normalize = (s) =>
      (s || "")
        .toString()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
    searchBox.addEventListener("input", (e) => {
      const q = String(e.target.value || "").trim();
      const term = normalize(q);
      const items = emailPanel.querySelectorAll(".msg-item");
      items.forEach((it) => {
        if (!term) {
          // clear inline style so CSS (nth-child) rules apply
          it.style.display = "";
          return;
        }
        const subj = normalize(it.getAttribute("data-subject") || "");
        const body = normalize(it.getAttribute("data-body") || "");
        const name = normalize(
          it.querySelector(".msg-name")?.textContent || "",
        );
        const combined = `${subj} ${body} ${name}`;
        if (combined.includes(term)) it.style.display = "flex";
        else it.style.display = "none";
      });
      // if user searched, ensure panel is open and expanded to show matches
      if (term) {
        emailPanel.classList.add("open", "expanded");
        const btn = document.getElementById("emailBtn");
        if (btn) positionPanel(btn, emailPanel);
      }
    });
  })();
});

// Topbar dropdowns: toggle panels and close on outside click
function setupTopbarDropdowns() {
  const emailBtn = document.getElementById("emailBtn");
  const notifBtn = document.getElementById("notifBtn");
  const emailPanel = document.getElementById("emailPanel");
  const notifPanel = document.getElementById("notifPanel");
  const userBtn = document.getElementById("userBtn");
  const userPanel = document.getElementById("userPanel");

  function closeAll() {
    [emailPanel, notifPanel].forEach((p) => {
      if (p) p.classList.remove("open");
    });
    if (userPanel) userPanel.classList.remove("open");
    if (emailBtn) emailBtn.setAttribute("aria-expanded", "false");
    if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
    if (userBtn) userBtn.setAttribute("aria-expanded", "false");
  }

  if (emailBtn && emailPanel) {
    emailBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = emailPanel.classList.toggle("open");
      emailBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && notifPanel) notifPanel.classList.remove("open");
      if (open) positionPanel(emailBtn, emailPanel);
    });
  }
  if (notifBtn && notifPanel) {
    notifBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = notifPanel.classList.toggle("open");
      notifBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open && emailPanel) emailPanel.classList.remove("open");
      if (open) positionPanel(notifBtn, notifPanel);
    });
  }

  if (userBtn && userPanel) {
    userBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = userPanel.classList.toggle("open");
      userBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        // close others
        if (emailPanel) emailPanel.classList.remove("open");
        if (notifPanel) notifPanel.classList.remove("open");
        positionPanel(userBtn, userPanel);
      }
    });
  }

  // Allow clicking the sidebar profile area to open the same userPanel
  const sidebarProfile = document.querySelector(".sidebar .profile");
  if (sidebarProfile && userPanel) {
    sidebarProfile.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = userPanel.classList.toggle("open");
      if (open) {
        if (emailPanel) emailPanel.classList.remove("open");
        if (notifPanel) notifPanel.classList.remove("open");
        positionPanel(sidebarProfile, userPanel);
      }
    });
  }

  // Close on outside click
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (
      !emailBtn?.contains(target) &&
      !notifBtn?.contains(target) &&
      !userBtn?.contains(target) &&
      !sidebarProfile?.contains(target) &&
      !emailPanel?.contains(target) &&
      !notifPanel?.contains(target) &&
      !userPanel?.contains(target)
    ) {
      closeAll();
    }
  });

  // Close panels with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
  // reposition panels on resize so they remain visible
  window.addEventListener("resize", () => {
    if (emailPanel?.classList.contains("open") && emailBtn)
      positionPanel(emailBtn, emailPanel);
    if (notifPanel?.classList.contains("open") && notifBtn)
      positionPanel(notifBtn, notifPanel);
  });
}

function positionPanel(btn, panel) {
  if (!btn || !panel) return;
  // ensure panel is visible for measurements
  panel.classList.add("open");
  // tiny timeout to allow layout
  requestAnimationFrame(() => {
    const rect = btn.getBoundingClientRect();
    const pRect = panel.getBoundingClientRect();
    let left = rect.right - pRect.width;
    // prefer aligning right edge with button, but keep within viewport
    if (left < 8) left = rect.left;
    if (left + pRect.width > window.innerWidth - 8)
      left = Math.max(8, window.innerWidth - pRect.width - 8);
    const top = rect.bottom + 8; // 8px gap from button
    panel.style.left = left + "px";
    panel.style.top = top + "px";
  });
}

// Shell controls: global initialization for sidebar collapse and theme toggle
function setupShellControls() {
  const burger = document.getElementById("burgerBtn");
  const sidebar = document.querySelector(".sidebar");
  const themeToggle = document.getElementById("themeToggle");
  const body = document.body;

  if (sidebar) {
    const collapsed = localStorage.getItem("sidebarCollapsed") === "1";
    if (collapsed) sidebar.classList.add("collapsed");
  }

  const theme =
    localStorage.getItem("theme") ||
    (window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light");
  if (theme === "dark") body.classList.add("dark");
  if (themeToggle) themeToggle.classList.toggle("on", theme === "dark");
  if (themeToggle)
    themeToggle.setAttribute(
      "aria-checked",
      theme === "dark" ? "true" : "false",
    );

  if (burger && sidebar) {
    if (!burger.dataset.shellBound) {
      burger.addEventListener("click", () => {
        sidebar.classList.toggle("collapsed");
        localStorage.setItem(
          "sidebarCollapsed",
          sidebar.classList.contains("collapsed") ? "1" : "0",
        );
      });
      burger.dataset.shellBound = "1";
    }
  }
  if (themeToggle) {
    if (!themeToggle.dataset.shellBound) {
      themeToggle.addEventListener("click", () => {
        body.classList.toggle("dark");
        const on = body.classList.contains("dark");
        themeToggle.classList.toggle("on", on);
        themeToggle.setAttribute("aria-checked", on ? "true" : "false");
        localStorage.setItem("theme", on ? "dark" : "light");
      });
      themeToggle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          themeToggle.click();
        }
      });
      themeToggle.dataset.shellBound = "1";
    }
  }
}

document.addEventListener("DOMContentLoaded", setupShellControls);

function abrirEditarProducto(p) {
  editingId = p.idProducto;
  if (modalTitle) modalTitle.textContent = "Editar Producto";
  document.getElementById("idProducto").value = String(p.idProducto || "");
  document.getElementById("nombre").value = p.nombre || "";
  // Prefill precio with a normalized numeric value (dot decimal) for easier editing
  const precioInput = document.getElementById("precio");
  const parsed = parsePriceString(p.precio);
  if (parsed === null) {
    precioInput.value = "";
  } else {
    precioInput.value = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(parsed);
  }
  document.getElementById("descripcion").value = p.descripcion || "";
  const preview = document.getElementById("previewImg");
  if (preview) {
    if (p.imagen) {
      preview.src = p.imagen;
      preview.style.display = "block";
      const dropArea = document.getElementById("dropArea");
      if (dropArea) {
        dropArea.classList.add("has-preview");
        dropArea.classList.remove("create");
      }
    } else {
      preview.style.display = "none";
      preview.src = "";
      const dropArea = document.getElementById("dropArea");
      if (dropArea) {
        dropArea.classList.remove("has-preview");
        dropArea.classList.add("create");
      }
    }
  }
  openModal();
}
