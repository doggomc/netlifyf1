interface Navigator {
  readonly connection?: { saveData?: boolean; effectiveType?: string; downlink?: number; rtt?: number; type?: string };
  readonly deviceMemory?: number;
  readonly standalone?: boolean;
}
interface HTMLSelectElement { _syncCustom?: () => void; }
interface Error { code?: string; status?: number; retryAfter?: number; offline?: boolean; }
