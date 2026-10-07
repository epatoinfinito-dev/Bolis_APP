# BoliOS — Sistema de gestión para tu negocio de bolis

Aplicación web progresiva (PWA) para administrar un negocio local de bolis: punto de venta, inventario, gastos, estadísticas y análisis de rentabilidad, con visualizaciones 3D (Three.js). **Todos los datos se guardan en el propio dispositivo** (localStorage): no necesitas servidor de bases de datos ni cuentas.

## Módulos

- **Inicio** — panel del día: ventas, ganancia, ticket promedio, inventario, alertas de stock bajo, productos más vendidos y gráfica de 7 días, con un boli 3D interactivo.
- **Vender** — punto de venta táctil: buscador, filtros por tipo, ticket con cantidades, método de pago y registro que descuenta stock automáticamente. Ventas del día con opción de cancelar (devuelve el stock).
- **Productos** — catálogo con costo, precio, margen, stock y alerta de mínimo; ajuste rápido de existencias.
- **Gastos** — registro por categoría (insumos, empaque, servicios, transporte, otros) con filtro y total del mes.
- **Análisis** — rentabilidad por periodo (7 días, 30 días, mes, todo): ingresos, costo de ventas, utilidad bruta, gastos, utilidad neta, margen neto; gráficas de ingresos vs gastos, ventas por producto, **gráfico 3D** por día de la semana, tabla de rentabilidad por producto, exportación a CSV y respaldo/restauración JSON.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub (por ejemplo `bolios-app`).
2. Sube **todo el contenido de esta carpeta** a la raíz del repositorio:
   `index.html`, `styles.css`, `manifest.webmanifest`, `sw.js`, `js/`, `vendor/`, `icons/`.
3. En el repositorio: **Settings → Pages → Build and deployment → Source: "Deploy from a branch"**, rama `main`, carpeta `/ (root)`. Guarda.
4. Espera 1–2 minutos y abre `https://TU-USUARIO.github.io/bolios-app/`.

## Instalar como aplicación

- **Android (Chrome):** abre la URL → menú ⋮ → **"Instalar app"** o **"Añadir a pantalla de inicio"**. También aparecerá un botón "Instalar app" dentro de la aplicación.
- **iPhone (Safari):** abre la URL → botón Compartir → **"Añadir a pantalla de inicio"**.
- **Escritorio (Chrome/Edge):** icono de instalación en la barra de direcciones, o el botón "Instalar app" del encabezado.

Una vez instalada funciona **sin internet** (el service worker guarda todos los archivos localmente).

## Notas

- Para probar localmente usa un servidor estático (los service workers no funcionan desde `file://`): `python3 -m http.server 8080` y abre `http://localhost:8080`.
- Haz respaldos periódicos desde **Análisis → Datos y respaldo → Respaldo completo**.
- En **Ajustes** puedes cambiar el nombre del negocio, la moneda, tu meta diaria y cargar datos de ejemplo para explorar la app.
