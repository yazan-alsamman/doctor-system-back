export type IntentType =
  | 'scheduling'
  | 'clinical'
  | 'communication'
  | 'finance'
  | 'search'
  | 'general';

export interface DetectedIntent {
  intent: IntentType;
  confidence: 'high' | 'medium' | 'low';
  entities: {
    patientName?: string;
    patientId?: string;
    doctorName?: string;
    doctorId?: string;
    date?: string;
    timeRange?: string;
    invoiceStatus?: string;
    searchQuery?: string;
  };
  language: 'ar' | 'en' | 'mixed';
}
