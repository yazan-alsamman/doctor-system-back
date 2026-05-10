export type SearchToolName = 'searchPatients' | 'searchAppointments' | 'searchInvoices';
export declare function normalizeSearchToolArgs(tool: SearchToolName, filters: Record<string, unknown>): Record<string, unknown>;
export declare function paramsToSearchFilters(tool: SearchToolName, params: Record<string, unknown>): Record<string, unknown>;
export declare function assertSearchExecutionArgs(tool: SearchToolName, args: Record<string, unknown>): Record<string, unknown>;
export declare function isSearchToolName(t: string): t is SearchToolName;
