// ============================================================
//  ESCENARIOS — ¡otro archivo para personalizar!
//
//  Para añadir un escenario con imagen:
//   1. Guarda la imagen en img/stages/ (crea la carpeta si no existe)
//   2. Añade una entrada a la lista:
//        { name: 'MI ESCENARIO', image: 'img/stages/mi-escenario.png' }
//
//  Especificaciones de la imagen:
//   - Tamaño: 1024 x 576 px (o el doble, 2048 x 1152, para más nitidez;
//     se escala automáticamente). Formato PNG o JPG.
//   - El SUELO donde pisan los personajes está a 490 px desde arriba
//     (en escala 1024x576). Dibuja la superficie del suelo en esa línea:
//     todo lo que esté por debajo es "primer plano" del piso.
//   - Estilo pixel art encaja mejor con los personajes, pero no es
//     obligatorio.
//
//  El primer escenario es la ciudad nocturna dibujada por código.
// ============================================================

const STAGES = [
  { name: 'CIUDAD NOCTURNA', builtin: true }
  // { name: 'MI ESCENARIO', image: 'img/stages/mi-escenario.png' },
];

const StageArt = {
  images: {},
  loadAll() {
    STAGES.forEach((s, i) => {
      if (!s.image) return;
      const img = new Image();
      img.onload = () => { this.images[i] = img; };
      img.src = s.image;
    });
  }
};

StageArt.loadAll();
