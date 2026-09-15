-- =========================================================
-- CARDBOL ONLINE — LIBERAR FLAMENGO NO SELETOR DE CLUBES
-- Execute todo este arquivo uma única vez no SQL Editor.
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
        'vasco',
        'flamengo'
    ) then
        raise exception 'Clube inválido';
    end if;

    select *
      into v_player
      from public.players p
     where p.id = p_player_id
       and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
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
       set status = case
            when r.guest_player_id is not null
             and r.host_club is not null
             and r.guest_club is not null
            then 'ready'
            else 'lobby'
        end,
        updated_at = now()
     where r.id = v_room.id;

    return query
    select true,
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

grant execute
on function public.cardbol_online_choose_club(uuid, text, text, text)
to anon, authenticated;

notify pgrst, 'reload schema';
