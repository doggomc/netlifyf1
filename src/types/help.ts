export interface HelpMessage { id: string; role: 'staff' | 'visitor'; author?: string; text: string; createdAt: number; }
export interface HelpTicket { id: string; category: string; lastStaffMessage?: HelpMessage; lastStaffMessageId?: string; [key: string]: unknown; }
export interface HelpResponse { error?: string; available?: boolean; open?: boolean; ticket?: HelpTicket; messages?: HelpMessage[]; message?: HelpMessage; }
