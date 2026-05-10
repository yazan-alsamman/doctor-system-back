export type ToolName =
  | 'getAvailableSlots'
  | 'getDoctorSchedule'
  | 'detectConflicts'
  | 'getPatientHistory'
  | 'getPatientSummary'
  | 'getInvoiceData'
  | 'getRevenueStats'
  | 'generateWhatsAppMessage'
  | 'searchAppointments'
  | 'searchPatients'
  | 'searchInvoices';

export interface ToolResult {
  tool: ToolName;
  data: unknown;
  error?: string;
}
