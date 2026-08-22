# Recuperación de contraseña

## Variables

Configurar en desarrollo:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

En preview/producción debe contener el origen HTTPS real, sin una ruta final.

## Supabase Auth

En **Authentication > URL Configuration** agregar a Redirect URLs:

```text
http://localhost:3000/auth/confirm
```

Agregar también la URL equivalente de preview y producción. El callback acepta
PKCE (`code`) y enlaces OTP (`token_hash` + `type`), establece la sesión mediante
cookies SSR y redirige exclusivamente a `/cambiar-password`.

## Seguridad

- La solicitud recibe siempre una respuesta genérica para cuentas válidas,
  inexistentes, bloqueadas o inactivas.
- La contraseña nueva se procesa sólo mediante Supabase Auth.
- No se registran contraseñas, tokens, cookies ni claves secretas.
- Un callback inválido regresa a la solicitud con un mensaje controlado.
