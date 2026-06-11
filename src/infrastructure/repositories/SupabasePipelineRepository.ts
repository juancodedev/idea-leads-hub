import { SupabaseClient } from '@supabase/supabase-js';
import { Pipeline, PipelineStage, CreatePipelineDTO, CreatePipelineStageDTO } from "../../core/domain/Pipeline";
import { PipelineRepository } from "../../core/ports/PipelineRepository";
import { Database } from "../database/database.types";

type PipelineRow = Database['public']['Tables']['pipelines']['Row'];
type PipelineStageRow = Database['public']['Tables']['pipeline_stages']['Row'];

// PostgREST join shape
interface PipelineWithStages extends PipelineRow {
  pipeline_stages?: PipelineStageRow[];
}

export class SupabasePipelineRepository implements PipelineRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getAll(): Promise<Pipeline[]> {
    const { data, error } = await this.supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as PipelineWithStages[];
    return rows.map(row => this.mapPipelineToDomain(row, row.pipeline_stages));
  }

  async getById(id: string): Promise<Pipeline | null> {
    const { data, error } = await this.supabase
      .from('pipelines')
      .select('*, pipeline_stages(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const row = data as unknown as PipelineWithStages | null;
    return row ? this.mapPipelineToDomain(row, row.pipeline_stages) : null;
  }

  async create(pipeline: CreatePipelineDTO): Promise<Pipeline> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('pipelines')
      .insert([{
        name: pipeline.name,
        description: pipeline.description ?? null,
        user_id: userData.user.id
      }] as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapPipelineToDomain(data as unknown as PipelineRow);
  }

  async update(id: string, pipeline: Partial<CreatePipelineDTO>): Promise<Pipeline> {
    const { data, error } = await this.supabase
      .from('pipelines')
      .update(pipeline as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapPipelineToDomain(data as unknown as PipelineRow);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pipelines')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async getStages(pipelineId: string): Promise<PipelineStage[]> {
    const { data, error } = await this.supabase
      .from('pipeline_stages')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('position', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(this.mapStageToDomain);
  }

  async createStage(stage: CreatePipelineStageDTO): Promise<PipelineStage> {
    const { data: userData } = await this.supabase.auth.getUser();
    if (!userData.user) throw new Error('Usuario no autenticado');

    const { data, error } = await this.supabase
      .from('pipeline_stages')
      .insert([{
        pipeline_id: stage.pipelineId,
        name: stage.name,
        position: stage.position,
        color: stage.color,
        is_closed: stage.isClosed,
        is_won: stage.isWon,
        user_id: userData.user.id
      }] as never)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapStageToDomain(data as unknown as PipelineStageRow);
  }

  async updateStage(id: string, stage: Partial<CreatePipelineStageDTO>): Promise<PipelineStage> {
    const dbUpdates: Record<string, unknown> = {};
    if (stage.name) dbUpdates.name = stage.name;
    if (stage.position !== undefined) dbUpdates.position = stage.position;
    if (stage.color) dbUpdates.color = stage.color;
    if (stage.isClosed !== undefined) dbUpdates.is_closed = stage.isClosed;
    if (stage.isWon !== undefined) dbUpdates.is_won = stage.isWon;

    const { data, error } = await this.supabase
      .from('pipeline_stages')
      .update(dbUpdates as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.mapStageToDomain(data as unknown as PipelineStageRow);
  }

  async deleteStage(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('pipeline_stages')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  async reorderStages(stages: { id: string, position: number }[]): Promise<void> {
    const { error } = await this.supabase
      .from('pipeline_stages')
      .upsert(stages as never);

    if (error) throw new Error(error.message);
  }

  private mapPipelineToDomain(row: PipelineRow, stagesRow?: PipelineStageRow[]): Pipeline {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      userId: row.user_id,
      createdAt: row.created_at,
      stages: stagesRow ? stagesRow.map(this.mapStageToDomain).sort((a, b) => a.position - b.position) : undefined,
    };
  }

  private mapStageToDomain(row: PipelineStageRow): PipelineStage {
    return {
      id: row.id,
      pipelineId: row.pipeline_id,
      userId: row.user_id,
      name: row.name,
      position: row.position,
      color: row.color,
      isClosed: row.is_closed,
      isWon: row.is_won,
      createdAt: row.created_at,
    };
  }
}
