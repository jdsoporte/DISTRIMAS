-- DISTRIMAS: el dashboard pide todo en UN solo viaje (antes eran 9 consultas en 2 tandas).
-- Devuelve las tarjetas, ranking, grafica de 30 dias, ultimos pedidos, ofertas y tops del mes.
-- Solo lectura. Se puede correr varias veces sin problema.

create or replace function public.dashboard_resumen(p_usuario_id uuid)
returns json
language sql
stable
set search_path = public
as $$
  with
  fechas as (
    select
      (now() at time zone 'America/Bogota')::date as hoy,
      date_trunc('month', now() at time zone 'America/Bogota')::date as inicio_mes
  ),
  limites as (
    select
      (hoy::timestamp)                      at time zone 'America/Bogota' as t_hoy,
      ((hoy + 1)::timestamp)                at time zone 'America/Bogota' as t_manana,
      ((hoy - 1)::timestamp)                at time zone 'America/Bogota' as t_ayer,
      (inicio_mes::timestamp)               at time zone 'America/Bogota' as t_mes,
      ((hoy - 30)::timestamp)               at time zone 'America/Bogota' as t_30
    from fechas
  ),
  sesion as (
    select
      coalesce((select pf.nombre = 'Administrador'
                from usuarios u join perfiles pf on pf.id = u.perfil_id
                where u.id = p_usuario_id), false) as es_admin
  ),
  -- Pedidos "mios": el admin ve todos, el vendedor solo los suyos
  mios as (
    select p.* from pedidos p, sesion s
    where s.es_admin or p_usuario_id is null or p.usuario_id = p_usuario_id
  ),
  -- Pedidos del mes de TODO el equipo (para el ranking)
  mes_todos as (
    select p.total, p.usuario_id, p.cliente_id, coalesce(u.nombre, 'Desconocido') as vendedor
    from pedidos p
    left join usuarios u on u.id = p.usuario_id
    , limites l
    where p.created_at >= l.t_mes and p.estado <> 'cancelado'
  ),
  mes_mios as (
    select m.* from mes_todos m, sesion s
    where s.es_admin or p_usuario_id is null or m.usuario_id = p_usuario_id
  ),
  mes_mios_det as (
    select p.id, p.total, p.cliente_id from mios p, limites l
    where p.created_at >= l.t_mes and p.estado <> 'cancelado'
  )
  select json_build_object(
    'es_admin', (select es_admin from sesion),
    'pedidos_hoy',  (select count(*) from mios p, limites l where p.created_at >= l.t_hoy  and p.created_at < l.t_manana),
    'pedidos_ayer', (select count(*) from mios p, limites l where p.created_at >= l.t_ayer and p.created_at < l.t_hoy),
    'ventas_mes',        (select coalesce(sum(total), 0) from mes_mios),
    'tiendas_visitadas', (select count(distinct cliente_id) from mes_mios),
    'tiendas_activas',   (select count(*) from clientes where activo = true),
    'agotados', case when (select es_admin from sesion)
                     then (select count(*) from productos where activo = true and stock <= 0)
                     else 0 end,
    'top_vendedores', coalesce((
      select json_agg(t order by t.total desc) from (
        select vendedor as nombre, sum(coalesce(total, 0)) as total, count(*) as cantidad
        from mes_todos group by vendedor order by 2 desc limit 5
      ) t), '[]'),
    'pedidos_30', coalesce((
      select json_agg(d order by d.dia) from (
        select to_char((p.created_at at time zone 'America/Bogota')::date, 'YYYY-MM-DD') as dia, count(*) as pedidos
        from mios p, limites l
        where p.created_at >= l.t_30 and p.estado <> 'cancelado'
        group by 1
      ) d), '[]'),
    'recientes', coalesce((
      select json_agg(r order by r.created_at desc) from (
        select p.id, p.total, p.estado, p.created_at,
               json_build_object('nombre', c.nombre) as cliente,
               json_build_object('nombre', u.nombre) as usuario
        from mios p
        left join clientes c on c.id = p.cliente_id
        left join usuarios u on u.id = p.usuario_id
        order by p.created_at desc limit 5
      ) r), '[]'),
    'ofertas', case when (select es_admin from sesion) then '[]'::json else coalesce((
      select json_agg(o order by o.nombre) from (
        select id, codigo, nombre, precio from productos where activo = true and oferta = true
      ) o), '[]') end,
    'top_tiendas', coalesce((
      select json_agg(t order by t.total desc) from (
        select coalesce(c.nombre, 'Desconocida') as nombre, coalesce(max(c.municipio), '') as municipio,
               sum(coalesce(m.total, 0)) as total, count(*) as cantidad
        from mes_mios_det m left join clientes c on c.id = m.cliente_id
        group by 1 order by 3 desc limit 5
      ) t), '[]'),
    'top_productos', coalesce((
      select json_agg(t order by t.total desc) from (
        select coalesce(pr.nombre, 'Desconocido') as nombre,
               sum(i.cantidad * i.precio_unitario) as total, sum(i.cantidad) as cantidad
        from mes_mios_det m
        join pedido_items i on i.pedido_id = m.id
        left join productos pr on pr.id = i.producto_id
        group by 1 order by 2 desc limit 5
      ) t), '[]')
  );
$$;

revoke execute on function public.dashboard_resumen(uuid) from public;
grant execute on function public.dashboard_resumen(uuid) to anon, authenticated, service_role;

-- Que PostgREST vea la funcion nueva sin reiniciarlo
notify pgrst, 'reload schema';
