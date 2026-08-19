-- EVERYTHING evaluator inspection query
-- Run from the repository root:
--   sqlite3 -header -column app.db < scripts/check_logs.sql
--
-- This intentionally excludes users.password_hash.
SELECT
    users.id AS user_id,
    users.username,
    users.email,
    chat_sessions.id AS session_id,
    chat_sessions.title,
    chat_sessions.created_at AS session_created_at,
    chat_sessions.updated_at AS session_updated_at,
    messages.id AS message_id,
    messages.role,
    messages.content,
    messages.request_id,
    messages.status,
    messages.latency_ms,
    messages.created_at
FROM messages
JOIN chat_sessions
  ON messages.session_id = chat_sessions.id
JOIN users
  ON chat_sessions.user_id = users.id
ORDER BY messages.created_at DESC, messages.id DESC;
