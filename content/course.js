// Contenido del curso inicial de Clippers Pro: «Empieza a ganar con tus clips».
// Textos originales de la academia. Para actualizar el curso (nuevos nichos,
// mercado de USA, etc.) se editan las lecciones de este archivo.
// Bloques: {h} subtítulo · {p} párrafo · {list} viñetas · {steps} pasos
// numerados · {tip} consejo · {warn} advertencia. **negrita** con asteriscos.

const COURSE = {
  title: 'Empieza a ganar con tus clips',
  intro:
    'El curso para entrar al mundo del clipping desde cero: eliges tu nicho, ' +
    'preparas tus cuentas, las vinculas a Clippers Pro y envías tu primer clip. ' +
    'Sin experiencia previa. Ve en orden y marca cada lección al terminarla.',
  lessons: [
    {
      id: 'bienvenida',
      title: 'Bienvenida: qué es el clipping y cómo se gana dinero',
      blocks: [
        { p: 'Bienvenido a Clippers Pro. Aquí ganas dinero de una forma sencilla de entender: **las marcas y los artistas necesitan que sus videos se hagan virales**, y pagan por las vistas que generan los clips que publican personas como tú.' },
        { p: 'Ese trabajo se llama **clipping**: tomas el material de una campaña (una canción, un producto, una app), creas clips cortos y atractivos para TikTok o Instagram, los publicas en tus cuentas y **cobras según las vistas que consigas**.' },
        { h: 'Cómo se calcula lo que ganas' },
        { list: [
          'Cada campaña paga una **tarifa por cada 1.000 vistas** (ejemplo: US$1.50 por 1.000 vistas).',
          'Si tu clip llega a 20.000 vistas con esa tarifa, serían US$30.',
          'Cada campaña tiene un **mínimo** (lo que debe pagar como piso por clip) y un **máximo por clip** (el tope, aunque el video explote).',
          'Tus ganancias se acreditan en tu **Billetera** de Clippers Pro y se pagan por **PANA** (en la lección del tour te lo explicamos en detalle).',
        ] },
        { h: 'Qué vas a aprender en este curso' },
        { steps: [
          'Elegir tu nicho (el tipo de contenido al que te vas a dedicar).',
          'Crear y calentar tus cuentas de TikTok e Instagram.',
          'Vincular tus cuentas a Clippers Pro.',
          'Elegir una campaña y entender su brief y sus requisitos.',
          'Publicar y enviar tu primer clip.',
          'Conocer cada rincón de la plataforma y las reglas de oro para crecer.',
        ] },
        { tip: 'No necesitas ser famoso ni tener seguidores para empezar: las cuentas nuevas también viralizan. Lo que necesitas es constancia y seguir el método de este curso.' },
      ],
    },
    {
      id: 'nicho',
      title: 'Elige tu nicho: música, productos o apps',
      blocks: [
        { p: 'El **nicho** es el tema del que tratan tus cuentas. Las cuentas que se especializan en un solo tema crecen más rápido, porque la red social entiende a quién mostrarles el contenido y el público sabe qué esperar de ellas.' },
        { p: 'En Clippers Pro trabajamos, por ahora, tres grandes renglones. Elige **uno** para empezar:' },
        { h: '1. Música (el renglón más fuerte de la plataforma)' },
        { p: 'Clips de canciones y artistas: el momento más emotivo de una presentación, la frase que a todos pone la piel de gallina, la reacción del público, la historia detrás de una canción. Dentro de la música hay sub-nichos; quédate con el género que más escuchas:' },
        { list: [
          '**Pop latino y baladas:** canciones románticas y emotivas, de cantantes solistas con mucha interpretación. Ideal si te gustan los clips que hacen llorar o enamorar.',
          '**Regional mexicano y corridos:** presentaciones en vivo, corridos tumbados y música de banda. Público muy fiel y muy activo.',
          '**Urbano y reguetón:** los estrenos y momentos de los artistas urbanos, perreo y dembow. Ritmo rápido, clips cortos y mucha energía.',
          '**Vallenato y tropical:** música de parranda y nostalgia, muy fuerte en Colombia, la costa y la diáspora latina.',
          '**Rock en español:** las bandas y solistas clásicos del rock latino y sus conciertos en vivo. Público adulto y nostálgico.',
          '**Pop en inglés y dance:** éxitos internacionales y electrónica/pop bailable. Funciona muy bien con ediciones rápidas y tendencias.',
        ] },
        { h: '2. Productos' },
        { p: 'Clips que muestran un producto funcionando: la reseña honesta, la demostración ("mira lo que hace esto"), el antes y el después, la comparativa o el truco que nadie conocía. Funciona el contenido útil y sorprendente, no el anuncio aburrido.' },
        { h: '3. Apps' },
        { p: 'Clips sobre aplicaciones: "la app que necesitas para…", tutoriales cortos, apps de edición, de productividad, de entretenimiento o juegos. Enseña la app resolviendo un problema real en menos de un minuto.' },
        { h: 'Cómo elegir el tuyo' },
        { steps: [
          'Piensa en lo que ya consumes cada día sin que nadie te lo pida: ese contenido es el que podrás crear sin aburrirte.',
          'Entra a la sección **Campañas** y mira qué campañas hay de cada renglón: trabaja donde haya material para ti.',
          'Elige UN nicho (y dentro de música, un sub-nicho) por cuenta. Si más adelante quieres otro tema, abres otra cuenta.',
        ] },
        { tip: 'El mejor nicho no es "el que más paga", es el que combina tres cosas: te gusta, hay campañas de eso y puedes publicar seguido. Este renglón se ampliará: cuando la plataforma abra más mercados y categorías, este curso se actualizará con las nuevas opciones.' },
        { warn: 'No mezcles temas en una misma cuenta (un día música, otro día cocina, otro día fútbol). La red social no sabrá a quién mostrarte y crecerás mucho más lento.' },
      ],
    },
    {
      // Lección preparada para cuando la plataforma abra el mercado de USA.
      // hidden: true → la API no la sirve ni la cuenta en el progreso.
      // Para activarla: quitar esta marca y aplicar un paquete.
      id: 'nicho-usa',
      hidden: true,
      title: 'Los renglones del mercado de USA',
      blocks: [
        { p: 'El mercado de Estados Unidos funciona con la misma lógica de siempre (campañas, clips, vistas, pago por cada 1.000), pero con público, idioma y renglones propios. Estas son las categorías que trabajaremos cuando abras cuentas para ese mercado:' },
        { h: 'Música USA' },
        { list: [
          '**Pop y R&B:** los lanzamientos y momentos de las estrellas del pop y el R&B en inglés.',
          '**Hip-hop y rap:** estrenos, beefs sanos, freestyles y momentos de conciertos. Público rapidísimo y muy comentarista.',
          '**Country:** baladas e historias del country americano; público fiel, adulto y con gran poder de compra.',
          '**Rock y clásicos en inglés:** bandas legendarias y sus momentos en vivo, con mucha nostalgia.',
        ] },
        { h: 'Deportes USA' },
        { p: 'Jugadas históricas y del momento de la NBA, la NFL, la MLB y el soccer (MLS e internacionales). Los clips deportivos viven de la emoción del fan: la reacción y el debate valen tanto como la jugada.' },
        { h: 'Streamers y gaming' },
        { p: 'Los momentos más graciosos o impresionantes de los streamers y creadores de videojuegos en inglés: reacciones, fails y jugadas imposibles, recortados al segundo exacto.' },
        { h: 'Productos y gadgets' },
        { p: 'Reseñas y demostraciones de productos pensados para el público de USA: gadgets, hogar, belleza y "inventos que no sabías que necesitabas". El formato "lo probé por ti" manda.' },
        { h: 'Apps y servicios' },
        { p: 'Apps de finanzas personales, productividad, inteligencia artificial y entretenimiento: tutoriales cortos que resuelven un problema concreto del usuario americano.' },
        { h: 'Qué cambia frente al mercado latino' },
        { list: [
          'El contenido va **en inglés** (o como indique el brief de cada campaña).',
          'Cuentas dedicadas a ese público: no mezcles audiencias en una misma cuenta.',
          'Los horarios de publicación se ajustan a las **zonas horarias de USA**.',
          'Todo lo demás es el mismo método de este curso: calentar, vincular, leer el brief y ser constante.',
        ] },
      ],
    },
    {
      id: 'crear-cuentas',
      title: 'Crea tus cuentas de TikTok e Instagram',
      blocks: [
        { p: 'Con tu nicho elegido, toca crear las cuentas donde publicarás. Puedes usar cuentas que ya tengas **si ya son de ese tema**; si son tus cuentas personales de fotos familiares, mejor abre cuentas nuevas dedicadas al nicho.' },
        { h: 'Paso a paso' },
        { steps: [
          'Descarga TikTok e Instagram (o entra desde tu navegador) y regístrate con un **correo que revises siempre**. Ese correo es la llave de tu negocio: no lo pierdas.',
          'Elige un **nombre de usuario relacionado con tu nicho**: corto, fácil de recordar y sin números raros. Ejemplo de la idea: algo que diga "clips de [tu tema]" en dos o tres palabras.',
          'Pon una **foto de perfil clara** (un logo sencillo o una imagen de tu tema) y escribe una **bio breve** que diga qué publicas: "Clips de baladas que llegan al corazón 🎶".',
          'Deja la cuenta en **pública**: las cuentas privadas no reciben vistas de desconocidos.',
          'Activa la **verificación en dos pasos** en ambas redes. Tus cuentas generarán dinero: protégelas como proteges tu cuenta de banco.',
        ] },
        { tip: 'Empieza con UNA cuenta en UNA red (la que más uses) y domínala. Cuando ya publiques con ritmo, abres la segunda. Muchos clippers trabajan TikTok e Instagram con el mismo contenido.' },
        { warn: 'Nunca compres seguidores ni uses aplicaciones de "seguidores gratis". Las redes lo detectan, tu cuenta queda marcada y tus clips dejan de mostrarse. Los seguidores reales llegan con los clips.' },
      ],
    },
    {
      id: 'calentar-cuentas',
      title: 'Calienta tus cuentas antes de publicar campañas',
      blocks: [
        { p: '**Calentar** una cuenta es prepararla durante sus primeros días para que la red social la trate como la de una persona real y activa, no como una cuenta creada solo para spam. Una cuenta bien calentada recibe muchas más vistas desde su primer clip de campaña.' },
        { h: 'El calentamiento, día a día (3 a 5 días)' },
        { steps: [
          '**Día 1:** completa tu perfil (foto, bio, nombre) y mira videos de tu nicho durante un rato. Dale "me gusta" a los que de verdad te gusten y sigue a 5-10 cuentas de tu tema.',
          '**Días 2 y 3:** sigue consumiendo tu nicho: comenta con opiniones de verdad, guarda videos, comparte alguno. La red está aprendiendo qué te interesa para saber a quién mostrarte.',
          '**Días 3 a 5:** publica tus primeros 2 o 3 videos **propios, sin campaña**: un momento que te guste de tu tema, con un título que despierte curiosidad. Es tu práctica y tu carta de presentación.',
          'Al terminar la semana, tu cuenta ya tiene historial real y está lista para vincularla y trabajar campañas.',
        ] },
        { h: 'Reglas del calentamiento' },
        { list: [
          'Comportamiento de persona real: sesiones normales, sin prisas. Nada de seguir a 200 cuentas en diez minutos.',
          'Nada de publicar 10 videos el primer día ni borrar videos recién subidos.',
          'No pongas enlaces raros en tu bio ni copies la bio de otra cuenta palabra por palabra.',
          'Publica a horas en que tu público está despierto (mediodía y noche suelen funcionar bien en el público latino).',
        ] },
        { tip: 'Piensa en el calentamiento como avisarle a la red social: "esta cuenta es de música romántica y su dueño es un fan de verdad". Todo lo que hagas esos días debe contar esa misma historia.' },
        { warn: 'Si saltas el calentamiento y tu primer video ya es de campaña, es normal que las primeras vistas sean bajísimas. No es castigo: la red aún no sabe quién eres. Calentar bien te ahorra semanas de frustración.' },
      ],
    },
    {
      id: 'vincular-cuenta',
      title: 'Vincula tu cuenta en Clippers Pro',
      blocks: [
        { p: 'Para que tus clips cuenten y te paguen, tu cuenta de TikTok o Instagram debe estar **vinculada** a tu perfil de Clippers Pro. La vinculación demuestra que esa cuenta es tuya. Se hace una sola vez por cuenta.' },
        { h: 'Paso a paso dentro de la app' },
        { steps: [
          'Entra a la sección **Mis cuentas** en el menú de Clippers Pro.',
          'Pulsa agregar cuenta, elige la red (TikTok o Instagram) y **pega el enlace de tu perfil** (el que se abre al tocar "Compartir perfil" en tu red social).',
          'El equipo tomará tu cuenta para procesarla en el sistema. En poco tiempo recibirás en la misma pantalla un **código de verificación**.',
          'Copia ese código y **pégalo en la biografía** de tu cuenta de TikTok o Instagram, tal cual, sin cambiarle nada.',
          'Vuelve a Clippers Pro y pulsa **Confirmar**: avisaste que el código ya está en tu bio.',
          'El equipo verifica tu bio y tu cuenta queda **Verificada**. Desde ese momento ya puedes enviar clips con esa cuenta.',
        ] },
        { h: 'Qué significa cada estado' },
        { list: [
          '**Pendiente:** registraste tu cuenta y aún no llega tu código o falta un paso.',
          '**Código enviado:** ya tienes tu código; falta que lo pegues en tu bio y confirmes.',
          '**Verificada:** todo listo. A trabajar.',
          '**Rechazada:** algo no coincidió (el enlace no era de tu perfil o el código no estaba en la bio). Revisa los datos y vuelve a intentarlo, o pregunta por el chat privado.',
        ] },
        { tip: 'El código en la bio es temporal: cuando tu cuenta aparezca como Verificada, puedes quitarlo de tu biografía.' },
        { warn: 'Vincula SOLO cuentas tuyas. Si registras la cuenta de otra persona, la verificación no pasará y puedes perder tu acceso a la plataforma.' },
      ],
    },
    {
      id: 'elegir-campana',
      title: 'Elige tu primera campaña',
      blocks: [
        { p: 'Las **campañas** son los trabajos disponibles: cada una es un artista, producto o app que paga por los clips que publiques de su material. Están en la sección **Campañas**.' },
        { h: 'Cómo se lee una tarjeta de campaña' },
        { list: [
          '**Tarifa:** lo que paga por cada 1.000 vistas de tus clips.',
          '**Mínimo por clip:** el pago mínimo que asegura la campaña cuando tu clip es aprobado y cumple lo básico.',
          '**Máximo por clip:** el tope de pago de un solo clip, aunque se haga muy viral.',
          '**Presupuesto:** el dinero de la campaña. La barra te muestra lo **Disponible** (lo que queda para clips nuevos) y lo **Reservado** (lo que ya está apartado en clips en revisión).',
          '**Plataforma:** dónde deben publicarse los clips (TikTok, Instagram o ambas). ¡Ojo! Un clip en la red equivocada puede no contar.',
          '**Fecha límite:** el último día para participar.',
        ] },
        { h: 'Cómo elegir bien la primera' },
        { steps: [
          'Filtra por tu nicho: trabaja campañas del tema de tu cuenta.',
          'Prefiere campañas con presupuesto disponible sano (la barra casi llena) y fecha límite lejana.',
          'Empieza con UNA sola campaña y publica varios clips de ella antes de abrir otra. Conocerás su material y tu público.',
          'Abre la campaña y lee su brief completo ANTES de crear nada (siguiente lección).',
        ] },
        { tip: 'Una tarifa altísima no siempre conviene más: una campaña de tu nicho con tarifa normal te dará más vistas, porque tu público y el algoritmo ya están alineados con ese contenido.' },
      ],
    },
    {
      id: 'brief-requisitos',
      title: 'Lee el brief y los requisitos (aquí se ganan o se pierden los clips)',
      blocks: [
        { p: 'Cada campaña tiene una página con su **brief**: las instrucciones exactas de qué material usar, cómo debe ser tu clip y qué reglas cumplir para que sea **aprobado y pagado**. La mayoría de los clips rechazados no fallan por malos: fallan por no leer el brief.' },
        { h: 'Lo que debes revisar siempre' },
        { list: [
          '**El material indicado:** muchas campañas dan el video o el audio exacto que debes usar. Si el brief lo indica, usa ESE material, no otro parecido.',
          '**Audio original de la campaña:** cuando se pide, el clip debe llevar el sonido oficial que marca la campaña en la red social.',
          '**Menciones y hashtags obligatorios:** la cuenta que debes etiquetar y los # que deben ir en tu publicación, escritos igual que en el brief.',
          '**Duración mínima:** algunos clips deben durar un mínimo de segundos para contar.',
          '**Interacción mínima (engagement):** algunas campañas exigen que el clip alcance un porcentaje mínimo de interacción (me gusta, comentarios y compartidos frente a las vistas).',
          '**Plazo de envío:** después de publicar, tienes un tiempo máximo para registrar tu clip en Clippers Pro. No lo dejes para después.',
        ] },
        { h: 'Errores que causan rechazo' },
        { list: [
          'Publicar en la red social equivocada (la campaña era solo TikTok y el clip fue a Instagram).',
          'Usar otro audio o recortar el material por donde no era.',
          'Olvidar la mención o escribir mal un hashtag obligatorio.',
          'Subir el clip con marcas de agua de otras aplicaciones o con muy baja calidad.',
          'Registrar el enlace tarde o registrar un enlace que no es el del clip.',
        ] },
        { tip: 'Antes de publicar, repasa el brief como una lista de chequeo, punto por punto. Treinta segundos de revisión valen más que un clip entero rechazado.' },
      ],
    },
    {
      id: 'primer-clip',
      title: 'Crea y envía tu primer clip',
      blocks: [
        { p: 'Llegó el momento. Ya tienes cuenta calentada y vinculada, campaña elegida y brief leído. Así se crea y se envía un clip completo:' },
        { h: 'Crear el clip' },
        { steps: [
          'Elige **el momento más fuerte** del material: la frase que emociona, el coro, la reacción, el instante sorprendente. Si nada te mueve en los primeros 3 segundos, al público tampoco.',
          'Abre con un **gancho**: una pregunta, una frase en pantalla o el momento cumbre al inicio. Tienes 2-3 segundos para que no deslicen al siguiente video.',
          'Agrega **subtítulos** a lo que se dice o se canta: muchísima gente ve los videos sin sonido.',
          'Cuida lo básico: buena calidad de imagen, sin marcas de agua ajenas, y la duración que pide el brief.',
          'Publica en la red y plataforma correctas, con la **mención, los hashtags y el audio** que exige la campaña.',
        ] },
        { h: 'Enviar el clip en Clippers Pro' },
        { steps: [
          'Copia el **enlace de tu publicación** (en tu red social: Compartir → Copiar enlace).',
          'En Clippers Pro, entra a la campaña y pulsa **Enviar un clip** (o usa el botón de enviar de la tarjeta).',
          'Pega el enlace, revisa que sea el de ESE clip y confirma el envío.',
          'Tu clip aparece en **Mis clips** con estado **Pendiente**: el equipo lo revisa contra la campaña.',
        ] },
        { h: 'Qué pasa después' },
        { list: [
          '**Aprobado:** tu clip cumplió todo. Las ganancias se acreditan en tu Billetera según las vistas que vaya sumando.',
          '**Rechazado:** el aviso te dirá el motivo. Léelo, aprende y corrige en el siguiente: un rechazo no es un castigo, es información.',
          'Mientras tanto, sigue publicando: la constancia es la que hace crecer las vistas de toda tu cuenta.',
        ] },
        { tip: 'Tu primer clip no tiene que ser viral: tiene que existir. La mayoría de los clippers que ganan bien empezaron con clips de pocas vistas y una racha diaria de publicación.' },
      ],
    },
    {
      id: 'tour',
      title: 'Tour por Clippers Pro: qué es cada cosa',
      blocks: [
        { p: 'Un paseo rápido por tu plataforma, sección por sección, para que nunca te pierdas:' },
        { list: [
          '**Campañas:** los trabajos disponibles. Cada tarjeta resume tarifa, mínimo, máximo y presupuesto. Al abrir una campaña ves su brief completo y el botón para enviar tu clip.',
          '**Mis clips:** todos los clips que has enviado, con su estado (Pendiente, Aprobado o Rechazado), sus vistas y lo que van generando. Aquí ves crecer tu trabajo.',
          '**Mis cuentas:** tus cuentas de TikTok e Instagram vinculadas y su estado de verificación. Aquí agregas cuentas nuevas.',
          '**Billetera:** tu dinero. **Disponible** (listo para cobrar), **Retenido** (ganancias recientes en periodo de seguridad de 14 días; al cumplirse, pasan a Disponible), **Total ganado** y tus movimientos. Aquí también registras tu cuenta **PANA**, que es por donde recibes tus pagos.',
          '**Chat → Comunidad:** la sala de todos los clippers: dudas, logros y avisos. Puedes reaccionar a los mensajes y responder citando.',
          '**Chat → Privado con el equipo:** tu conversación directa y privada con el equipo de Clippers Pro para temas de tu cuenta, tus pagos o un clip puntual.',
          '**La campana de notificaciones:** ahí llegan los avisos importantes: clips aprobados o rechazados, ganancias acreditadas y anuncios. Revísala a diario.',
          '**Cursos:** esta academia. Vuelve cuando quieras repasar una lección: tu progreso se guarda.',
        ] },
        { tip: 'Tu rutina ideal: entra, mira la campana, revisa cómo van tus clips en Mis clips, pasa por Campañas a ver qué hay nuevo y publica. Diez minutos que mantienen tu negocio en orden.' },
      ],
    },
    {
      id: 'reglas-de-oro',
      title: 'Reglas de oro del clipper que gana',
      blocks: [
        { p: 'Cierre del curso: los hábitos que separan a los que ganan de los que se rinden en la primera semana.' },
        { list: [
          '**Constancia sobre perfección:** vale más publicar un clip bueno cada día que un clip "perfecto" cada dos semanas. El algoritmo premia a las cuentas activas.',
          '**Un nicho por cuenta, siempre.** Tu especialización es tu ventaja.',
          '**El brief manda:** antes de crear cualquier clip, su brief. Sin excepciones.',
          '**Mira tus números:** en Mis clips observa qué clips consiguen más vistas e interacción, y haz más de eso. Tus propios datos son tu mejor maestro.',
          '**Un clip rechazado no es el final:** lee el motivo, corrige y sigue. Todos los clippers tienen rechazos.',
          '**Paciencia con cuentas nuevas:** las vistas suelen despegar después de varias publicaciones. No juzgues una cuenta por sus primeros tres clips.',
          '**Cuida tus cuentas:** nada de seguidores comprados, bots ni trucos raros. Una cuenta sancionada no genera nada.',
          '**Pregunta:** la comunidad y el chat privado con el equipo están para eso. Nadie crece solo.',
        ] },
        { tip: 'Ya tienes el mapa completo: nicho, cuentas, calentamiento, vinculación, campañas, brief, tu primer clip y tu plataforma. Ahora es tu turno: termina de marcar las lecciones, vincula tu cuenta y envía hoy tu primer clip. ¡A ganar!' },
      ],
    },
  ],
};

module.exports = { COURSE };
