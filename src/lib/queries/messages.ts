import { queryAll } from '@/lib/db';
import type {
  MessageThread,
  ResponsePart,
  SessionDetailToolCall,
} from '@/types';

export async function getMessageThread(
  sessionId: string,
): Promise<{ data: MessageThread[] | null; error: string | null }> {
  return queryAll<MessageThread>(`
    SELECT
      t.id AS turn_id,
      t.content AS user_content,
      t.synthetic,
      t.compaction,
      t.undone_at,
      t.time_created AS user_created_at,
      t.turn_duration_ms,
      r.id AS response_id,
      r.model_id,
      r.provider_id,
      r.tokens_in AS tokens_in,
      r.tokens_out,
      r.tokens_reasoning,
      r.cost AS total_cost,
      r.finish,
      r.error_type,
      r.error_message,
      r.time_created AS response_created_at,
      r.time_completed
    FROM turns t
    LEFT JOIN responses r ON r.turn_id = t.id
    WHERE t.session_id = ?
    ORDER BY t.time_created, r.time_created
  `, [sessionId]);
}

export async function getResponsePartsBySession(
  sessionId: string,
): Promise<{ data: ResponsePart[] | null; error: string | null }> {
  return queryAll<ResponsePart>(`
    SELECT
      rp.response_id,
      rp.part_id,
      rp.part_type,
      rp.sort_key,
      rp.content,
      rp.size_bytes
    FROM response_parts rp
    JOIN responses r ON r.id = rp.response_id
    WHERE r.session_id = ?
    ORDER BY r.time_created, r.id, rp.sort_key
  `, [sessionId]);
}

export async function getToolCallDetailsBySession(
  sessionId: string,
): Promise<{ data: SessionDetailToolCall[] | null; error: string | null }> {
  return queryAll<SessionDetailToolCall>(`
    SELECT
      tc.id,
      tc.response_id,
      tc.response_id AS assistant_message_id,
      tc.tool,
      tc.title,
      tc.status,
      tc.error,
      tc.duration_ms,
      in_payload.content AS input_content,
      out_payload.content AS output_content
    FROM tool_calls tc
    LEFT JOIN tool_payloads in_payload
      ON in_payload.tool_call_id = tc.id AND in_payload.payload_type = 'input'
    LEFT JOIN tool_payloads out_payload
      ON out_payload.tool_call_id = tc.id AND out_payload.payload_type = 'output'
    WHERE tc.root_session_id = (
      SELECT root_session_id FROM sessions WHERE id = ?
    )
    ORDER BY COALESCE(tc.started_at, tc.time_updated), tc.id
  `, [sessionId]);
}
