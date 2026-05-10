import { Pipeline, PipelineStage, CreatePipelineDTO, CreatePipelineStageDTO } from "../domain/Pipeline";

export interface PipelineRepository {
  getAll(): Promise<Pipeline[]>;
  getById(id: string): Promise<Pipeline | null>;
  create(pipeline: CreatePipelineDTO): Promise<Pipeline>;
  update(id: string, pipeline: Partial<CreatePipelineDTO>): Promise<Pipeline>;
  delete(id: string): Promise<void>;
  
  // Stages
  getStages(pipelineId: string): Promise<PipelineStage[]>;
  createStage(stage: CreatePipelineStageDTO): Promise<PipelineStage>;
  updateStage(id: string, stage: Partial<CreatePipelineStageDTO>): Promise<PipelineStage>;
  deleteStage(id: string): Promise<void>;
  reorderStages(stages: { id: string, position: number }[]): Promise<void>;
}
