# IO — el código de tu vida

**IO** se lee “yo”, y también es **1 0**: el código binario con el que se escribe todo. **1** es lo que haces y **0** lo que aún no.

IO es un **juego de hábitos que se juega en la vida real**. Es una app web instalable (PWA) para Android, iPhone y PC. **Siempre es gratis y no tiene anuncios. Nada se compra con dinero: todo se gana haciendo.**

## Cómo funciona

1. **Configuración inicial.** Creas tu personaje y eliges tus hábitos. Cada hábito tiene **hora**, **duración** y **días**. Opcionalmente escribes tu **porqué**.
2. **Temporizador obligatorio.** A la hora de tu hábito tocas ▶ y se abre el **modo enfoque** a pantalla completa:
   - Un anillo se va escribiendo en 1 y 0, con una lluvia binaria suave de fondo y el tiempo restante también en binario.
   - Tu personaje hace la actividad mientras corre el reloj.
   - El tiempo se calcula con marcas de tiempo, así que **sigue contando aunque bloquees el celular**. Sirve para leer un libro de papel, ir al gym o a una clase.
   - **Se puede pausar, pero no terminar antes.** Al pausar, IO te recuerda tu motivo. Lo que llevas se guarda.
3. **👑 Corona.** Cuando el reloj llega al final aparece la corona. Al activarla:
   - El personaje celebra en la consola con animación, confeti de unos y ceros y sonido 8-bit.
   - Ganas **XP** y **bits** ◆. Si empezaste a tiempo (±30 min de la hora) ganas +25%, y las rachas suman más.
4. **🎁 Día perfecto.** Si completas todos los hábitos del día, abres el cofre.

## La consola (Game Boy de verdad)

| Control | Caminando | Menús y ascensor | Modo decorar |
|---|---|---|---|
| ✥ ◀ ▶ | caminar (mantén presionado) | moverse | elegir objeto / moverlo |
| ✥ ▲ | entrar al ascensor si estás en la puerta | subir | subir o bajar cuadros |
| ✥ ▼ | sentarse | bajar | — |
| **A** | usar objeto cercano (cama, piano, pesas, vehículo…) | elegir / viajar | levantar / soltar |
| **B** | bailar | salir | cancelar / salir |
| **SELECT** | modo decorar | siguiente edificio (en el ascensor) | salir |
| **START** | menú: mochila, tienda, mapa, personaje, logros, ajustes | cerrar | opciones del objeto |

- **Teclado:** flechas o WASD, **Z** o espacio = A, **X** = B, **Shift** = SELECT, **Enter** = START.
- **Pantalla táctil:** tocas el piso para caminar, tocas un objeto para ir a usarlo y tocas la puerta para tomar el ascensor. En modo decorar arrastras los objetos con el dedo.

## El mundo: nivel = piso

Cada nivel abre un piso nuevo. El edificio crece en lujo y no se acaba:

| Edificio | Pisos | Ascensor | Destacados |
|---|---|---|---|
| Edificio Barrio | 1–10 | madera | cuarto, sala, **garaje (3)**, cocina, gimnasio, biblioteca, jardín, oficina, juegos, **garaje doble (10)** |
| Torre Centro | 11–25 | acero | piscina (15), spa (20), terraza (25) |
| Rascacielos IO | 26–50 | cristal y oro | cine (30), galería (35), observatorio (40), hangar (45), **helipuerto (50)** |
| Ciudad en las nubes | 51–75 | oro | jardín en las nubes (60), mirador (75) |
| Estación orbital | 76–100 | neón | puente de mando (100) |
| Sectores sin fin | 101+ | neón | un mundo nuevo cada 25 pisos |

- **La vista por la ventana cambia con la altura:** calle, techos, ciudad, skyline, nubes y espacio.
- **La progresión es lenta a propósito:** el nivel 10 llega en unas 2 semanas y el 50 en unos 9 meses de hábitos diarios.

**Tienda.** Tiene unos 90 objetos: muebles, plantas, arte, tecnología, vehículos (bici → moto → carro → Jeep → deportivo → helicóptero → nave) y mascotas que caminan solas, más ropa y accesorios para el personaje.
- Los vehículos van en los garajes, el hangar y el helipuerto.
- Todo se coloca y se mueve en 2D. Lo que no usas queda en la mochila.

**Personaje.** 2D vectorial con sombreado y piernas y brazos que caminan. Puedes elegir:
- Cuerpo (masculino, femenino o neutro) y complexión.
- 8 tonos de piel.
- 10 peinados con 12 colores.
- Barba, color de ojos y rasgos (pecas, lunar, rubor).
- 6 tipos de ropa arriba, 3 abajo y color de zapatos.

## Archivos

```
io/
├── index.html      # consola + hábitos de hoy + tu semana
├── styles.css      # retro moderno: pixel font, scanlines, skins por edificio
├── app.js          # une todo: lista de hábitos, corona, cofre, tienda, mapa, ajustes, demo
├── engine.js       # motor 2D: caminar, ascensor, decorar, menú START, efectos, sonido
├── focus.js        # modo enfoque (anillo 1/0, pausa con motivos, corona)
├── habits.js       # hábitos, temporizador, recompensas, rachas
├── world.js        # niveles, edificios, pisos, catálogo, logros
├── avatar.js       # personaje por partes + editor
├── onboarding.js   # configuración inicial
├── store.js        # datos local-first + sincronización opcional con Supabase
├── sw.js           # funciona sin conexión
└── supabase/schema.sql
```

**Sin build.** Se sirve tal cual desde `/io/`. Todo se guarda en el dispositivo. Para sincronizar entre dispositivos: corre `supabase/schema.sql` y pega la URL y la anon key en ⚙️ Ajustes.

> La versión anterior (finanzas, Telegram y relaciones) está en el historial de git, en el commit `9ab2545`.

## Próximos pasos sugeridos

- **Notificaciones a la hora de cada hábito.** Web Push, que necesita un pequeño backend.
- **Login con Google y sincronización por usuario.** Así el progreso te sigue a cualquier celular.
- **Publicar en tiendas.** Con TWA/Bubblewrap para Google Play y Capacitor para iOS.
- **IO+ (suscripción opcional, ~$9/mes).** Solo cosas que no rompan la regla de oro, por ejemplo temas visuales, estadísticas avanzadas, retos con amigos y respaldo en la nube. **Nunca bits, XP ni objetos por dinero.**
- **Más contenido:** eventos de temporada, más pisos especiales, clima en las ventanas y NPCs vecinos.
