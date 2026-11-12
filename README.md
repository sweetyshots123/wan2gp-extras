# WanGP Extras

Small quality-of-life extras plugin for [WanGP (Wan2GP)](https://github.com/deepbeepmeep/Wan2GP).

- **Ctrl+Enter** (Cmd+Enter on Mac) starts a generation from anywhere in the Video Generator tab, prompt box included: it clicks *Generate*, or *Add New Prompt To Queue* while a generation is running.
- Blocks accidental back/forward navigation (mouse side buttons, Alt+Left/Right, browser back gesture).
- **Prepared 0.2.1:** keeps the Reference Library **image-reference** bar hidden while WanGP hides the native Reference Images row; restores it when that row becomes available. Control Video and start/end-image inputs are untouched. This does **not** enable unsupported model conditioning.
- **Prepared 0.3.0:** a **🗑 Clear outputs** button under the Video Generator gallery sends the files in WanGP's output folder to the **Recycle Bin**, after showing the exact list and asking for confirmation. The `frames` folder is kept.

## Vaciar salidas / Clear outputs

**ES:** El botón **🗑 Vaciar salidas** (bajo las pestañas de la galería del Video Generator) primero muestra, sin tocar nada, qué se enviaría a la Papelera de reciclaje: la ruta de la carpeta de salida de WanGP (`save_path`, con el workspace de la sesión si lo hay), cada archivo/carpeta con tamaño, lo que se conserva (`frames`) y los enlaces omitidos. Cancelar es la opción por defecto. Al confirmar, solo se envía a la Papelera lo que aparecía en la lista; lo que haya aparecido después se queda. Nunca se borra nada definitivamente; las carpetas van enteras a la Papelera y se restauran con su estructura. Se niega si hay una generación en curso, si la carpeta no existe, es la raíz de una unidad, tu carpeta personal, la carpeta de WanGP (o una superior), un enlace, o una unidad sin Papelera (red/extraíble).

**EN:** **🗑 Clear outputs** first shows a dry-run list of what would go to the Recycle Bin (WanGP's `save_path`, with the session workspace when bound; entries, sizes, kept `frames`, skipped links). Cancel is the default. Confirming recycles only the listed entries; anything newer stays. Nothing is ever deleted permanently. Refused while generating, or for a missing folder, a drive root, home, the WanGP folder or a parent, a link, or a drive with no Recycle Bin. Only `save_path` is cleared: separate image/audio/mesh output folders, if configured, are not.

## Visibilidad de Reference Images / Reference Images visibility

**ES:** Extras comprueba la fila nativa de Reference Images por identidad del componente, no por el nombre del modelo ni por textos traducidos. Si el modelo/modo oculta ese campo, oculta también su barra de colecciones RL; al volver a un modo compatible, la restaura. No crea un selector de referencias para FL2VA ControlNet-Union ni modifica el núcleo. Las imágenes inicial/final son inputs distintos. Si faltan los marcadores esperados, no inventa capacidades: deja la barra sin su propia ocultación. No añade ajustes ni guarda datos.

**EN:** Extras follows the native Reference Images row by component identity. It hides/restores only RL's reference-image bar, without changing native visibility, model capabilities, control-video bars or starting/ending images. Missing markers fail open; inactive Generate/Edit tabs do not count as unsupported models. No settings or data files are introduced.

See [implementation and retest](docs/FEATURES.md). The preparations have not been published or installed.

## Install

Copy this folder to `Wan2GP/plugins/wan2gp-extras` and restart WanGP.
