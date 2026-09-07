-- =========================================================
-- CARDBOL ONLINE - CORREÇÃO FASE 3
-- Corrige falso abandono durante formação/roleta.
-- Execute TODO este arquivo no SQL Editor do Supabase.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Presença / reconexão
-- IMPORTANTE: interrupções só contam com status = 'playing'.
-- Formação e roleta nunca podem gerar derrota por abandono.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_presence(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    room_status text,
    caller_side text,
    host_interruptions integer,
    guest_interruptions integer,
    host_disconnected_since timestamptz,
    guest_disconnected_since timestamptz,
    winner_player smallint,
    finish_reason text,
    server_now timestamptz
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
    v_new_interruptions integer;
begin
    v_code := upper(trim(p_room_code));

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text,
               null::text, null::text,
               0, 0,
               null::timestamptz, null::timestamptz,
               null::smallint, null::text, now();
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
        return query
        select false, 'ROOM_NOT_FOUND'::text,
               null::text, null::text,
               0, 0,
               null::timestamptz, null::timestamptz,
               null::smallint, null::text, now();
        return;
    end if;

    v_side := case
        when v_room.host_player_id = p_player_id then 'host'
        else 'guest'
    end;

    -- Quem chamou está online. Durante formação/roleta isso é apenas heartbeat.
    if v_side = 'host' then
        update public.online_rooms r
        set host_last_seen = now(),
            host_disconnected_since = null,
            updated_at = now()
        where r.id = v_room.id;
    else
        update public.online_rooms r
        set guest_last_seen = now(),
            guest_disconnected_since = null,
            updated_at = now()
        where r.id = v_room.id;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.id = v_room.id
    for update;

    -- REGRA OFICIAL:
    -- Reconexão de 30s e limite de 5 interrupções só existem
    -- depois que a partida entrou efetivamente em 'playing'.
    if v_room.status = 'playing'
       and v_room.guest_player_id is not null then

        if v_side = 'host' then

            if v_room.guest_last_seen is not null
               and v_room.guest_last_seen < now() - interval '8 seconds'
               and v_room.guest_disconnected_since is null then

                v_new_interruptions := v_room.guest_interruptions + 1;

                update public.online_rooms r
                set guest_disconnected_since = now(),
                    guest_interruptions = v_new_interruptions,
                    updated_at = now(),
                    status = case when v_new_interruptions > 5 then 'finished' else r.status end,
                    winner_player = case when v_new_interruptions > 5 then 1 else r.winner_player end,
                    finish_reason = case when v_new_interruptions > 5 then 'interruptions' else r.finish_reason end
                where r.id = v_room.id;
            end if;

            select * into v_room
            from public.online_rooms r
            where r.id = v_room.id
            for update;

            if v_room.status <> 'finished'
               and v_room.guest_disconnected_since is not null
               and now() >= v_room.guest_disconnected_since + interval '30 seconds' then

                update public.online_rooms r
                set status = 'finished',
                    winner_player = 1,
                    finish_reason = 'reconnect_timeout',
                    updated_at = now()
                where r.id = v_room.id;
            end if;

        else

            if v_room.host_last_seen is not null
               and v_room.host_last_seen < now() - interval '8 seconds'
               and v_room.host_disconnected_since is null then

                v_new_interruptions := v_room.host_interruptions + 1;

                update public.online_rooms r
                set host_disconnected_since = now(),
                    host_interruptions = v_new_interruptions,
                    updated_at = now(),
                    status = case when v_new_interruptions > 5 then 'finished' else r.status end,
                    winner_player = case when v_new_interruptions > 5 then 0 else r.winner_player end,
                    finish_reason = case when v_new_interruptions > 5 then 'interruptions' else r.finish_reason end
                where r.id = v_room.id;
            end if;

            select * into v_room
            from public.online_rooms r
            where r.id = v_room.id
            for update;

            if v_room.status <> 'finished'
               and v_room.host_disconnected_since is not null
               and now() >= v_room.host_disconnected_since + interval '30 seconds' then

                update public.online_rooms r
                set status = 'finished',
                    winner_player = 0,
                    finish_reason = 'reconnect_timeout',
                    updated_at = now()
                where r.id = v_room.id;
            end if;

        end if;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.id = v_room.id;

    return query
    select true,
           'OK'::text,
           v_room.status,
           v_side,
           v_room.host_interruptions,
           v_room.guest_interruptions,
           v_room.host_disconnected_since,
           v_room.guest_disconnected_since,
           v_room.winner_player,
           v_room.finish_reason,
           now();
end;
$$;


-- ---------------------------------------------------------
-- 2. Início efetivo da partida
-- Zera a fiscalização de presença quando a partida começa.
-- Nada ocorrido no lobby/formação/roleta entra no contador.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_mark_playing(
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
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status in ('kickoff','playing')
      and r.kickoff_player in (0,1)
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query select false, 'ROOM_NOT_AVAILABLE'::text;
        return;
    end if;

    -- Primeira transição real para playing: começa uma fiscalização limpa.
    if v_room.status = 'kickoff' then
        update public.online_rooms r
        set status = 'playing',
            active_player = r.kickoff_player,
            game_started_at = now(),
            game_state = null,
            game_revision = 0,

            host_last_seen = now(),
            guest_last_seen = case when r.guest_player_id is not null then now() else null end,
            host_disconnected_since = null,
            guest_disconnected_since = null,
            host_interruptions = 0,
            guest_interruptions = 0,

            winner_player = null,
            finish_reason = null,
            updated_at = now()
        where r.id = v_room.id;

        return query select true, 'PLAYING'::text;
        return;
    end if;

    -- O segundo navegador pode chegar aqui alguns instantes depois.
    -- Não reinicia a partida nem zera contadores novamente.
    if v_room.host_player_id = p_player_id then
        update public.online_rooms r
        set host_last_seen = now(), updated_at = now()
        where r.id = v_room.id;
    else
        update public.online_rooms r
        set guest_last_seen = now(), updated_at = now()
        where r.id = v_room.id;
    end if;

    return query select true, 'ALREADY_PLAYING'::text;
end;
$$;

grant execute
on function public.cardbol_online_presence(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_mark_playing(uuid, text, text)
to anon, authenticated;
