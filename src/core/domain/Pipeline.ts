export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt: string;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  userId: string;
  name: string;
  position: number;
  color: string;
  isClosed: boolean;
  isWon: boolean;
  createdAt: string;
}

export interface CreatePipelineDTO {
  name: string;
  description?: string;
}

export interface CreatePipelineStageDTO {
  pipelineId: string;
  name: string;
  position: number;
  color?: string;
  isClosed?: boolean;
  isWon?: boolean;
}
