-- session-rotate.lua
-- Atomic refresh token rotation with theft detection.
-- KEYS[1] = session:{old_jti}
-- KEYS[2] = session:{new_jti}
-- KEYS[3] = revoked:{old_jti}
-- KEYS[4] = family:{token_family}
-- ARGV[1] = expected_generation
-- ARGV[2] = new_session_json
-- ARGV[3] = ttl_seconds
-- ARGV[4] = remaining_lifetime_seconds (for revoked TTL)
-- ARGV[5] = new_jti
-- Returns : "OK" on success, "REPLAY" on theft detection, "NOT_FOUND" on missing

local oldRaw = redis.call('GET', KEYS[1])
if oldRaw == false then
  return 'NOT_FOUND'
end

local oldSession = cjson.decode(oldRaw)
local expectedGen = tonumber(ARGV[1])

if oldSession.refresh_generation ~= expectedGen then
  return 'REPLAY'
end

redis.call('DEL', KEYS[1])
redis.call('SET', KEYS[3], '1', 'EX', tonumber(ARGV[4]))
redis.call('SET', KEYS[2], ARGV[2], 'EX', tonumber(ARGV[3]))
redis.call('SADD', KEYS[4], ARGV[5])
redis.call('EXPIRE', KEYS[4], tonumber(ARGV[3]))

return 'OK'
