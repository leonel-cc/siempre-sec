export interface Person {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FaceEmbedding {
  id: string;
  person_id: string;
  embedding: number[];
  created_at: string;
}

export interface CreatePersonDto {
  name: string;
  enabled?: boolean;
}

export interface FaceRecognitionResult {
  person_id?: string;
  person_name?: string;
  confidence: number;
  is_known: boolean;
}
