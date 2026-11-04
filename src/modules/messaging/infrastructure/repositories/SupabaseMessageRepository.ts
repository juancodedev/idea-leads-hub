import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/infrastructure/database/database.types";
import { NotFoundError } from "@/infrastructure/repositories/errors";
import { Message } from "../../domain/entities/Message";
import { MessageStatus } from "../../domain/enums/MessageStatus";
import { MessageRepository } from "../../domain/ports/MessageRepository";
import { MessageMapper, MessageRow, NewMessage } from "../mappers/MessageMapper";
import { raise, schemaless } from "./supabaseClient";

const TABLE = "messages";

export class SupabaseMessageRepository implements MessageRepository {
  private readonly db: SupabaseClient;

  constructor(client: SupabaseClient<Database>) {
    this.db = schemaless(client);
  }

  async findById(id: string): Promise<Message | null> {
    const { data, error } = await this.db.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) raise("messages.findById", error);
    return data ? MessageMapper.toDomain(data as MessageRow) : null;
  }

  async findByExternalId(externalId: string): Promise<Message | null> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) raise("messages.findByExternalId", error);
    return data ? MessageMapper.toDomain(data as MessageRow) : null;
  }

  async findByConversation(conversationId: string): Promise<Message[]> {
    const { data, error } = await this.db
      .from(TABLE)
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) raise("messages.findByConversation", error);
    return ((data ?? []) as MessageRow[]).map(MessageMapper.toDomain);
  }

  async create(message: NewMessage): Promise<Message> {
    const { data, error } = await this.db
      .from(TABLE)
      .insert(MessageMapper.toInsert(message))
      .select("*")
      .single();
    if (error) raise("messages.create", error);
    return MessageMapper.toDomain(data as MessageRow);
  }

  /**
   * Conditional update (status = 'pending' only), then reads the row back:
   * an echo-adopted `sent` row is returned unchanged (S7).
   */
  async markFailedIfPending(id: string, error: string, hint: string): Promise<Message> {
    const { error: updateError } = await this.db
      .from(TABLE)
      .update({
        status: MessageStatus.FAILED,
        error_message: error,
        hint,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", MessageStatus.PENDING);
    if (updateError) raise("messages.markFailedIfPending", updateError);

    const message = await this.findById(id);
    if (!message) throw new NotFoundError("Message not found");
    return message;
  }
}
