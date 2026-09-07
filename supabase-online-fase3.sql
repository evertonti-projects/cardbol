-- =========================================================
-- CARDBOL ONLINE - FASE 3 BETA
-- PARTIDA SINCRONIZADA + RECONEXÃO + LIMITE DE INTERRUPÇÕES
--
-- Execute TODO este arquivo no SQL Editor do Supabase
-- DEPOIS dos scripts das fases 1 e 2.
-- =========================================================

-- ---------------------------------------------------------
-- 1. NOVOS CAMPOS DA SALA ONLINE
-- ---------------------------------------------------------

alter table public.online_rooms
    drop constraint if exists online_rooms_status_check;

alter table public.online_rooms
    add constraint online_rooms_status_check
    check (status in (
        'waiting',
        'lobby',
        'ready',
        'formation',
        'kickoff',
        'playing',
        'finished',
        'closed'
    ));

alter table public.online_rooms
    add column if not exists game_state jsonb,
    add column if not exists game_revision bigint not null default 0,
    add column if not exists active_player smallint,
    add column if not exists game_started_at timestamptz,

    add column if not exists host_last_seen timestamptz,
    add column if not exists guest_last_seen timestamptz,

    add column if not exists host_disconnected_since timestamptz,
    add column if not exists guest_disconnected_since timestamptz,

    add column if not exists host_interruptions integer not null default 0,
    add column if not exists guest_interruptions integer not null default 0,

    add column if not exists winner_player smallint,
    add column if not exists finish_reason text;


-- Inicializa a presença dos dois jogadores quando a formação começa.
create or replace function public.cardbol_online_seed_presence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.status = 'formation' and old.status is distinct from 'formation' then
        new.host_last_seen := now();
        new.guest_last_seen := case when new.guest_player_id is not null then now() else null end;
        new.host_disconnected_since := null;
        new.guest_disconnected_since := null;
        new.host_interruptions := 0;
        new.guest_interruptions := 0;
        new.winner_player := null;
        new.finish_reason := null;
    end if;
    return new;
end;
$$;

drop trigger if exists cardbol_online_seed_presence_trigger on public.online_rooms;

create trigger cardbol_online_seed_presence_trigger
before update of status on public.online_rooms
for each row
execute function public.cardbol_online_seed_presence();


-- ---------------------------------------------------------
-- 2. MARCAR PARTIDA COMO INICIADA
-- Mesma função da fase 2, agora também prepara sincronização.
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

    update public.online_rooms r
    set status = 'playing',
        active_player = r.kickoff_player,
        game_started_at = coalesce(r.game_started_at, now()),
        game_state = case when r.game_started_at is null then null else r.game_state end,
        game_revision = case when r.game_started_at is null then 0 else r.game_revision end,
        host_last_seen = case
            when r.host_player_id = p_player_id then now()
            else coalesce(r.host_last_seen, now())
        end,
        guest_last_seen = case
            when r.guest_player_id = p_player_id then now()
            when r.guest_player_id is not null then coalesce(r.guest_last_seen, now())
            else r.guest_last_seen
        end,
        winner_player = null,
        finish_reason = null,
        updated_at = now()
    where r.room_code = v_code
      and r.status in ('kickoff','playing')
      and r.kickoff_player in (0,1)
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return query select false, 'ROOM_NOT_AVAILABLE'::text;
        return;
    end if;

    return query select true, 'PLAYING'::text;
end;
$$;


-- ---------------------------------------------------------
-- 3. PRESENÇA / RECONEXÃO
--
-- Um jogador é considerado desconectado após 8 segundos sem
-- sinal. A partir da detecção, possui 30 segundos para voltar.
-- São permitidas NO MÁXIMO 5 interrupções por jogador.
-- Na 6ª interrupção, perde por abandono.
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

    -- O jogador que chamou a função está online novamente.
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

    -- Só fiscaliza queda enquanto existe uma partida em andamento.
    if v_room.status in ('formation','kickoff','playing')
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
-- 4. PUBLICAR ESTADO DA PARTIDA
--
-- Nesta fase beta, apenas o navegador do jogador cuja vez está
-- ativa pode publicar o próximo snapshot do jogo.
-- ---------------------------------------------------------

create or replace function public.cardbol_online_publish_state(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_state jsonb
)
returns table (
    success boolean,
    status text,
    game_revision bigint,
    active_player smallint
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
    v_caller_player smallint;
    v_next_player smallint;
    v_winner smallint;
    v_finish_reason text;
    v_revision bigint;
    v_active smallint;
begin
    v_code := upper(trim(p_room_code));

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text, 0::bigint, null::smallint;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query select false, 'ROOM_NOT_PLAYING'::text, 0::bigint, null::smallint;
        return;
    end if;

    v_caller_player := case
        when v_room.host_player_id = p_player_id then 1
        else 0
    end;

    if v_room.active_player is not null
       and v_room.active_player <> v_caller_player then
        return query
        select false,
               'NOT_YOUR_TURN'::text,
               v_room.game_revision,
               v_room.active_player;
        return;
    end if;

    if p_state is null or jsonb_typeof(p_state) <> 'object' then
        raise exception 'Estado da partida inválido';
    end if;

    if not (p_state ? 'currentPlayer') then
        raise exception 'Estado sem currentPlayer';
    end if;

    v_next_player := (p_state->>'currentPlayer')::smallint;

    if v_next_player not in (0,1) then
        raise exception 'currentPlayer inválido';
    end if;

    v_winner := null;
    if p_state ? 'winner'
       and (p_state->>'winner') is not null
       and (p_state->>'winner') <> ''
       and (p_state->>'winner') <> 'null' then
        v_winner := (p_state->>'winner')::smallint;
    end if;

    if v_winner is not null and v_winner not in (0,1) then
        raise exception 'winner inválido';
    end if;

    v_finish_reason := nullif(p_state->>'matchEndReason','');

    update public.online_rooms r
    set game_state = p_state,
        game_revision = r.game_revision + 1,
        active_player = v_next_player,
        status = case when v_winner is not null then 'finished' else 'playing' end,
        winner_player = coalesce(v_winner, r.winner_player),
        finish_reason = case when v_winner is not null then coalesce(v_finish_reason,'game') else r.finish_reason end,
        host_last_seen = case when v_caller_player = 1 then now() else r.host_last_seen end,
        guest_last_seen = case when v_caller_player = 0 then now() else r.guest_last_seen end,
        updated_at = now()
    where r.id = v_room.id
    returning r.game_revision, r.active_player
    into v_revision, v_active;

    return query
    select true,
           'SYNCED'::text,
           v_revision,
           v_active;
end;
$$;


-- ---------------------------------------------------------
-- 5. LER ESTADO DA PARTIDA
-- Também atualiza a presença do jogador.
-- ---------------------------------------------------------

create or replace function public.cardbol_online_get_game_state(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    room_status text,
    game_revision bigint,
    active_player smallint,
    game_state jsonb,
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
    v_presence record;
    v_room public.online_rooms%rowtype;
    v_code text;
begin
    v_code := upper(trim(p_room_code));

    select *
    into v_presence
    from public.cardbol_online_presence(
        p_player_id,
        p_session_token,
        v_code
    );

    if v_presence.success is not true then
        return query
        select false,
               coalesce(v_presence.status,'INVALID_SESSION')::text,
               null::text,
               0::bigint,
               null::smallint,
               null::jsonb,
               0,0,
               null::timestamptz,null::timestamptz,
               null::smallint,null::text,
               now();
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status in ('playing','finished')
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return query
        select false,'ROOM_NOT_FOUND'::text,
               null::text,0::bigint,null::smallint,null::jsonb,
               0,0,null::timestamptz,null::timestamptz,
               null::smallint,null::text,now();
        return;
    end if;

    return query
    select true,
           'OK'::text,
           v_room.status,
           v_room.game_revision,
           v_room.active_player,
           v_room.game_state,
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
-- 6. PERMISSÕES
-- ---------------------------------------------------------

grant execute
on function public.cardbol_online_presence(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_publish_state(uuid, text, text, jsonb)
to anon, authenticated;

grant execute
on function public.cardbol_online_get_game_state(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_mark_playing(uuid, text, text)
to anon, authenticated;
