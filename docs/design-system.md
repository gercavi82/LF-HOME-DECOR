# Sistema visual L&F Home Decor

## Identidad

El sistema usa una paleta fija, clara y premium:

- `--lf-navy`: texto principal, navegación y acciones secundarias.
- `--lf-terracotta`: acción primaria y acentos.
- `--lf-beige`: fondos cálidos.
- `--lf-background`: fondo general.
- `--lf-surface`: tarjetas y controles.
- `--lf-border`: divisores y bordes.
- `--lf-success`, `--lf-warning`, `--lf-danger`, `--lf-info`: estados.

Los tokens están definidos en `app/globals.css` y expuestos a Tailwind con el
prefijo `lf-`, por ejemplo `bg-lf-surface`, `text-lf-navy` y
`border-lf-border`.

## Componentes

Importar desde el índice central:

```tsx
import { Alert, Badge, Button, Card, Input } from "@/src/components/ui";
```

Componentes disponibles:

- `Button`: primary, secondary, outline, ghost y danger.
- `Input`: etiqueta, ayuda, error y adorno final.
- `Card`: header, title, description y content.
- `Table`: contenedor responsive, encabezados y celdas.
- `Badge`: neutral, success, warning, danger e info.
- `Alert`: success, warning, danger e info.
- `Modal`: cierre por fondo, botón o tecla Escape.
- `Dropdown`: menú nativo basado en `details`.
- `Tooltip`: ayuda contextual accesible por hover/focus.
- `Spinner`: estado de carga.
- `EmptyState`: estado vacío con acción opcional.

## Reglas de uso

1. No introducir colores hexadecimales nuevos dentro de componentes funcionales.
2. Usar terracota para la acción primaria de cada pantalla.
3. Usar navy para navegación, títulos y acciones secundarias.
4. No comunicar estados únicamente mediante color; incluir siempre texto.
5. Conservar foco visible, etiquetas de formulario y mensajes con `role`.
6. Diseñar desde 320 px y envolver tablas en `TableContainer`.
7. Respetar `prefers-reduced-motion` para animaciones no esenciales.
