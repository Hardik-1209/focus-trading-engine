export interface ResetResult {
    success: boolean;
    newSessionId: string;
    archivedTradesCount: number;
    message: string;
    error?: string;
}
/**
 * Executes a full Clean Slate data reset for the given engine version.
 * Resets database records and purges all in-memory structures synchronously.
 */
export declare function executeCleanSlateReset(targetVersion?: string, force?: boolean): Promise<ResetResult>;
/**
 * Checks on engine startup if a new engine version or release has occurred.
 * If current CONFIG.VERSION does not match the active session or stored engine status,
 * automatically executes a Clean Slate data reset.
 */
export declare function checkAndExecuteVersionReset(): Promise<boolean>;
//# sourceMappingURL=version-manager.d.ts.map