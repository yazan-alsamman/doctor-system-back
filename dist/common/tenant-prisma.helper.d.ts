export declare function tenantWhere<T extends Record<string, unknown>>(tenantId: string, where?: T): T & {
    tenantId: string;
    deletedAt: null;
};
