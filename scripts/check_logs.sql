-- EVERYTHING evaluator inspection query
-- Run from the repository root:
--   sqlite3 -header -column app.db < scripts/check_logs.sql
--
-- This intentionally excludes users.password_hash.
SELECT
    users.username,
    chat_sessions.id AS session_id,
    chat_sessions.title,
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
ORDER BY messages.created_at DESC, messages.id DESC
LIMIT 50;
