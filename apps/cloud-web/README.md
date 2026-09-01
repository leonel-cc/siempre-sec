# Siempre Cloud Web

Portal web React para administrar organizaciones, aprobar instalaciones, verificar el teléfono de alertas, consultar eventos y abrir sesiones remotas de LiveKit.

## Requisitos

- Node.js 20 o posterior.
- Un cliente OIDC público configurado para Authorization Code + PKCE. No configure un secreto de cliente.
- La URI exacta de `VITE_OIDC_REDIRECT_URI` registrada como redirect URI del proveedor.
- CORS habilitado en Cloud API para el origen del portal.

## Configuración

Copie `.env.example` a `.env.local` y complete:

| Variable | Descripción |
| --- | --- |
| `VITE_CLOUD_API_URL` | Origen de Cloud API, sin `/v1` final. |
| `VITE_OIDC_AUTHORITY` | Authority/issuer OIDC. |
| `VITE_OIDC_CLIENT_ID` | ID del cliente público SPA. |
| `VITE_OIDC_REDIRECT_URI` | Callback absoluto, normalmente `/auth/callback`. |
| `VITE_OIDC_SCOPE` | Scopes separados por espacios. |

## Desarrollo

Desde la raíz del repositorio:

```bash
npm run dev --workspace=apps/cloud-web
```

Para validar y compilar:

```bash
npm run build --workspace=apps/cloud-web
npm run preview --workspace=apps/cloud-web
```

El portal usa almacenamiento de sesión del navegador para la sesión OIDC y la organización seleccionada. La renovación silenciosa está habilitada; funcionará mediante refresh token cuando el proveedor lo permita para clientes públicos. La evidencia de video nunca se descarga desde la lista de eventos: permanece en la instalación local.
