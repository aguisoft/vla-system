export interface VLAPlugin {
    name: string;
    version: string;
    description: string;
    dependencies?: string[];
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
}
export interface PluginRegistration {
    name: string;
    version: string;
    description: string;
    isActive: boolean;
    registeredAt: Date;
}
//# sourceMappingURL=plugin.types.d.ts.map