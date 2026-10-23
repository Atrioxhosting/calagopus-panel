-- Run after the game IPv6 migration in a disposable transaction/database.
-- Uses an existing development node; all test data is rolled back by the caller.
DO $$
DECLARE n uuid; owner uuid := gen_random_uuid(); collided boolean := false;
BEGIN
  SELECT uuid INTO STRICT n FROM nodes LIMIT 1;
  INSERT INTO game_ipv6_addresses(address,node_uuid,server_uuid)
    VALUES ('2001:db8:feed:abcd::2',n,owner);
  BEGIN
    INSERT INTO game_ipv6_addresses(address,node_uuid,server_uuid)
      VALUES ('2001:db8:feed:abcd::2',n,gen_random_uuid());
  EXCEPTION WHEN unique_violation THEN collided := true;
  END;
  IF NOT collided THEN RAISE EXCEPTION 'Duplicate full IPv6 reservation was accepted'; END IF;
  INSERT INTO game_ipv6_servers(server_uuid,node_uuid,desired,kind)
    VALUES(owner,n,'2001:db8:feed:abcd::2','rotate');
  BEGIN
    DELETE FROM game_ipv6_addresses WHERE server_uuid=owner;
    RAISE EXCEPTION 'Referenced desired address was released';
  EXCEPTION WHEN foreign_key_violation OR restrict_violation THEN NULL;
  END;
  INSERT INTO game_ipv6_addresses(address,node_uuid,server_uuid)
    VALUES ('2001:db8:feed:abcd::3',n,owner);
  UPDATE game_ipv6_servers SET applied=desired,desired='2001:db8:feed:abcd::3',pending=true WHERE server_uuid=owner;
  IF (SELECT count(*) FROM game_ipv6_addresses WHERE server_uuid=owner)<>2 THEN
    RAISE EXCEPTION 'Old address lost while rotation is pending';
  END IF;
  IF (SELECT last_rotation FROM game_ipv6_servers WHERE server_uuid=owner) IS NOT NULL THEN
    RAISE EXCEPTION 'Unconfirmed rotation consumed the cooldown';
  END IF;
END $$;
