/* IO — configuración pública del despliegue (ver DEPLOY.md).
 * url: https://TU-PROYECTO.supabase.co   key: la "anon public key" del proyecto.
 * La anon key es pública por diseño: la seguridad la ponen las políticas RLS de supabase/schema.sql
 * (solo cuentas reales con Google o correo; cada quien solo escribe lo suyo).
 * Vacío = IO funciona 100% en el celular, sin cuentas ni ranking en línea. */
export const RANKING = { url: '', key: '' };
