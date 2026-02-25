# SesamoTV

Plataforma de video streaming privada con autenticación dual (admin + usuarios con flujo de aprobación), gestión de videos, categorización por tags, ratings y streaming.

## Arquitectura

| Componente | Tecnología | Hosting |
|---|---|---|
| **Backend/API** | Node.js + Express + PostgreSQL | Azure App Service (B1) |
| **Web Pública** | Vanilla JS SPA | Servida por el mismo App Service |
| **Panel Admin** | Vanilla JS SPA | Servida en ruta oculta |
| **App Móvil** | React Native (Android) | APK standalone |
| **Videos** | Azure Blob Storage (Cool tier) | Streaming via SAS URLs |
| **Base de datos** | PostgreSQL | Azure PostgreSQL con SSL |

## URLs

- **Producción:** https://www.sesamotv.com
- **Release APK:** https://github.com/jayalagb/sesamotv/releases/tag/v2.0

## Funcionalidades

### Usuarios
- Registro con aprobación de admin, login, reset de contraseña
- Búsqueda de videos con debounce (300ms)
- Filtrado por tags (multi-selección con lógica AND)
- Reproductor de video con streaming por rangos (HTTP 206)
- Rating por estrellas (por usuario, promedio visible)
- Conteo de vistas

### Admin
- Dashboard con gestión de videos (CRUD, upload hasta 500MB, drag-drop reorder)
- Gestión de usuarios (aprobar/rechazar/eliminar)
- Gestión de tags
- Ajustes (geo-blocking toggle)
- Pantalla de Jobs (uploads en background)

### Seguridad
- Token admin en HttpOnly cookie (no localStorage)
- Panel admin en ruta oculta con X-Robots-Tag: noindex
- Lockout tras 5 intentos fallidos (15min)
- Bcrypt 12 rounds, protección CSRF
- Validación de username, escape de LIKE, cap de contraseña
- Helmet CSP, rate limiting, CORS configurado

### Infraestructura
- Thumbnails auto-generados con ffmpeg (skip de frames negros)
- Deploy automático via GitHub Actions
- startup.sh instala ffmpeg en cada arranque del container
- SSL con Azure Managed Certificates

## Estructura de archivos

```
SesamoTV/
├── backend/
│   ├── server.js              (Express entry point)
│   ├── config/database.js     (PostgreSQL pool)
│   ├── middleware/auth.js     (JWT auth dual)
│   ├── routes/                (auth, userAuth, users, videos, tags)
│   ├── migrations/            (001-007)
│   ├── schema.sql
│   └── startup.sh
├── public/                    (Web pública - 6 pantallas)
├── admin/                     (Panel admin - 7 pantallas)
├── mobile/                    (React Native Android)
│   ├── App.js
│   ├── src/api.js
│   ├── src/components/        (StarRating, VideoCard, TagChip)
│   ├── src/screens/           (6 pantallas)
│   └── android/
└── .github/workflows/         (CI/CD)
```

## Comandos

```bash
cd backend
npm install          # Instalar dependencias
npm run dev          # Servidor dev con nodemon (puerto 4000)
npm start            # Servidor producción
```

## Versión actual: v2.0
