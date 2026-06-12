# Niños con problemas: Fighting game 

Juego de lucha 2D para 2 jugadores — en el mismo teclado o **online con código de sala** — hecho con JavaScript y HTML5 Canvas. No necesita instalación: **doble clic en `index.html`** y a pelear.

## Jugar online

1. Un jugador elige **"Crear sala online"** en el menú: se genera un código de 4 letras.
2. El otro elige **"Unirse con código"** y escribe esas letras (necesita tener el juego abierto también, ya sea con los mismos archivos o desde un enlace si lo publicas).
3. ¡A pelear! El creador de la sala es P1; el invitado es P2 y puede usar WASD+F/G o flechas+K/L.

Funciona con **WebRTC (PeerJS)**: los dos navegadores se conectan directamente entre sí y un servidor público gratuito solo hace la presentación inicial, así que no hay que montar ningún servidor. Requiere internet en ambos lados.

> 💡 Para compartirlo **por enlace** en vez de pasar los archivos: sube la carpeta a [GitHub Pages](https://pages.github.com/) o [Netlify Drop](https://app.netlify.com/drop) (gratis, arrastrar y soltar) y pásale la URL a tus amigos.

## Controles

| Acción                 | Jugador 1          | Jugador 2 |
|------------------------|--------------------|-----------|
| Moverse                | A / D              | ← / →     |
| Saltar (¡doble salto!) | ESPACIO (o W)      | ↑         |
| Agacharse              | S                  | ↓         |
| Dash                   | SHIFT              | Ñ         |
| Golpe                  | F o clic izquierdo | K         |
| Especial               | G o clic derecho   | L         |

- **Combos**: pulsa el golpe varias veces seguidas para encadenar hasta 4 ataques (cada uno con su animación). Los golpes intermedios apenas empujan, así el rival se queda en rango; el cuarto es un **remate** más fuerte que lo lanza por los aires. Si te pegan, tu cadena se corta.
- El **dash** atraviesa al rival y esquiva proyectiles y gritos. Tiene su propio cooldown (la barra **cian** del HUD; la amarilla es el especial).
- **Agacharse** encoge tu hitbox: los proyectiles pasan por encima. Puedes caminar y pegar bajo mientras estás agachado.
- En la pantalla de KO: **R** = revancha, **ENTER** = volver a elegir personajes. El ratón también sirve para todos los menús.

## Cómo agregar a un amigo

Abre [js/characters.js](js/characters.js), copia uno de los personajes existentes, pégalo al final de la lista y cambia sus valores (nombre, colores, vida, velocidad, habilidad especial, voz y frase de victoria). Aparecerá automáticamente en la pantalla de selección. Las instrucciones detalladas de cada campo están comentadas al inicio de ese archivo.

Habilidades especiales disponibles por ahora:
- `projectile` — lanza un proyectil que hace daño
- `strings` — hilos de titiritero: poco daño pero invierte los controles del rival unos segundos
- `shout` — grito de área frontal: daño y un empujón enorme

(El dash no se configura por personaje: todos lo tienen igual, con el mismo cooldown.)

## Estructura del proyecto

- `index.html` — la página del juego
- `style.css` — estilos de la página
- `js/characters.js` — **definición de los personajes (el archivo que editarás más)**
- `js/sounds.js` — efectos de sonido generados por código (cada personaje tiene su "voz")
- `js/net.js` — multijugador online (salas, códigos y sincronización por WebRTC)
- `js/fighter.js` — física, golpes y dibujo de los luchadores
- `js/game.js` — bucle del juego, escenas, teclado y HUD

## Próximos pasos posibles

- Sprites/dibujos reales de cada amigo en lugar de las figuras placeholder
- Sonidos grabados (frases reales de tus amigos) en `js/sounds.js`
- Más tipos de habilidad especial (curación, contraataque, salto doble...)
- Bloqueo/defensa, combos, rondas al mejor de 3
- Escenarios seleccionables
