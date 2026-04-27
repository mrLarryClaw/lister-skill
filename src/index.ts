/**
 * Lister Skill — OpenClaw integration for Lister.ai task management
 * 
 * Supports natural language commands:
 * - "Add 'call Notary' to my today list"
 * - "Get all priority items"
 * - "Mark item 123 as done"
 * - "Remove item 456"
 * - "Update item 789 to 'new title'"
 */

import fetch from 'node-fetch';

// ─── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  baseUrl: process.env.LISTER_BASE_URL || 'https://lister-api-staging.up.railway.app',
  apiKey: process.env.LISTER_API_KEY || '',
};

// ─── Types ───────────────────────────────────────────────────────────────────
type Intent = 'add_item' | 'get_items' | 'get_priority' | 'mark_done' | 
              'remove_item' | 'update_item' | 'move_item' | 'add_note' | 'unknown';

interface ParsedIntent {
  intent: Intent;
  entities: {
    itemText?: string;
    listName?: string;
    itemId?: string;
    priority?: boolean;
    note?: string;
  };
}

interface ListerResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ─── Intent Parser ───────────────────────────────────────────────────────────
function parseIntent(input: string): ParsedIntent {
  const lower = input.toLowerCase();
  
  // Extract quoted text
  const quotedMatch = input.match(/["']([^"']+)["']/);
  const itemText = quotedMatch ? quotedMatch[1] : undefined;
  
  // Extract list name: "to my X list" or "to X list" or "in X list"
  const listMatch = lower.match(/(?:to|in|on)\s+(?:my\s+)?(\w+)\s+list/);
  const listName = listMatch ? listMatch[1] : undefined;
  
  // Extract item ID: "item 123" or "id 123" or "#123"
  const idMatch = lower.match(/(?:item\s*|id\s*|#)(\d+)/);
  const itemId = idMatch ? idMatch[1] : undefined;
  
  // Priority flag
  const priority = /priority|urgent|important/i.test(lower);
  
  // ── Intent Classification ──
  
  // Add item
  if (/^(add|create|new|put)\b/.test(lower)) {
    return { intent: 'add_item', entities: { itemText, listName, priority } };
  }
  
  // Get items / list
  if (/^(get|show|list|view|find|search)\b/.test(lower)) {
    if (priority) {
      return { intent: 'get_priority', entities: { listName } };
    }
    return { intent: 'get_items', entities: { listName } };
  }
  
  // Mark done
  if (/^(mark|complete|done|finish)\b/.test(lower)) {
    return { intent: 'mark_done', entities: { itemId } };
  }
  
  // Remove item
  if (/^(remove|delete|drop|clear)\b/.test(lower)) {
    return { intent: 'remove_item', entities: { itemId } };
  }
  
  // Update item
  if (/^(update|edit|change|modify|rename)\b/.test(lower)) {
    return { intent: 'update_item', entities: { itemId, itemText } };
  }
  
  // Move item
  if (/^(move|transfer)\b/.test(lower)) {
    return { intent: 'move_item', entities: { itemId, listName } };
  }
  
  // Add note
  if (/^(note|comment|memo)\b/.test(lower)) {
    const note = quotedMatch ? quotedMatch[1] : undefined;
    return { intent: 'add_note', entities: { itemId, note } };
  }
  
  return { intent: 'unknown', entities: {} };
}

// ─── API Client ──────────────────────────────────────────────────────────────
class ListerClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = CONFIG.baseUrl;
    this.apiKey = CONFIG.apiKey;
  }

  private getAuthHeader(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async getLists(): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists`, {
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: `Found ${data?.length ?? 0} lists`, data };
    } catch (err) {
      return { success: false, message: `Error fetching lists: ${err}` };
    }
  }

  async createList(name: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ name }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `List '${name}' created` : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error creating list: ${err}` };
    }
  }

  async getItems(listId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/items`, {
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: `Found ${data?.length ?? 0} items`, data };
    } catch (err) {
      return { success: false, message: `Error fetching items: ${err}` };
    }
  }

  async addItem(listId: string, item: { text: string; priority?: boolean }): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/lists/${listId}/items`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ text: item.text, priority: item.priority || false }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? `'${item.text}' added to list` : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error adding item: ${err}` };
    }
  }

  async updateItem(itemId: string, updates: Record<string, any>): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}`, {
        method: 'PUT',
        headers: this.getAuthHeader(),
        body: JSON.stringify(updates),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Item updated' : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error updating item: ${err}` };
    }
  }

  async deleteItem(itemId: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}`, {
        method: 'DELETE',
        headers: this.getAuthHeader(),
      });
      return { success: res.ok, message: res.ok ? 'Item deleted' : 'Failed to delete item' };
    } catch (err) {
      return { success: false, message: `Error deleting item: ${err}` };
    }
  }

  async addNote(itemId: string, note: string): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/${itemId}/notes`, {
        method: 'POST',
        headers: this.getAuthHeader(),
        body: JSON.stringify({ text: note }),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: res.ok ? 'Note added' : `Failed: ${data?.detail ?? res.statusText}`, data };
    } catch (err) {
      return { success: false, message: `Error adding note: ${err}` };
    }
  }

  async getPriorityItems(): Promise<ListerResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/api/items/priority`, {
        headers: this.getAuthHeader(),
      });
      const data = await res.json() as any;
      return { success: res.ok, message: `Found ${data?.length ?? 0} priority items`, data };
    } catch (err) {
      return { success: false, message: `Error fetching priority items: ${err}` };
    }
  }
}

// ─── Response Formatter ──────────────────────────────────────────────────────
function formatResponse(response: ListerResponse): string {
  if (!response.success) {
    return `❌ ${response.message}`;
  }
  
  let msg = `✅ ${response.message}\n`;
  
  if (response.data && Array.isArray(response.data)) {
    if (response.data.length === 0) {
      msg += '\n_(empty)_';
    } else {
      msg += response.data.map((item: any, i: number) => {
        const title = item.text || item.name || item.title || `Item ${i + 1}`;
        const priority = item.priority ? ' 🔥' : '';
        const done = item.done || item.completed ? ' ✅' : '';
        return `${i + 1}. ${title}${priority}${done}`;
      }).join('\n');
    }
  } else if (response.data && typeof response.data === 'object') {
    msg += `\n\`\`\`json\n${JSON.stringify(response.data, null, 2)}\n\`\`\``;
  }
  
  return msg;
}

// ─── Main Handler ────────────────────────────────────────────────────────────
const client = new ListerClient();

export async function handleCommand(input: string): Promise<string> {
  const parsed = parseIntent(input);
  
  switch (parsed.intent) {
    case 'add_item': {
      if (!parsed.entities.itemText) {
        return '❌ Please provide what to add (use quotes: "task name")';
      }
      if (!parsed.entities.listName) {
        return '❌ Please specify which list (e.g., "to my today list")';
      }
      // First find the list ID by name
      const lists = await client.getLists();
      if (!lists.success || !Array.isArray(lists.data)) {
        return `❌ Could not find lists: ${lists.message}`;
      }
      const list = (lists.data as any[]).find(l => 
        l.name?.toLowerCase() === parsed.entities.listName?.toLowerCase()
      );
      if (!list) {
        return `❌ List '${parsed.entities.listName}' not found`;
      }
      const result = await client.addItem(list.id, {
        text: parsed.entities.itemText,
        priority: parsed.entities.priority,
      });
      return formatResponse(result);
    }
    
    case 'get_items': {
      if (!parsed.entities.listName) {
        // Get all lists
        const result = await client.getLists();
        return formatResponse(result);
      }
      // Find list and get items
      const lists = await client.getLists();
      if (!lists.success || !Array.isArray(lists.data)) {
        return `❌ Could not find lists: ${lists.message}`;
      }
      const list = (lists.data as any[]).find(l => 
        l.name?.toLowerCase() === parsed.entities.listName?.toLowerCase()
      );
      if (!list) {
        return `❌ List '${parsed.entities.listName}' not found`;
      }
      const result = await client.getItems(list.id);
      return formatResponse(result);
    }
    
    case 'get_priority': {
      const result = await client.getPriorityItems();
      return formatResponse(result);
    }
    
    case 'mark_done': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to mark done (e.g., "mark item 123 done")';
      }
      const result = await client.updateItem(parsed.entities.itemId, { done: true } as Record<string, any>);
      return formatResponse(result);
    }
    
    case 'remove_item': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to remove (e.g., "remove item 123")';
      }
      const result = await client.deleteItem(parsed.entities.itemId);
      return formatResponse(result);
    }
    
    case 'update_item': {
      if (!parsed.entities.itemId) {
        return '❌ Please specify which item to update (e.g., "update item 123")';
      }
      const updates: any = {};
      if (parsed.entities.itemText) updates.text = parsed.entities.itemText;
      if (parsed.entities.priority) updates.priority = true;
      const result = await client.updateItem(parsed.entities.itemId, updates);
      return formatResponse(result);
    }
    
    case 'move_item': {
      if (!parsed.entities.itemId || !parsed.entities.listName) {
        return '❌ Please specify item and target list (e.g., "move item 123 to my work list")';
      }
      // Find target list
      const lists = await client.getLists();
      if (!lists.success || !Array.isArray(lists.data)) {
        return `❌ Could not find lists: ${lists.message}`;
      }
      const list = (lists.data as any[]).find(l => 
        l.name?.toLowerCase() === parsed.entities.listName?.toLowerCase()
      );
      if (!list) {
        return `❌ List '${parsed.entities.listName}' not found`;
      }
      // Update item's list_id
      const result = await client.updateItem(parsed.entities.itemId, { list_id: list.id } as Record<string, any>);
      return formatResponse(result);
    }
    
    case 'add_note': {
      if (!parsed.entities.itemId || !parsed.entities.note) {
        return '❌ Please specify item and note (e.g., "note for item 123: \"remember to call back\"")';
      }
      const result = await client.addNote(parsed.entities.itemId, parsed.entities.note);
      return formatResponse(result);
    }
    
    default:
      return `❓ I didn't understand that. Try commands like:\n` +
        `• Add "call Notary" to my today list\n` +
        `• Get priority items\n` +
        `• Mark item 123 as done\n` +
        `• Remove item 456`;
  }
}

// ─── CLI Entry Point ─────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const input = process.argv.slice(2).join(' ');
  if (!input) {
    console.log('Usage: node dist/index.js <command>');
    console.log('Examples:');
    console.log('  node dist/index.js add "call Notary" to my today list');
    console.log('  node dist/index.js get priority items');
    console.log('  node dist/index.js mark item 123 done');
    process.exit(1);
  }
  
  handleCommand(input).then(console.log).catch(console.error);
}

export default handleCommand;
