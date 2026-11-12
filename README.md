# WanGP Extras

Small quality-of-life extras plugin for [WanGP (Wan2GP)](https://github.com/deepbeepmeep/Wan2GP).

- **Ctrl+Enter** (Cmd+Enter on Mac) starts a generation from anywhere in the Video Generator tab, prompt box included: it clicks *Generate*, or *Add New Prompt To Queue* while a generation is running.
- Blocks accidental back/forward navigation (mouse side buttons, Alt+Left/Right, browser back gesture).
- **Prepared 0.2.1:** keeps the Reference Library **image-reference** bar hidden while WanGP hides the native Reference Images row; restores it when that row becomes available. Control Video and start/end-image inputs are untouched. This does **not** enable unsupported model conditioning.

## Visibilidad de Reference Images / Reference Images visibility

**ES:** Extras comprueba la fila nativa de Reference Images por identidad del componente, no por el nombre del modelo ni por textos traducidos. Si el modelo/modo oculta ese campo, oculta también su barra de colecciones RL; al volver a un modo compatible, la restaura. No crea un selector de referencias para FL2VA ControlNet-Union ni modifica el núcleo. Las imágenes inicial/final son inputs distintos. Si faltan los marcadores esperados, no inventa capacidades: deja la barra sin su propia ocultación. No añade ajustes ni guarda datos.

**EN:** Extras follows the native Reference Images row by component identity. It hides/restores only RL's reference-image bar, without changing native visibility, model capabilities, control-video bars or starting/ending images. Missing markers fail open; inactive Generate/Edit tabs do not count as unsupported models. No settings or data files are introduced.

See [implementation and retest](docs/FEATURES.md). The preparation has not been published or installed.

## Install

Copy this folder to `Wan2GP/plugins/wan2gp-extras` and restart WanGP.
