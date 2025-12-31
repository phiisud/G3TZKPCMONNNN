import { Message } from '../types';

export interface SearchResult {
  messageId: string;
  content: string;
  sender: string;
  timestamp: number;
  type: 'message' | 'file' | 'image' | 'voice';
  conversationId?: string;
  score: number;
}

export interface SearchIndexEntry {
  id: string;
  content: string;
  sender: string;
  timestamp: number;
  type: string;
  conversationId?: string;
  searchableText: string;
}

export class MessageSearchService {
  private searchIndex: Map<string, SearchIndexEntry> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initializeIndex();
  }

  private async initializeIndex(): Promise<void> {
    // Load existing messages and build index
    try {
      const existingMessages = await this.loadExistingMessages();
      existingMessages.forEach(message => this.indexMessage(message));
      this.isInitialized = true;
    } catch (error) {
      console.error('[MessageSearch] Failed to initialize index:', error);
    }
  }

  private async loadExistingMessages(): Promise<Message[]> {
    // Load messages from local storage or context
    const stored = localStorage.getItem('g3zkp_messages');
    return stored ? JSON.parse(stored) : [];
  }

  async indexMessage(message: Message): Promise<void> {
    if (!message.content && !message.fileName) return;

    const searchableText = this.extractSearchableText(message);
    if (!searchableText.trim()) return;

    const entry: SearchIndexEntry = {
      id: message.id,
      content: message.content || '',
      sender: message.sender,
      timestamp: message.timestamp,
      type: message.type,
      conversationId: message.recipient,
      searchableText: searchableText.toLowerCase()
    };

    this.searchIndex.set(message.id, entry);
  }

  private extractSearchableText(message: Message): string {
    let text = '';

    // Add message content
    if (message.content) {
      text += message.content + ' ';
    }

    // Add file name if present
    if (message.fileName) {
      text += message.fileName + ' ';
    }

    // Add sender name
    if (message.sender) {
      text += message.sender + ' ';
    }

    // Add reply context
    if (message.replyTo && typeof message.replyTo === 'string') {
      text += 'reply ';
    }

    return text.trim();
  }

  async search(query: string, options: {
    sender?: string;
    type?: string;
    dateRange?: { from: number; to: number };
    limit?: number;
  } = {}): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initializeIndex();
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    const results: SearchResult[] = [];
    const { sender, type, dateRange, limit = 50 } = options;

    for (const [messageId, entry] of this.searchIndex) {
      // Apply filters
      if (sender && entry.sender !== sender) continue;
      if (type && entry.type !== type) continue;
      if (dateRange && (entry.timestamp < dateRange.from || entry.timestamp > dateRange.to)) continue;

      // Calculate relevance score
      const score = this.calculateRelevanceScore(entry.searchableText, searchTerms);

      if (score > 0) {
        results.push({
          messageId,
          content: entry.content,
          sender: entry.sender,
          timestamp: entry.timestamp,
          type: entry.type as any,
          conversationId: entry.conversationId,
          score
        });
      }
    }

    // Sort by relevance score and timestamp
    results.sort((a, b) => {
      if (Math.abs(a.score - b.score) < 0.1) {
        return b.timestamp - a.timestamp; // Newer first if scores similar
      }
      return b.score - a.score; // Higher score first
    });

    return results.slice(0, limit);
  }

  private calculateRelevanceScore(text: string, searchTerms: string[]): number {
    let totalScore = 0;
    let matchedTerms = 0;

    for (const term of searchTerms) {
      if (term.length < 2) continue; // Skip very short terms

      const termScore = this.calculateTermScore(text, term);
      if (termScore > 0) {
        totalScore += termScore;
        matchedTerms++;
      }
    }

    // Boost score for matching more terms
    if (matchedTerms > 1) {
      totalScore *= (1 + matchedTerms * 0.1);
    }

    return totalScore;
  }

  private calculateTermScore(text: string, term: string): number {
    const words = text.split(/\s+/);
    let score = 0;

    // Exact word matches get highest score
    for (const word of words) {
      if (word === term) {
        score += 1.0;
      } else if (word.includes(term)) {
        score += 0.7; // Partial match
      }
    }

    // Substring matches get lower score
    const substringMatches = (text.match(new RegExp(term, 'gi')) || []).length;
    score += substringMatches * 0.3;

    return Math.min(score, 2.0); // Cap individual term score
  }

  async searchBySender(sender: string, limit: number = 20): Promise<SearchResult[]> {
    return this.search('', { sender, limit });
  }

  async searchByType(type: string, limit: number = 20): Promise<SearchResult[]> {
    return this.search('', { type, limit });
  }

  async searchByDateRange(from: number, to: number, limit: number = 50): Promise<SearchResult[]> {
    return this.search('', { dateRange: { from, to }, limit });
  }

  async getMessageById(messageId: string): Promise<SearchResult | null> {
    const entry = this.searchIndex.get(messageId);
    if (!entry) return null;

    return {
      messageId: entry.id,
      content: entry.content,
      sender: entry.sender,
      timestamp: entry.timestamp,
      type: entry.type as any,
      conversationId: entry.conversationId,
      score: 1.0
    };
  }

  async removeMessage(messageId: string): Promise<void> {
    this.searchIndex.delete(messageId);
  }

  async clearIndex(): Promise<void> {
    this.searchIndex.clear();
    this.isInitialized = false;
  }

  async rebuildIndex(messages: Message[]): Promise<void> {
    this.searchIndex.clear();

    for (const message of messages) {
      await this.indexMessage(message);
    }

    this.isInitialized = true;
    console.log(`[MessageSearch] Rebuilt index with ${messages.length} messages`);
  }

  getIndexStats(): { totalMessages: number; isInitialized: boolean } {
    return {
      totalMessages: this.searchIndex.size,
      isInitialized: this.isInitialized
    };
  }
}

export const messageSearchService = new MessageSearchService();