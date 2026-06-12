// ============================================================
//  ESCENARIOS — ¡otro archivo para personalizar!
//
//  Para añadir un escenario con imagen:
//   1. Guarda la imagen en img/stages/ (crea la carpeta si no existe)
//   2. Añade una entrada a la lista:
//        { name: 'MI ESCENARIO', image: 'img/stages/mi-escenario.png' }
//
//  Especificaciones de la imagen:
//   - Tamaño: proporción 16:9 (1024x576, 1672x941, 2048x1152...);
//     se escala automáticamente. Formato PNG o JPG.
//   - floorY: a qué altura (en escala 1024x576) está la superficie
//     donde pisan los personajes. Si no se indica, 490. Ajústalo a
//     ojo hasta que los pies coincidan con el suelo del dibujo.
//   - Estilo pixel art encaja mejor con los personajes.
//
//  El primer escenario es la ciudad nocturna dibujada por código.
// ============================================================

const STAGES = [
  { name: 'CIUDAD NOCTURNA', builtin: true },
  { name: "MCDONALD'S", image: 'img/stages/stage1.png', floorY: 444 },
  { name: 'MC DÖNER', image: 'img/stages/stage2.png', floorY: 460 }
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
