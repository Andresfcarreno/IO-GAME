# IO — el código de tu vida

**IO** se lee “yo”, y también es **1 0**: el código binario con el que se escribe todo. **1** es lo que haces y **0** lo que aún no.

IO es un **juego de hábitos que se juega en la vida real**. Es una app web instalable (PWA) para Android, iPhone y PC. **Siempre es gratis y no tiene anuncios. Nada se compra con dinero: todo se gana haciendo.**

## v12: lanzamiento

**Estructura:**

| Ruta | Archivo | Qué es |
|---|---|---|
| `/io/` (o `tudominio.com/`) | `index.html` | Página de inicio |
| `/io/app/` | `app/` | El juego, una PWA instalable |

La página de inicio trae:
- intro de Game Boy, torre 3D con three.js y cámara que sube al hacer scroll;
- tráiler grabado del juego real y el juego en vivo dentro de un celular (modo demo aislado);
- cómo se juega y los controles;
- los mundos;
- la comparación con apps de hábitos y videojuegos;
- las metas y la hoja de ruta;
- ranking en vivo con jugadores reales, instalación, lista de espera (tabla `io_waitlist` en Supabase; sin Supabase, Netlify Forms) y preguntas frecuentes.

**Cuentas reales:**
- Se entra con **Google** o **correo con código de 6 dígitos** (Supabase Auth, sin SDK).
- La partida se guarda en la nube (`io_saves`) y se sincroniza entre dispositivos.
- El nombre de la cuenta es el que sale en el ranking.

**Ranking:**
- Solo jugadores reales: sin bots ni datos de ejemplo.
- Las ligas se mueven cuando hay 10 jugadores o más.

**Bienvenida estilo Duolingo/Finch:**
- 9 pasos con la mascota IO: nombre, personaje, áreas, hábitos, rutina, meta de racha, cuenta y listo.
- **🔑 Tengo un código de partida** trae una partida de otro navegador.

**Modo demo:**
- Se abre con `app/?demo=1`.
- Usa su propio almacenamiento (`io.demo.*`), así que nunca toca tu partida real.

**Idiomas (español / inglés):**
- `app/i18n.js` traduce lo que aparece en pantalla usando un diccionario:
  - `app/i18n-en.js` para el juego;
  - `i18n-landing-en.js` para la página de inicio.
- El código sigue escrito en español. Las frases con partes variables se escriben con `{}`: `"Piso {}": "Floor {}"`.
- **Detección:** usa el idioma que elegiste (`io.lang`), si no el parámetro `?lang=`, y si no el idioma del celular.
- **Al agregar texto nuevo al juego,** agrega su traducción al diccionario. Lo que falte se queda en español; no se rompe nada.

**Para ponerlo en línea con tu dominio: [DEPLOY.md](DEPLOY.md).**

## Cómo funciona

1. **Configuración inicial (4 pasos).** Creas tu personaje y armas tu rutina:
   - Tocas tarjetas por categoría (Mente, Cuerpo, Crecer, Casa y calma) o escribes el tuyo.
   - Hora, minutos y días se eligen con chips.
   - Cada hábito muestra en vivo cómo lo hará tu personaje, y la línea “Tu día” te enseña la rutina completa.
2. **Temporizador obligatorio.** A la hora de tu hábito tocas ▶ y se abre el **modo enfoque** a pantalla completa:
   - Un anillo se va escribiendo en 1 y 0, con una lluvia binaria suave de fondo y el tiempo restante también en binario.
   - Tu personaje hace la actividad mientras corre el reloj.
   - El tiempo se calcula con marcas de tiempo, así que **sigue contando aunque bloquees el celular**. Sirve para leer un libro de papel, ir al gym o a una clase.
   - **Se puede pausar, pero no terminar antes.** Al pausar, IO te recuerda tu motivo. Lo que llevas se guarda.
3. **👑 Corona.** Cuando el reloj llega al final aparece la corona. Al activarla:
   - El personaje celebra en la consola con animación, confeti de unos y ceros y sonido 8-bit.
   - Ganas **XP** y **bits** ◆. Si empezaste a tiempo (±30 min de la hora) ganas +25%, y las rachas suman más.
4. **🎁 Día perfecto.** Si completas todos los hábitos del día, abres el cofre.

## v11: todo lo del plan (menos tiendas)

**Página de lanzamiento** (desde v12 es la página de inicio `/io/`; `/io/lanzamiento/` redirige ahí)
- **Contenido (v11):** cómo instalar gratis (Android, iPhone y computador, con botón de instalar cuando el navegador lo permite), el crowdfunding y la lista de espera.
- **Lista de espera:** usa **Netlify Forms** (formulario `lista-espera`, con anti-spam y código de referido). Las inscripciones se ven en el panel de Netlify → *Forms*.

**En la app:**

| Qué | Cómo funciona |
|---|---|
| ⏱ Reloj dentro del Game Boy | Reloj **ovalado** de unos y ceros y la escena en la misma pantalla. Abajo, donde irían los botones: coach, premio y pausa |
| 📻 Radio | Regalo del nivel 2. 8 estaciones generadas en vivo (lluvia, 8-bit, lo-fi, bosque, olas, cafetería, chimenea, espacio) que se abren por nivel. Se prende en el cuarto con A, desde el reloj o desde Mundo |
| 🔔 Recordatorios | Notificación a la hora (o 5, 10 o 15 min antes), con frases según la actividad |
| 📅 Calendario | Exportar todo a `.ics` con alarma o hábito por hábito a Google Calendar. Al tocar el evento se abre el reloj |
| Atajos del ícono y número de pendientes | Atajos `▶ Próximo hábito`, Tienda y Ranking. Número de pendientes en el ícono. Los enlaces aceptan `?start=` y `?tab=` |
| 📸 Tarjeta para historias | 1080×1920 con tu personaje, tu edificio, tu racha, tus minutos y tus coronas |
| 🔢 Hábitos de conteo | Ej. 8 vasos de agua: un toque por vez, con pausa mínima entre toques; corona al llegar a la meta |
| 🐣 Mascota | Huevo que nace a las 3 coronas y evoluciona a las 15, 45 y 120. Cuatro especies. Se pone triste si fallas, nunca se muere. Vive en el cuarto y te anima en el reloj |
| 🏆 Social | Visitar el cuarto de otros desde el ranking, likes ❤️ semanales, **ligas** de Bronce a Diamante (los 5 primeros suben, los 5 últimos bajan) y **salas para enfocarse juntos** con código o enlace `?sala=`. Sin servidor, el ranking solo te muestra a ti (sin bots) |
| ⏳ Temporadas | Objetos que solo se venden en su mes (Halloween, Navidad, Amor y amistad, Cometas…), marcados LIMITADO |
| 🌧️ Clima real | Opcional, usa Open-Meteo sin llave. Lluvia, nieve, nubes o tormenta en tu ventana, y la temperatura |
| 💜 Diario de ánimo | Después de cada corona, “¿cómo te sentiste?” y una línea. En Progreso ves qué hábitos te hacen bien |
| 🧠 Coach IO | Lee tus últimas 2 semanas y propone ajustes con botón **Aplicar**: hacerlo más pequeño, mover la hora, subirle o proteger la racha |
| 🎮 Temas de consola | Menta, Sandía, Atómico, Medianoche, Oro y Arcoíris, que se abren subiendo de nivel |

Para activar likes y salas, corre el bloque **SOCIAL** de `supabase/schema.sql`.

## v10: cuarto con muebles, ascensor nuevo y modo enfoque vivo

- **Un cuarto de verdad.** Tiene zócalo, techo con lámpara, cortinas, **dos repisas** y un **aparador** bajo la ventana.
  - Lo pequeño (velas, cactus, plantas, laptop, TV, acuario…) va en repisas o en el aparador. En modo decorar se cambia con ▲▼, o arrastrándolo con el dedo.
  - Los cuadros de la pared se ven más grandes.
- **Ascensor nuevo.**
  - Display ámbar que dice dónde estás y a dónde vas.
  - Torre del edificio en corte, con los pisos y el nombre de cada cuarto.
  - Tarjeta del piso elegido: qué hay, o cuánto XP falta para abrirlo.
  - En el viaje, la cabina con tu cara baja o sube por el hueco mientras el display cuenta los pisos.
- **HUD tocable.** Tocar el nivel, la barra de XP, los bits o la racha abre **Tu progreso**: qué es cada cosa, cuánto llevas, cuánto falta para el siguiente piso y cómo se gana.
- **Modo enfoque vivo.**
  - Escenario grande con cielo según la hora.
  - Paisaje en capas para caminar, correr y sacar al perro.
  - Sillón y gato para leer, luz, paloma y velas para orar, escritorio para estudiar y escribir.
  - Rutina que cambia sola para el ejercicio (press, sentadillas, jumping jacks, curl).
  - Contador en vivo (páginas, km, reps, respiraciones) y un **arbolito que crece** con tu progreso.
  - **Coach** en una burbuja grande: hitos (empezar, 1 min, 5 min, 25/50/75%, último minuto, cuenta regresiva) y frases según la actividad.
- **Pop.**
  - Logo IO y etiqueta del Game Boy en colores que cambian, con borde arcoíris en la pantalla.
  - Los bits suben contando.
  - Pantalla de **racha** estilo Duolingo, con la llama y la semana marcada.

## Tu personaje hace tu hábito

Mientras corre el reloj, el personaje hace lo mismo que tú, en **23 escenas** animadas:
- **Mente:** lee, estudia, escribe, trabaja en su laptop, habla otro idioma con burbujas.
- **Calma:** medita con aura, respira con un círculo que guía el ritmo (4 s inhala / 4 s exhala), hace yoga, ora, se desconecta con un té, duerme.
- **Cuerpo:** levanta pesas, corre, camina, **saca al perro** con correa, nada.
- **Casa:** come, cocina, toma agua, barre.
- **Arte:** toca guitarra, pinta en un caballete.

La actividad se detecta sola por el nombre del hábito (“sacar al perro” → 🐕) y se puede cambiar al crear o editar el hábito. Además, el modo enfoque:
- muestra el premio que te espera;
- te anima al 25, 50 y 75%;
- vibra en el celular.

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

## Game Boy avanzado: la segunda pantalla

Debajo de los controles, la consola se abre (bisagra y parlante) y aparece una **segunda pantalla** con cinco pestañas. Se cambian tocando o deslizando, y el menú START también lleva a ellas:

| Pestaña | Qué tiene |
|---|---|
| 🏠 **Hoy** | Hábitos del día con su reloj, cofre, reto semanal y accesos rápidos (oferta, tu puesto en el ranking, colección) |
| 🛒 **Tienda** | Bits y colección, **oferta del día** (−30%, igual para todos, con cuenta regresiva), **caja sorpresa** (◆150: común 60%, raro 28%, épico 10%, legendario 2%), rarezas con brillo, etiquetas NUEVO, ficha de cada objeto con “probar” para la ropa y botón para presumir |
| 🏆 **Ranking** | Top 100 global y semanal (se reinicia el lunes), podio con la cara de cada jugador, títulos por nivel (Novato → Leyenda) y “te faltan X XP para pasar a…” |
| 📈 **Progreso** | Reto semanal (80% de lo programado, premio ◆100 + 50 XP), tu semana, metas del mes por hábito, 12 semanas en 1 y 0, estadísticas y logros |
| 🏢 **Mundo** | Tu personaje y título, la torre del edificio actual (toca un piso para ir), próximas metas y mapa completo |

### Ranking mundial

- Cada jugador entra con una **cuenta anónima de Supabase**: sin correo ni contraseña, solo un nombre público. Unirse es opcional y se puede salir en ⚙️ Ajustes.
- Solo se publica nombre, nivel, XP, XP de la semana, racha y personaje. Nada de los hábitos.
- **Para activarlo:**
  1. En Supabase activa *Authentication → Sign In / Providers → Allow anonymous sign-ins*.
  2. Corre el bloque `io_ranking` de `supabase/schema.sql`.
  3. Pon la URL y la anon key en `io/config.js`.
- La RLS deja leer a todos, pero cada quien solo escribe su propia fila.
- Mientras no esté conectado, el ranking solo te muestra a ti. Nunca hay bots ni personas inventadas (v12).
- **Pendiente para un ranking a prueba de trampas:** validar el XP en el servidor (Edge Function), porque hoy lo calcula el dispositivo.

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

## Ideas tomadas de otros juegos (v9)

| Juego | Idea | En IO |
|---|---|---|
| Finch, Tamagotchi | tu compañero vive contigo lo que haces | el personaje hace tu hábito durante el reloj |
| Duolingo | la racha se protege | 🛡️ **Escudo de racha** (◆120, máx. 2, desde el nivel 3). Se usa solo si fallas un día. Los días sin hábitos programados ya no rompen la racha |
| Pokémon, Candy Crush | tutorial jugando | 🎯 **Primeros pasos**: 5 misiones con premio (primera corona, primera compra, decorar, ranking, racha de 3) |
| Spotify, Forest | la acción principal siempre a mano | **mini reproductor** abajo con tu próximo hábito, el reloj corriendo o la corona lista |
| Forest | anticipar el premio (efecto meta-cercana) | “Al terminar: +XP +◆” y ánimos a mitad del reloj |
| Juegos móviles | respuesta física | vibración al completar y en las misiones |

## Archivos

```
io/
├── index.html      # consola + segunda pantalla (Hoy, Tienda, Ranking, Progreso, Mundo)
├── lower.js        # la segunda pantalla: tienda, caja sorpresa, ranking, progreso, mundo
├── ranking.js      # ranking con login anónimo de Supabase + liga de práctica
├── config.js       # URL y anon key del ranking compartido
├── ui.js           # toast, hojas y utilidades
├── styles.css      # retro moderno: pixel font, scanlines, skins por edificio
├── app.js          # une todo: lista de hábitos, corona, cofre, tienda, mapa, ajustes, demo
├── engine.js       # motor 2D: caminar, ascensor, decorar, menú START, efectos, sonido
├── focus.js        # modo enfoque (anillo 1/0, pausa con motivos, corona)
├── scenes.js       # 23 escenas: el personaje hace tu hábito mientras corre el reloj
├── radio.js        # radio con sonidos generados en vivo
├── remind.js       # recordatorios, calendario .ics / Google, número en el ícono
├── share.js        # tarjeta para historias
├── pet.js          # la mascota que evoluciona
├── social.js       # likes, ligas, salas juntos
├── coach.js        # consejos a partir de tus datos
├── weather.js      # clima real en la ventana
├── lanzamiento/    # página pública: historia, instalar, crowdfunding, lista de espera
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
