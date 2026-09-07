-- =========================================================
-- CARDBOL ONLINE - FASE 1 / LOBBY 1x1
-- Execute TODO este arquivo no SQL Editor do Supabase.
-- =========================================================

create table if not exists public.online_rooms (
    id uuid primary key default gen_random_uuid(),
    room_code text not null unique,

    status text not null default 'waiting'
        check (status in ('waiting', 'lobby', 'ready', 'closed')),

    host_player_id uuid not null
        references public.players(id)
        on delete cascade,

    guest_player_id uuid
        references public.players(id)
        on delete set null,

    host_username text not null,
    guest_username text,

    host_club text,
    guest_club text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '2 hours')
);

alter table public.online_rooms enable row level security;

revoke all on table public.online_rooms
from anon, authenticated;

create index if not exists online_rooms_code_idx
on public.online_rooms(room_code);

create index if not exists online_rooms_host_idx
on public.online_rooms(host_player_id);

create index if not exists online_rooms_guest_idx
on public.online_rooms(guest_player_id);


-- =========================================================
-- CRIAR SALA
-- =========================================================

create or replace function public.cardbol_online_create_room(
    p_player_id uuid,
    p_session_token text
)
returns table (
    success boolean,
    status text,
    room_id uuid,
    room_code text,
    room_status text,

    host_player_id uuid,
    host_username text,
    host_club text,

    guest_player_id uuid,
    guest_username text,
    guest_club text,

    caller_side text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_code text;
    v_room_id uuid;
    v_try integer;
begin

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash =
          encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    -- Encerra qualquer sala anterior ativa deste jogador.
    update public.online_rooms r
    set status = 'closed',
        updated_at = now()
    where (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
      and r.status in ('waiting', 'lobby', 'ready');

    -- Código hexadecimal curto, 6 caracteres.
    for v_try in 1..20 loop
        v_code := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));

        exit when not exists (
            select 1
            from public.online_rooms r
            where r.room_code = v_code
              and r.status <> 'closed'
              and r.expires_at > now()
        );
    end loop;

    if exists (
        select 1
        from public.online_rooms r
        where r.room_code = v_code
          and r.status <> 'closed'
          and r.expires_at > now()
    ) then
        raise exception 'Não foi possível gerar código único da sala';
    end if;

    insert into public.online_rooms (
        room_code,
        status,
        host_player_id,
        host_username
    )
    values (
        v_code,
        'waiting',
        v_player.id,
        v_player.username
    )
    returning id into v_room_id;

    return query
    select
        true,
        'CREATED'::text,
        r.id,
        r.room_code,
        r.status,
        r.host_player_id,
        r.host_username,
        r.host_club,
        r.guest_player_id,
        r.guest_username,
        r.guest_club,
        'host'::text
    from public.online_rooms r
    where r.id = v_room_id;

end;
$$;


-- =========================================================
-- ENTRAR NA SALA
-- =========================================================

create or replace function public.cardbol_online_join_room(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    room_id uuid,
    room_code text,
    room_status text,

    host_player_id uuid,
    host_username text,
    host_club text,

    guest_player_id uuid,
    guest_username text,
    guest_club text,

    caller_side text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
begin

    v_code := upper(trim(p_room_code));

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash =
          encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'waiting'
      and r.guest_player_id is null
      and r.expires_at > now()
    for update;

    if not found then
        return query
        select false, 'ROOM_NOT_AVAILABLE'::text,
               null::uuid, v_code, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    if v_room.host_player_id = p_player_id then
        return query
        select false, 'CANNOT_JOIN_OWN_ROOM'::text,
               v_room.id, v_room.room_code, v_room.status,
               v_room.host_player_id, v_room.host_username, v_room.host_club,
               v_room.guest_player_id, v_room.guest_username, v_room.guest_club,
               'host'::text;
        return;
    end if;

    -- Encerra outras salas ativas do convidado.
    update public.online_rooms r
    set status = 'closed',
        updated_at = now()
    where (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
      and r.id <> v_room.id
      and r.status in ('waiting', 'lobby', 'ready');

    update public.online_rooms r
    set guest_player_id = v_player.id,
        guest_username = v_player.username,
        guest_club = null,
        status = 'lobby',
        updated_at = now()
    where r.id = v_room.id;

    return query
    select
        true,
        'JOINED'::text,
        r.id,
        r.room_code,
        r.status,
        r.host_player_id,
        r.host_username,
        r.host_club,
        r.guest_player_id,
        r.guest_username,
        r.guest_club,
        'guest'::text
    from public.online_rooms r
    where r.id = v_room.id;

end;
$$;


-- =========================================================
-- CONSULTAR / SINCRONIZAR SALA
-- =========================================================

create or replace function public.cardbol_online_get_room(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    room_id uuid,
    room_code text,
    room_status text,

    host_player_id uuid,
    host_username text,
    host_club text,

    guest_player_id uuid,
    guest_username text,
    guest_club text,

    caller_side text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_code text;
begin

    v_code := upper(trim(p_room_code));

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash =
          encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    return query
    select
        true,
        'OK'::text,
        r.id,
        r.room_code,
        r.status,
        r.host_player_id,
        r.host_username,
        r.host_club,
        r.guest_player_id,
        r.guest_username,
        r.guest_club,
        case
            when r.host_player_id = p_player_id then 'host'
            when r.guest_player_id = p_player_id then 'guest'
            else null
        end::text
    from public.online_rooms r
    where r.room_code = v_code
      and r.status <> 'closed'
      and r.expires_at > now()
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return query
        select false, 'ROOM_NOT_FOUND'::text,
               null::uuid, v_code, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
    end if;

end;
$$;


-- =========================================================
-- ESCOLHER CLUBE
-- =========================================================

create or replace function public.cardbol_online_choose_club(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_club text
)
returns table (
    success boolean,
    status text,
    room_id uuid,
    room_code text,
    room_status text,

    host_player_id uuid,
    host_username text,
    host_club text,

    guest_player_id uuid,
    guest_username text,
    guest_club text,

    caller_side text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
    v_side text;
    v_club text;
begin

    v_code := upper(trim(p_room_code));
    v_club := lower(trim(p_club));

    if v_club not in (
        'barcelona',
        'real-madrid',
        'arsenal',
        'chelsea',
        'bayern-munique',
        'borussia-dortmund',
        'vasco'
    ) then
        raise exception 'Clube inválido';
    end if;

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash =
          encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status in ('waiting', 'lobby', 'ready')
      and r.expires_at > now()
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query
        select false, 'ROOM_NOT_FOUND'::text,
               null::uuid, v_code, null::text,
               null::uuid, null::text, null::text,
               null::uuid, null::text, null::text,
               null::text;
        return;
    end if;

    if v_room.guest_player_id is null then
        return query
        select false, 'WAITING_OPPONENT'::text,
               v_room.id, v_room.room_code, v_room.status,
               v_room.host_player_id, v_room.host_username, v_room.host_club,
               v_room.guest_player_id, v_room.guest_username, v_room.guest_club,
               case when v_room.host_player_id = p_player_id then 'host' else 'guest' end::text;
        return;
    end if;

    if v_room.host_player_id = p_player_id then
        v_side := 'host';

        if v_room.guest_club = v_club then
            return query
            select false, 'CLUB_ALREADY_TAKEN'::text,
                   v_room.id, v_room.room_code, v_room.status,
                   v_room.host_player_id, v_room.host_username, v_room.host_club,
                   v_room.guest_player_id, v_room.guest_username, v_room.guest_club,
                   v_side;
            return;
        end if;

        update public.online_rooms r
        set host_club = v_club,
            updated_at = now()
        where r.id = v_room.id;

    else
        v_side := 'guest';

        if v_room.host_club = v_club then
            return query
            select false, 'CLUB_ALREADY_TAKEN'::text,
                   v_room.id, v_room.room_code, v_room.status,
                   v_room.host_player_id, v_room.host_username, v_room.host_club,
                   v_room.guest_player_id, v_room.guest_username, v_room.guest_club,
                   v_side;
            return;
        end if;

        update public.online_rooms r
        set guest_club = v_club,
            updated_at = now()
        where r.id = v_room.id;
    end if;

    update public.online_rooms r
    set status =
        case
            when r.guest_player_id is not null
             and r.host_club is not null
             and r.guest_club is not null
            then 'ready'
            else 'lobby'
        end,
        updated_at = now()
    where r.id = v_room.id;

    return query
    select
        true,
        'CLUB_SELECTED'::text,
        r.id,
        r.room_code,
        r.status,
        r.host_player_id,
        r.host_username,
        r.host_club,
        r.guest_player_id,
        r.guest_username,
        r.guest_club,
        v_side
    from public.online_rooms r
    where r.id = v_room.id;

end;
$$;


-- =========================================================
-- SAIR DA SALA
-- =========================================================

create or replace function public.cardbol_online_leave_room(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
begin

    v_code := upper(trim(p_room_code));

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash =
          encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status <> 'closed'
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query select true, 'ALREADY_LEFT'::text;
        return;
    end if;

    if v_room.host_player_id = p_player_id then
        update public.online_rooms r
        set status = 'closed',
            updated_at = now()
        where r.id = v_room.id;

    else
        update public.online_rooms r
        set guest_player_id = null,
            guest_username = null,
            guest_club = null,
            status = 'waiting',
            updated_at = now()
        where r.id = v_room.id;
    end if;

    return query select true, 'LEFT'::text;
end;
$$;


-- =========================================================
-- PERMISSÕES RPC
-- =========================================================

grant execute
on function public.cardbol_online_create_room(uuid, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_join_room(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_get_room(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_choose_club(uuid, text, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_leave_room(uuid, text, text)
to anon, authenticated;
