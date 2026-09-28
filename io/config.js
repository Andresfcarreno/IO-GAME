/* IO — configuración pública del despliegue.
 * RANKING: proyecto Supabase compartido por todos los jugadores (corre supabase/schema.sql y
 * activa Authentication → Sign In / Providers → "Allow anonymous sign-ins").
 * La anon key es pública por diseño: la seguridad la ponen las políticas RLS de io_ranking
 * (cada quien solo puede escribir su propia fila). Si lo dejas vacío, se usa la conexión de
 * ⚙️ Ajustes; si tampoco hay, IO muestra la liga de práctica con bots 🤖. */
export const RANKING = { url: '', key: '' };
