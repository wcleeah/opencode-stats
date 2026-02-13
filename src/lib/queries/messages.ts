import { queryAll } from '@/lib/db';
import type { MessageThread, ToolCall, ToolCallDetail } from '@/types';

export async function getMessageThread(
  sessionId: string,
): Promise<{ data: MessageThread[] | null; error: string | null }> {
  return queryAll<MessageThread>(`
    SELECT
      um.id AS user_message_id,
      um.content AS user_content,
      um.synthetic,
      um.compaction,
      um.undone_at,
      um.created_at AS user_created_at,
      um.turn_duration_ms,
      am.id AS assistant_message_id,
      am.model_id,
      am.tokens_in,
      am.tokens_out,
      am.tokens_reasoning,
      am.cost,
      am.finish,
      am.error_type,
      am.error_message,
      am.created_at AS assistant_created_at,
      am.completed_at,
      ab.content AS assistant_text
    FROM user_messages um
    LEFT JOIN assistant_messages am ON am.user_message_id = um.id
    LEFT JOIN assistant_blobs ab
      ON ab.assistant_message_id = am.id AND ab.blob_type = 'text'
    WHERE um.session_id = ?
    ORDER BY um.created_at, am.created_at
  `, [sessionId]);
}

export async function getToolCallsForSession(
  sessionId: string,
): Promise<{ data: ToolCall[] | null; error: string | null }> {
  return queryAll<ToolCall>(`
    WITH RECURSIVE subtree AS (
      SELECT id
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      tc.id,
      tc.step_id,
      tc.session_id,
      tc.call_id,
      tc.tool,
      tc.status,
      tc.title,
      tc.error,
      tc.compacted_at,
      tc.started_at,
      tc.completed_at,
      tc.duration_ms
    FROM tool_calls tc
    JOIN subtree st ON st.id = tc.session_id
    ORDER BY tc.started_at
  `, [sessionId]);
}

export async function getToolCallDetailsBySession(
  sessionId: string,
): Promise<{ data: ToolCallDetail[] | null; error: string | null }> {
  return queryAll<ToolCallDetail>(`
    WITH RECURSIVE subtree AS (
      SELECT id
      FROM sessions
      WHERE id = ?

      UNION ALL

      SELECT s.id
      FROM sessions s
      JOIN subtree st ON s.parent_id = st.id
    )
    SELECT
      tc.id,
      st.assistant_message_id,
      tc.tool,
      tc.title,
      tc.status,
      tc.error,
      tc.duration_ms,
      tcb_in.content AS input_content,
      tcb_out.content AS output_content
    FROM tool_calls tc
    JOIN steps st ON st.id = tc.step_id
    LEFT JOIN tool_call_blobs tcb_in
      ON tcb_in.tool_call_id = tc.id AND tcb_in.blob_type = 'tool_input'
    LEFT JOIN tool_call_blobs tcb_out
      ON tcb_out.tool_call_id = tc.id AND tcb_out.blob_type = 'tool_output'
    JOIN subtree sub ON sub.id = tc.session_id
    ORDER BY tc.started_at
  `, [sessionId]);
}
