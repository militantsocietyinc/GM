/**
 * Team Collaboration Service — SalesIntel Edition
 *
 * Provides team member management, assignment routing, activity feed,
 * notifications, shared notes, and an internal event bus for cross-service
 * coordination within a sales intelligence workflow.
 *
 * Persistence is handled via the persistent-cache layer (IndexedDB / Tauri / localStorage).
 */

import { getPersistentCache, setPersistentCache } from './persistent-cache';

// ---------------------------------------------------------------------------
// Cache Keys
// ---------------------------------------------------------------------------

const CACHE_KEY_MEMBERS = 'team-collab:members';
const CACHE_KEY_TEAMS = 'team-collab:teams';
const CACHE_KEY_ASSIGNMENTS = 'team-collab:assignments';
const CACHE_KEY_ACTIVITY = 'team-collab:activity';
const CACHE_KEY_NOTIFICATIONS = 'team-collab:notifications';
const CACHE_KEY_NOTES = 'team-collab:notes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamMemberRole = 'admin' | 'manager' | 'rep' | 'viewer';
export type TeamMemberStatus = 'online' | 'away' | 'offline';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  /** Initials-based avatar string, e.g. "JD" */
  avatar?: string;
  teamId?: string;
  lastActive: Date;
  status: TeamMemberStatus;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  /** Array of TeamMember IDs */
  members: string[];
  ownerId: string;
  createdAt: Date;
}

export type AssignmentType = 'signal' | 'company' | 'deal' | 'task';
export type AssignmentPriority = 'urgent' | 'high' | 'normal' | 'low';
export type AssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface Assignment {
  id: string;
  type: AssignmentType;
  targetId: string;
  targetName: string;
  assigneeId: string;
  assigneeName: string;
  assignedById: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  note?: string;
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export type ActivityFeedItemType =
  | 'signal_detected'
  | 'deal_created'
  | 'deal_moved'
  | 'assignment_created'
  | 'note_added'
  | 'contact_enriched'
  | 'sequence_sent'
  | 'competitor_alert'
  | 'score_changed';

export interface ActivityFeedItem {
  id: string;
  type: ActivityFeedItemType;
  actorId: string;
  actorName: string;
  description: string;
  targetType: string;
  targetId: string;
  targetName: string;
  timestamp: Date;
  metadata: Record<string, string>;
}

export type NotificationType =
  | 'assignment'
  | 'mention'
  | 'signal_alert'
  | 'deal_update'
  | 'score_change'
  | 'system';

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export type SharedNoteEntityType = 'company' | 'contact' | 'deal';

export interface SharedNote {
  id: string;
  entityType: SharedNoteEntityType;
  entityId: string;
  entityName: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  /** Array of TeamMember IDs mentioned in the note */
  mentions: string[];
}

// ---------------------------------------------------------------------------
// Event Bus Types
// ---------------------------------------------------------------------------

export type CollaborationEventType =
  | 'signal:new'
  | 'deal:moved'
  | 'assignment:created'
  | 'score:changed';

export interface CollaborationEventPayloads {
  'signal:new': { signalId: string; company: string; type: string };
  'deal:moved': { dealId: string; from: string; to: string; company: string };
  'assignment:created': { assignmentId: string; assigneeId: string; type: AssignmentType };
  'score:changed': { targetId: string; oldScore: number; newScore: number; company: string };
}

type EventCallback<T extends CollaborationEventType> = (data: CollaborationEventPayloads[T]) => void;

// ---------------------------------------------------------------------------
// Serialization helpers (Date fields serialize to ISO strings in JSON)
// ---------------------------------------------------------------------------

/** Shape of a TeamMember as stored in JSON (Date fields become strings). */
interface SerializedTeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  avatar?: string;
  teamId?: string;
  lastActive: string;
  status: TeamMemberStatus;
}

interface SerializedTeam {
  id: string;
  name: string;
  description: string;
  members: string[];
  ownerId: string;
  createdAt: string;
}

interface SerializedAssignment {
  id: string;
  type: AssignmentType;
  targetId: string;
  targetName: string;
  assigneeId: string;
  assigneeName: string;
  assignedById: string;
  priority: AssignmentPriority;
  status: AssignmentStatus;
  note?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

interface SerializedActivityFeedItem {
  id: string;
  type: ActivityFeedItemType;
  actorId: string;
  actorName: string;
  description: string;
  targetType: string;
  targetId: string;
  targetName: string;
  timestamp: string;
  metadata: Record<string, string>;
}

interface SerializedNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

interface SerializedSharedNote {
  id: string;
  entityType: SharedNoteEntityType;
  entityId: string;
  entityName: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  mentions: string[];
}

function deserializeMember(s: SerializedTeamMember): TeamMember {
  return { ...s, lastActive: new Date(s.lastActive) };
}

function serializeMember(m: TeamMember): SerializedTeamMember {
  return { ...m, lastActive: m.lastActive.toISOString() };
}

function deserializeTeam(s: SerializedTeam): Team {
  return { ...s, createdAt: new Date(s.createdAt) };
}

function serializeTeam(t: Team): SerializedTeam {
  return { ...t, createdAt: t.createdAt.toISOString() };
}

function deserializeAssignment(s: SerializedAssignment): Assignment {
  return {
    ...s,
    dueDate: s.dueDate ? new Date(s.dueDate) : undefined,
    createdAt: new Date(s.createdAt),
    completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
  };
}

function serializeAssignment(a: Assignment): SerializedAssignment {
  return {
    ...a,
    dueDate: a.dueDate?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString(),
  };
}

function deserializeActivity(s: SerializedActivityFeedItem): ActivityFeedItem {
  return { ...s, timestamp: new Date(s.timestamp) };
}

function serializeActivity(a: ActivityFeedItem): SerializedActivityFeedItem {
  return { ...a, timestamp: a.timestamp.toISOString() };
}

function deserializeNotification(s: SerializedNotification): Notification {
  return { ...s, createdAt: new Date(s.createdAt) };
}

function serializeNotification(n: Notification): SerializedNotification {
  return { ...n, createdAt: n.createdAt.toISOString() };
}

function deserializeNote(s: SerializedSharedNote): SharedNote {
  return {
    ...s,
    createdAt: new Date(s.createdAt),
    updatedAt: new Date(s.updatedAt),
  };
}

function serializeNote(n: SharedNote): SerializedSharedNote {
  return {
    ...n,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  idCounter++;
  return `${prefix}_${ts}_${rand}_${idCounter}`;
}

// ---------------------------------------------------------------------------
// Team Dashboard Types
// ---------------------------------------------------------------------------

export interface TeamDashboard {
  activeAssignments: Assignment[];
  recentActivity: ActivityFeedItem[];
  topPerformers: TopPerformer[];
  pendingNotifications: number;
}

export interface TopPerformer {
  memberId: string;
  memberName: string;
  completedAssignments: number;
}

// ---------------------------------------------------------------------------
// TeamCollaborationManager
// ---------------------------------------------------------------------------

class TeamCollaborationManager {
  // In-memory stores
  private members: Map<string, TeamMember> = new Map();
  private teams: Map<string, Team> = new Map();
  private assignments: Map<string, Assignment> = new Map();
  private activityFeed: ActivityFeedItem[] = [];
  private notifications: Map<string, Notification> = new Map();
  private notes: Map<string, SharedNote> = new Map();

  // Event bus
  private listeners: Map<CollaborationEventType, Set<EventCallback<CollaborationEventType>>> = new Map();

  // Hydration state
  private hydrated = false;

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  /** Hydrate all in-memory stores from persistent cache. */
  async hydrate(): Promise<void> {
    if (this.hydrated) return;

    const [membersEnv, teamsEnv, assignmentsEnv, activityEnv, notificationsEnv, notesEnv] =
      await Promise.all([
        getPersistentCache<SerializedTeamMember[]>(CACHE_KEY_MEMBERS),
        getPersistentCache<SerializedTeam[]>(CACHE_KEY_TEAMS),
        getPersistentCache<SerializedAssignment[]>(CACHE_KEY_ASSIGNMENTS),
        getPersistentCache<SerializedActivityFeedItem[]>(CACHE_KEY_ACTIVITY),
        getPersistentCache<SerializedNotification[]>(CACHE_KEY_NOTIFICATIONS),
        getPersistentCache<SerializedSharedNote[]>(CACHE_KEY_NOTES),
      ]);

    if (membersEnv?.data) {
      for (const s of membersEnv.data) {
        const m = deserializeMember(s);
        this.members.set(m.id, m);
      }
    }
    if (teamsEnv?.data) {
      for (const s of teamsEnv.data) {
        const t = deserializeTeam(s);
        this.teams.set(t.id, t);
      }
    }
    if (assignmentsEnv?.data) {
      for (const s of assignmentsEnv.data) {
        const a = deserializeAssignment(s);
        this.assignments.set(a.id, a);
      }
    }
    if (activityEnv?.data) {
      this.activityFeed = activityEnv.data.map(deserializeActivity);
    }
    if (notificationsEnv?.data) {
      for (const s of notificationsEnv.data) {
        const n = deserializeNotification(s);
        this.notifications.set(n.id, n);
      }
    }
    if (notesEnv?.data) {
      for (const s of notesEnv.data) {
        const note = deserializeNote(s);
        this.notes.set(note.id, note);
      }
    }

    this.hydrated = true;
  }

  private async persistMembers(): Promise<void> {
    const data = Array.from(this.members.values()).map(serializeMember);
    await setPersistentCache(CACHE_KEY_MEMBERS, data);
  }

  private async persistTeams(): Promise<void> {
    const data = Array.from(this.teams.values()).map(serializeTeam);
    await setPersistentCache(CACHE_KEY_TEAMS, data);
  }

  private async persistAssignments(): Promise<void> {
    const data = Array.from(this.assignments.values()).map(serializeAssignment);
    await setPersistentCache(CACHE_KEY_ASSIGNMENTS, data);
  }

  private async persistActivity(): Promise<void> {
    const data = this.activityFeed.map(serializeActivity);
    await setPersistentCache(CACHE_KEY_ACTIVITY, data);
  }

  private async persistNotifications(): Promise<void> {
    const data = Array.from(this.notifications.values()).map(serializeNotification);
    await setPersistentCache(CACHE_KEY_NOTIFICATIONS, data);
  }

  private async persistNotes(): Promise<void> {
    const data = Array.from(this.notes.values()).map(serializeNote);
    await setPersistentCache(CACHE_KEY_NOTES, data);
  }

  // ------------------------------------------------------------------
  // Team Members
  // ------------------------------------------------------------------

  addTeamMember(member: TeamMember): void {
    this.members.set(member.id, member);
    void this.persistMembers();
  }

  removeTeamMember(id: string): boolean {
    const deleted = this.members.delete(id);
    if (deleted) {
      // Remove from all teams
      for (const team of this.teams.values()) {
        const idx = team.members.indexOf(id);
        if (idx !== -1) {
          team.members.splice(idx, 1);
        }
      }
      void this.persistMembers();
      void this.persistTeams();
    }
    return deleted;
  }

  updateTeamMember(id: string, changes: Partial<Omit<TeamMember, 'id'>>): TeamMember | null {
    const existing = this.members.get(id);
    if (!existing) return null;

    const updated: TeamMember = { ...existing, ...changes, id };
    this.members.set(id, updated);
    void this.persistMembers();
    return updated;
  }

  getTeamMember(id: string): TeamMember | null {
    return this.members.get(id) ?? null;
  }

  listTeamMembers(): TeamMember[] {
    return Array.from(this.members.values());
  }

  // ------------------------------------------------------------------
  // Teams
  // ------------------------------------------------------------------

  createTeam(data: Omit<Team, 'id' | 'createdAt'>): Team {
    const team: Team = {
      ...data,
      id: generateId('team'),
      createdAt: new Date(),
    };
    this.teams.set(team.id, team);
    void this.persistTeams();
    return team;
  }

  updateTeam(id: string, changes: Partial<Omit<Team, 'id' | 'createdAt'>>): Team | null {
    const existing = this.teams.get(id);
    if (!existing) return null;

    const updated: Team = { ...existing, ...changes, id, createdAt: existing.createdAt };
    this.teams.set(id, updated);
    void this.persistTeams();
    return updated;
  }

  getTeam(id: string): Team | null {
    return this.teams.get(id) ?? null;
  }

  listTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  // ------------------------------------------------------------------
  // Assignments
  // ------------------------------------------------------------------

  createAssignment(data: Omit<Assignment, 'id' | 'status' | 'createdAt' | 'completedAt'>): Assignment {
    const assignment: Assignment = {
      ...data,
      id: generateId('asgn'),
      status: 'pending',
      createdAt: new Date(),
    };
    this.assignments.set(assignment.id, assignment);
    void this.persistAssignments();

    // Emit event
    this.emit('assignment:created', {
      assignmentId: assignment.id,
      assigneeId: assignment.assigneeId,
      type: assignment.type,
    });

    return assignment;
  }

  completeAssignment(id: string): Assignment | null {
    const assignment = this.assignments.get(id);
    if (!assignment) return null;
    if (assignment.status === 'completed' || assignment.status === 'dismissed') return assignment;

    assignment.status = 'completed';
    assignment.completedAt = new Date();
    void this.persistAssignments();
    return assignment;
  }

  dismissAssignment(id: string): Assignment | null {
    const assignment = this.assignments.get(id);
    if (!assignment) return null;
    if (assignment.status === 'completed' || assignment.status === 'dismissed') return assignment;

    assignment.status = 'dismissed';
    assignment.completedAt = new Date();
    void this.persistAssignments();
    return assignment;
  }

  getAssignmentsForMember(memberId: string): Assignment[] {
    return Array.from(this.assignments.values())
      .filter(a => a.assigneeId === memberId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAssignmentsForTarget(targetId: string): Assignment[] {
    return Array.from(this.assignments.values())
      .filter(a => a.targetId === targetId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getOpenAssignments(): Assignment[] {
    return Array.from(this.assignments.values())
      .filter(a => a.status === 'pending' || a.status === 'in_progress')
      .sort((a, b) => {
        // Urgent first, then by creation date
        const priorityOrder: Record<AssignmentPriority, number> = {
          urgent: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (pDiff !== 0) return pDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  // ------------------------------------------------------------------
  // Activity Feed
  // ------------------------------------------------------------------

  /** Maximum number of activity feed items to keep in memory. */
  private static readonly MAX_ACTIVITY_ITEMS = 5000;

  addActivityFeedItem(item: Omit<ActivityFeedItem, 'id' | 'timestamp'>): ActivityFeedItem {
    const feedItem: ActivityFeedItem = {
      ...item,
      id: generateId('act'),
      timestamp: new Date(),
    };
    this.activityFeed.unshift(feedItem);

    // Prune to prevent unbounded growth
    if (this.activityFeed.length > TeamCollaborationManager.MAX_ACTIVITY_ITEMS) {
      this.activityFeed = this.activityFeed.slice(0, TeamCollaborationManager.MAX_ACTIVITY_ITEMS);
    }

    void this.persistActivity();
    return feedItem;
  }

  getActivityFeed(limit = 50, offset = 0): ActivityFeedItem[] {
    return this.activityFeed.slice(offset, offset + limit);
  }

  getTeamActivityFeed(teamId: string, limit = 50): ActivityFeedItem[] {
    const team = this.teams.get(teamId);
    if (!team) return [];

    const memberSet = new Set(team.members);
    return this.activityFeed
      .filter(item => memberSet.has(item.actorId))
      .slice(0, limit);
  }

  // ------------------------------------------------------------------
  // Notifications
  // ------------------------------------------------------------------

  createNotification(data: Omit<Notification, 'id' | 'isRead' | 'createdAt'>): Notification {
    const notification: Notification = {
      ...data,
      id: generateId('notif'),
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.set(notification.id, notification);
    void this.persistNotifications();
    return notification;
  }

  markNotificationRead(id: string): Notification | null {
    const notification = this.notifications.get(id);
    if (!notification) return null;

    notification.isRead = true;
    void this.persistNotifications();
    return notification;
  }

  markAllNotificationsRead(memberId: string): number {
    let count = 0;
    for (const notification of this.notifications.values()) {
      if (notification.recipientId === memberId && !notification.isRead) {
        notification.isRead = true;
        count++;
      }
    }
    if (count > 0) {
      void this.persistNotifications();
    }
    return count;
  }

  getUnreadNotifications(memberId: string): Notification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientId === memberId && !n.isRead)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getNotifications(memberId: string, limit = 50): Notification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.recipientId === memberId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ------------------------------------------------------------------
  // Shared Notes
  // ------------------------------------------------------------------

  addNote(data: Omit<SharedNote, 'id' | 'createdAt' | 'updatedAt'>): SharedNote {
    const now = new Date();
    const note: SharedNote = {
      ...data,
      id: generateId('note'),
      createdAt: now,
      updatedAt: now,
    };
    this.notes.set(note.id, note);
    void this.persistNotes();

    // Create notifications for mentioned team members
    for (const mentionedId of note.mentions) {
      if (mentionedId !== note.authorId) {
        this.createNotification({
          recipientId: mentionedId,
          type: 'mention',
          title: `${note.authorName} mentioned you`,
          body: `In a note on ${note.entityName}: ${note.content.slice(0, 120)}${note.content.length > 120 ? '...' : ''}`,
        });
      }
    }

    return note;
  }

  updateNote(id: string, content: string): SharedNote | null {
    const existing = this.notes.get(id);
    if (!existing) return null;

    existing.content = content;
    existing.updatedAt = new Date();
    void this.persistNotes();
    return existing;
  }

  getNotesForEntity(entityType: SharedNoteEntityType, entityId: string): SharedNote[] {
    return Array.from(this.notes.values())
      .filter(n => n.entityType === entityType && n.entityId === entityId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  deleteNote(id: string): boolean {
    const deleted = this.notes.delete(id);
    if (deleted) {
      void this.persistNotes();
    }
    return deleted;
  }

  // ------------------------------------------------------------------
  // Team Dashboard
  // ------------------------------------------------------------------

  getTeamDashboard(teamId?: string): TeamDashboard {
    let memberIds: Set<string> | null = null;

    if (teamId) {
      const team = this.teams.get(teamId);
      if (team) {
        memberIds = new Set(team.members);
      }
    }

    // Active assignments (pending or in_progress)
    const activeAssignments = Array.from(this.assignments.values())
      .filter(a => {
        const isOpen = a.status === 'pending' || a.status === 'in_progress';
        if (!isOpen) return false;
        if (memberIds) return memberIds.has(a.assigneeId);
        return true;
      })
      .sort((a, b) => {
        const priorityOrder: Record<AssignmentPriority, number> = {
          urgent: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    // Recent activity
    const recentActivity = memberIds
      ? this.activityFeed.filter(item => memberIds.has(item.actorId)).slice(0, 20)
      : this.activityFeed.slice(0, 20);

    // Top performers (by completed assignments in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const completionCounts = new Map<string, number>();
    const memberNameMap = new Map<string, string>();

    for (const a of this.assignments.values()) {
      if (a.status !== 'completed') continue;
      if (!a.completedAt || a.completedAt < thirtyDaysAgo) continue;
      if (memberIds && !memberIds.has(a.assigneeId)) continue;

      completionCounts.set(a.assigneeId, (completionCounts.get(a.assigneeId) ?? 0) + 1);
      if (!memberNameMap.has(a.assigneeId)) {
        memberNameMap.set(a.assigneeId, a.assigneeName);
      }
    }

    const topPerformers: TopPerformer[] = Array.from(completionCounts.entries())
      .map(([memberId, count]) => ({
        memberId,
        memberName: memberNameMap.get(memberId) ?? memberId,
        completedAssignments: count,
      }))
      .sort((a, b) => b.completedAssignments - a.completedAssignments)
      .slice(0, 10);

    // Pending notifications (count of unread across relevant members)
    let pendingNotifications = 0;
    if (memberIds) {
      for (const n of this.notifications.values()) {
        if (!n.isRead && memberIds.has(n.recipientId)) {
          pendingNotifications++;
        }
      }
    } else {
      for (const n of this.notifications.values()) {
        if (!n.isRead) {
          pendingNotifications++;
        }
      }
    }

    return {
      activeAssignments,
      recentActivity,
      topPerformers,
      pendingNotifications,
    };
  }

  // ------------------------------------------------------------------
  // Search
  // ------------------------------------------------------------------

  searchActivity(query: string): ActivityFeedItem[] {
    if (!query.trim()) return [];

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    return this.activityFeed.filter(item => {
      const searchable = [
        item.description,
        item.actorName,
        item.targetName,
        item.targetType,
        item.type,
        ...Object.values(item.metadata),
      ]
        .join(' ')
        .toLowerCase();

      return terms.every(term => searchable.includes(term));
    });
  }

  // ------------------------------------------------------------------
  // Event Bus
  // ------------------------------------------------------------------

  on<T extends CollaborationEventType>(event: T, callback: EventCallback<T>): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    // The cast is safe: we store all callbacks under the same event key,
    // and dispatch only calls listeners registered for that specific event.
    set.add(callback as EventCallback<CollaborationEventType>);
  }

  off<T extends CollaborationEventType>(event: T, callback: EventCallback<T>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as EventCallback<CollaborationEventType>);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit<T extends CollaborationEventType>(event: T, data: CollaborationEventPayloads[T]): void {
    const set = this.listeners.get(event);
    if (!set) return;

    for (const cb of set) {
      try {
        (cb as EventCallback<T>)(data);
      } catch (err) {
        console.error(`[team-collaboration] Event listener error for "${event}":`, err);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const teamCollaboration = new TeamCollaborationManager();
