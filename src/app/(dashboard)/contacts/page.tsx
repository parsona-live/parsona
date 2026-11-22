'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, ContactGroup } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  X,
  FolderKanban,
  Download,
  ArrowRightLeft,
  UserPlus,
  UserMinus,
  Sparkles,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { ContactsTableRowsSkeleton } from '@/components/skeletons/page-skeletons';
import { useTranslations } from 'next-intl';
import {
  contactSearchFilter,
  contactSearchPattern,
} from '@/lib/contacts/search-filter';
import { pageAfterRangeError, pageAfterShrink } from '@/lib/contacts/page-bounds';
import { formatContactsCsv, downloadCsv } from '@/lib/contacts/export-csv';

const PAGE_SIZE = 25;

interface ContactWithTags extends Contact {
  tags?: Tag[];
  secondaryChannels?: {
    hasWhatsApp?: boolean;
    igUsername?: string | null;
    fbName?: string | null;
  };
}

export default function ContactsPage() {
  const t = useTranslations('Contacts.page');
  const tGate = useTranslations('GatedButton');
  const supabase = createClient();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Group and Profile Reachability filters
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [profileFilter, setProfileFilter] = useState<'actionable' | 'all'>('actionable');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Tag filter — contacts shown must have ANY of these tags (OR).
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Modals & Forms
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Contact Groups Management Modals
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#3b82f6');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [renameGroupOpen, setRenameGroupOpen] = useState(false);
  const [groupToRename, setGroupToRename] = useState<ContactGroup | null>(null);
  const [renameGroupName, setRenameGroupName] = useState('');
  const [renamingGroup, setRenamingGroup] = useState(false);

  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ContactGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Group Member Move, Add & Remove Modals
  const [addToGroupOpen, setAddToGroupOpen] = useState(false);
  const [targetGroupIdForAdd, setTargetGroupIdForAdd] = useState<string>('');
  const [addingToGroup, setAddingToGroup] = useState(false);

  const [moveGroupOpen, setMoveGroupOpen] = useState(false);
  const [targetGroupIdForMove, setTargetGroupIdForMove] = useState<string>('');
  const [movingGroup, setMovingGroup] = useState(false);

  const [removeFromGroupConfirmOpen, setRemoveFromGroupConfirmOpen] = useState(false);
  const [removeFromGroupTarget, setRemoveFromGroupTarget] = useState<Contact | null>(null);
  const [removingFromGroup, setRemovingFromGroup] = useState(false);

  const [bulkRemoveFromGroupConfirmOpen, setBulkRemoveFromGroupConfirmOpen] = useState(false);
  const [bulkRemovingFromGroup, setBulkRemovingFromGroup] = useState(false);

  // Tags lookup
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  const fetchSeq = useRef(0);

  // Load Contact Groups
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      const res = await fetch('/api/contacts/groups');
      const data = await res.json();
      if (data?.groups) setGroups(data.groups);
    } catch (err) {
      console.warn('Failed to load contact groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((tg) => (map[tg.id] = tg));
      setTagsMap(map);
      setSelectedTagIds((prev) => {
        const pruned = prev.filter((id) => map[id]);
        return pruned.length === prev.length ? prev : pruned;
      });
    }
  }, [supabase]);

  // Main Contacts Fetcher with Deduplication and Reachability Filtering
  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setSelected(new Set());

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const term = search.trim();

    let contactRows: Contact[] = [];
    let count = 0;
    let countIsExact = true;

    // 1. Group membership resolution (if a specific group is selected)
    let groupContactIds: string[] | null = null;
    if (selectedGroupId) {
      const { data: gcRows } = await supabase
        .from('group_contacts')
        .select('source_contact_id, id')
        .eq('group_id', selectedGroupId);

      const resolved = (gcRows ?? [])
        .map((r) => (r.source_contact_id as string) || (r.id as string))
        .filter(Boolean);

      if (resolved.length > 0) {
        groupContactIds = resolved;
      } else {
        const { data: memberRows, error: mErr } = await supabase
          .from('contact_group_members')
          .select('contact_id')
          .eq('group_id', selectedGroupId);

        if (mErr) {
          console.warn('Error fetching group members:', mErr);
        }
        groupContactIds = (memberRows ?? []).map((r) => r.contact_id as string);
      }

      if (groupContactIds.length === 0) {
        if (seq === fetchSeq.current) {
          setContacts([]);
          setTotalCount(0);
          setLoading(false);
        }
        return;
      }
    }

    if (selectedTagIds.length > 0) {
      const { data, error } = await supabase.rpc('filter_contacts_by_tags', {
        p_tag_ids: selectedTagIds,
        p_search: contactSearchPattern(term),
        p_limit: PAGE_SIZE,
        p_offset: from,
      });

      if (seq !== fetchSeq.current) return;
      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as { contact: Contact; total_count: number }[];
      contactRows = rows.map((r) => r.contact);
      count = rows.length > 0 ? Number(rows[0].total_count) : 0;
      countIsExact = rows.length > 0;
    } else {
      let query = supabase
        .from('contacts')
        .select('*', { count: 'exact' })
        // Deduplicate merged contacts: Only canonical root contacts (linked_contact_id IS NULL)
        .is('linked_contact_id', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      // Group filter
      if (groupContactIds) {
        query = query.in('id', groupContactIds);
      }

      // Actionable vs All filter:
      // Actionable contacts must have a reachable phone or email address
      if (profileFilter === 'actionable') {
        query = query.or('phone.not.is.null,email.not.is.null');
      }

      const searchFilter = contactSearchFilter(term, { includeEmail: true });
      if (searchFilter) query = query.or(searchFilter);

      const { data, count: exactCount, error } = await query;
      if (seq !== fetchSeq.current) return;

      const pageInRange = error ? pageAfterRangeError(page, PAGE_SIZE, error) : null;
      if (pageInRange !== null && pageInRange !== page) {
        setPage(pageInRange);
        return;
      }

      if (error) {
        toast.error(t('toastFailedLoad'));
        setLoading(false);
        return;
      }

      contactRows = data ?? [];
      count = exactCount ?? 0;
    }

    setTotalCount(count);

    const boundedPage = pageAfterShrink(page, count, PAGE_SIZE, countIsExact);
    if (contactRows.length === 0 && boundedPage !== page) {
      setPage(boundedPage);
      return;
    }

    if (contactRows.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const contactIds = contactRows.map((c) => c.id);

    // 2. Concurrently fetch tags and any linked child contacts for channel aggregation
    const [tagsRes, linkedChildrenRes] = await Promise.all([
      supabase.from('contact_tags').select('contact_id, tag_id').in('contact_id', contactIds),
      supabase
        .from('contacts')
        .select('id, linked_contact_id, phone, email, ig_username, fb_name')
        .in('linked_contact_id', contactIds),
    ]);

    if (seq !== fetchSeq.current) return;

    const tagsByContact: Record<string, string[]> = {};
    tagsRes.data?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    const childChannelsByParent = new Map<
      string,
      { hasWhatsApp: boolean; igUsername?: string | null; fbName?: string | null }
    >();

    linkedChildrenRes.data?.forEach((ch) => {
      if (ch.linked_contact_id) {
        const existing = childChannelsByParent.get(ch.linked_contact_id) || { hasWhatsApp: false };
        if (ch.phone) existing.hasWhatsApp = true;
        if (ch.ig_username && !existing.igUsername) existing.igUsername = ch.ig_username;
        if (ch.fb_name && !existing.fbName) existing.fbName = ch.fb_name;
        childChannelsByParent.set(ch.linked_contact_id, existing);
      }
    });

    const enriched: ContactWithTags[] = contactRows.map((c) => {
      const childData = childChannelsByParent.get(c.id);
      return {
        ...c,
        tags: (tagsByContact[c.id] ?? []).map((tid) => tagsMap[tid]).filter(Boolean),
        secondaryChannels: childData,
      };
    });

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, selectedTagIds, selectedGroupId, profileFilter, tagsMap, t]);

  useEffect(() => {
    fetchTags();
    fetchGroups();
  }, [fetchTags, fetchGroups]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Group Actions Handlers
  async function handleCreateGroup() {
    if (!newGroupName.trim()) {
      toast.error('Group name is required');
      return;
    }
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/contacts/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName.trim(),
          color: newGroupColor,
          description: newGroupDescription.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create group');

      toast.success(`Group "${data.group.name}" created`);
      setNewGroupOpen(false);
      setNewGroupName('');
      setNewGroupDescription('');
      await fetchGroups();
      setSelectedGroupId(data.group.id);
      setPage(0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleRenameGroup() {
    if (!groupToRename || !renameGroupName.trim()) return;
    setRenamingGroup(true);
    try {
      const res = await fetch(`/api/contacts/groups/${groupToRename.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameGroupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename group');

      toast.success('Group renamed');
      setRenameGroupOpen(false);
      setGroupToRename(null);
      await fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename group');
    } finally {
      setRenamingGroup(false);
    }
  }

  async function handleDeleteGroup() {
    if (!groupToDelete) return;
    setDeletingGroup(true);
    try {
      const res = await fetch(`/api/contacts/groups/${groupToDelete.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete group');

      toast.success(`Group "${groupToDelete.name}" deleted`);
      setDeleteGroupOpen(false);
      if (selectedGroupId === groupToDelete.id) {
        setSelectedGroupId(null);
      }
      setGroupToDelete(null);
      await fetchGroups();
      setPage(0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete group');
    } finally {
      setDeletingGroup(false);
    }
  }

  async function handleAddToGroup() {
    if (!targetGroupIdForAdd || selected.size === 0) return;
    setAddingToGroup(true);
    try {
      const contactIds = Array.from(selected);
      const res = await fetch(`/api/contacts/groups/${targetGroupIdForAdd}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', contactIds }),
      });
      if (!res.ok) throw new Error('Failed to add contacts to group');

      toast.success(`Added ${contactIds.length} contact(s) to group`);
      setAddToGroupOpen(false);
      setSelected(new Set());
      await fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add to group');
    } finally {
      setAddingToGroup(false);
    }
  }

  async function handleMoveToGroup() {
    if (!selectedGroupId || !targetGroupIdForMove || selected.size === 0) return;
    setMovingGroup(true);
    try {
      const contactIds = Array.from(selected);
      const res = await fetch(`/api/contacts/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'move',
          contactIds,
          targetGroupId: targetGroupIdForMove,
        }),
      });
      if (!res.ok) throw new Error('Failed to move contacts to group');

      toast.success(`Moved ${contactIds.length} contact(s) to target group`);
      setMoveGroupOpen(false);
      setSelected(new Set());
      await fetchGroups();
      await fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to move contacts');
    } finally {
      setMovingGroup(false);
    }
  }

  async function handleRemoveContactFromGroup() {
    if (!removeFromGroupTarget || !selectedGroupId) return;
    setRemovingFromGroup(true);
    try {
      const res = await fetch(`/api/contacts/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', contactIds: [removeFromGroupTarget.id] }),
      });
      if (!res.ok) throw new Error('Failed to remove contact from group');

      toast.success('Contact removed from group');
      setRemoveFromGroupConfirmOpen(false);
      setRemoveFromGroupTarget(null);
      await fetchGroups();
      await fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove contact from group');
    } finally {
      setRemovingFromGroup(false);
    }
  }

  async function handleRemoveFromCurrentGroup() {
    if (!selectedGroupId || selected.size === 0) return;
    setBulkRemovingFromGroup(true);
    try {
      const contactIds = Array.from(selected);
      const res = await fetch(`/api/contacts/groups/${selectedGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', contactIds }),
      });
      if (!res.ok) throw new Error('Failed to remove contacts from group');

      toast.success(`Removed ${contactIds.length} contact(s) from group`);
      setBulkRemoveFromGroupConfirmOpen(false);
      setSelected(new Set());
      await fetchGroups();
      await fetchContacts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove contacts');
    } finally {
      setBulkRemovingFromGroup(false);
    }
  }

  function handleExportCsv(mode: 'selected' | 'all') {
    let rowsToExport: ContactWithTags[] = [];
    if (mode === 'selected') {
      rowsToExport = contacts.filter((c) => selected.has(c.id));
    } else {
      rowsToExport = contacts;
    }

    if (rowsToExport.length === 0) {
      toast.warning('No contacts to export');
      return;
    }

    const activeGroup = groups.find((g) => g.id === selectedGroupId);
    const filename = activeGroup
      ? `contacts-${activeGroup.name.toLowerCase().replace(/\s+/g, '-')}`
      : 'contacts-export';

    const csvData = formatContactsCsv(rowsToExport);
    downloadCsv(filename, csvData);
    toast.success(`Exported ${rowsToExport.length} contacts to CSV`);
  }

  // Selection helpers
  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(contacts.map((c) => c.id)));
    }
  }

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  function openEditForm(contact: Contact) {
    setEditContact(contact);
    const existingTags = (contact as ContactWithTags).tags ?? [];
    setEditContactTags(
      existingTags.map((tg) => ({
        id: '',
        contact_id: contact.id,
        tag_id: tg.id,
      })),
    );
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(t('toastContactDeleted'));
      setDeleteConfirmOpen(false);
      setDeleteTarget(null);
      await fetchContacts();
      await fetchGroups();
    } catch {
      toast.error(t('toastFailedDelete'));
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from('contacts').delete().in('id', ids);
      if (error) throw error;
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setBulkDeleteOpen(false);
      setSelected(new Set());
      await fetchContacts();
      await fetchGroups();
    } catch {
      toast.error(t('toastFailedBulkDelete'));
    } finally {
      setDeleting(false);
    }
  }

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
    setPage(0);
  }

  function clearTagFilters() {
    setSelectedTagIds([]);
    setPage(0);
  }

  const allTags = Object.values(tagsMap);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const activeGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GatedButton
            canAct={canEditSettings}
            gateReason={tGate('reasons.manageCustomFields')}
            variant="outline"
            size="sm"
            onClick={() => setCustomFieldsOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <SlidersHorizontal className="size-4" />
            {t('customFieldsBtn')}
          </GatedButton>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCsv('all')}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Download className="size-4" />
            Export CSV
          </Button>

          <GatedButton
            canAct={canEdit}
            gateReason={tGate('reasons.addOrImportContacts')}
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="size-4" />
            {t('importBtn')}
          </GatedButton>

          <GatedButton
            canAct={canEdit}
            gateReason={tGate('reasons.addOrImportContacts')}
            size="sm"
            onClick={openAddForm}
          >
            <Plus className="size-4" />
            {t('addContactBtn')}
          </GatedButton>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sidebar: Contact Groups & Audience Segments */}
        <div className="w-full lg:w-64 shrink-0 rounded-xl border border-border bg-card p-4 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FolderKanban className="size-3.5 text-primary" />
              Contact Groups
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setNewGroupOpen(true)}
              title="Create New Group"
              className="text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Plus className="size-4" />
            </Button>
          </div>

          {/* All Contacts (Inbox Default) */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setSelectedGroupId(null);
                setPage(0);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedGroupId === null
                  ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Users className="size-3.5 shrink-0" />
                <span className="truncate">All Contacts</span>
              </div>
              <span className="text-[10px] bg-muted/80 px-2 py-0.5 rounded-full font-mono">
                {selectedGroupId === null ? totalCount : 'All'}
              </span>
            </button>
          </div>

          {/* Actionable Reachability Pill Filter */}
          <div className="pt-2 border-t border-border space-y-1.5">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block px-1">
              Filter by Contact Info
            </span>
            <div className="grid grid-cols-2 gap-1 bg-muted/60 p-1 rounded-lg">
              <button
                onClick={() => {
                  setProfileFilter('actionable');
                  setPage(0);
                }}
                className={`text-[11px] py-1 px-1.5 rounded-md font-medium text-center transition-all ${
                  profileFilter === 'actionable'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Actionable
              </button>
              <button
                onClick={() => {
                  setProfileFilter('all');
                  setPage(0);
                }}
                className={`text-[11px] py-1 px-1.5 rounded-md font-medium text-center transition-all ${
                  profileFilter === 'all'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Profiles
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground px-1">
              {profileFilter === 'actionable'
                ? 'Showing contacts with Phone or Email (ready for broadcast campaigns)'
                : 'Showing all social leads & profiles'}
            </p>
          </div>

          {/* User-Created Groups List */}
          <div className="pt-2 border-t border-border space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block px-1 pb-1">
              Your Broadcast Groups
            </span>
            {loadingGroups ? (
              <div className="py-4 text-center">
                <Loader2 className="size-4 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : groups.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center border border-dashed rounded-lg">
                No groups created yet. Click + to create one for broadcasts!
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {groups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  return (
                    <div
                      key={group.id}
                      className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                        isSelected
                          ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <button
                        onClick={() => {
                          setSelectedGroupId(group.id);
                          setPage(0);
                        }}
                        className="flex items-center gap-2 flex-1 text-left truncate"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: group.color || '#3b82f6' }}
                        />
                        <span className="truncate">{group.name}</span>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] bg-muted/80 px-1.5 py-0.5 rounded-full font-mono text-muted-foreground">
                          {group.member_count ?? 0}
                        </span>

                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity p-0.5"
                              />
                            }
                          >
                            <MoreHorizontal className="size-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 bg-popover border-border">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedGroupId(group.id);
                                handleExportCsv('all');
                              }}
                            >
                              <Download className="size-3.5 mr-2" />
                              Export CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setGroupToRename(group);
                                setRenameGroupName(group.name);
                                setRenameGroupOpen(true);
                              }}
                            >
                              <Pencil className="size-3.5 mr-2" />
                              Rename Group
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setGroupToDelete(group);
                                setDeleteGroupOpen(true);
                              }}
                            >
                              <Trash2 className="size-3.5 mr-2" />
                              Delete Group
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Content: Table, Search, Bulk Bar */}
        <div className="flex-1 w-full space-y-4">
          {/* Active Filter Banner if in a group */}
          {activeGroup && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: activeGroup.color }}
                />
                <span className="text-sm font-semibold text-foreground">
                  Viewing Group: {activeGroup.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  ({activeGroup.member_count ?? 0} members)
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedGroupId(null)}
                className="text-xs text-muted-foreground hover:text-foreground h-7"
              >
                Clear Group Filter
              </Button>
            </div>
          )}

          {/* Search + Tag Filter */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                placeholder={t('searchPlaceholder')}
                className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Popover>
              <PopoverTrigger
                render={
                  <Button
                    variant="outline"
                    className="border-border text-muted-foreground hover:bg-muted shrink-0"
                  />
                }
              >
                <Filter className="size-4" />
                {t('filterByTags')}
                {selectedTagIds.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {selectedTagIds.length}
                  </span>
                )}
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-medium text-popover-foreground">
                    {t('filterByTags')}
                  </span>
                  {selectedTagIds.length > 0 && (
                    <button
                      onClick={clearTagFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      {t('clearAll')}
                    </button>
                  )}
                </div>
                {allTags.length === 0 ? (
                  <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                    {t('noTagsYet')}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto py-1">
                    {allTags.map((tg) => (
                      <label
                        key={tg.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tg.id)}
                          onCheckedChange={() => toggleTagFilter(tg.id)}
                          aria-label={t('filterByTag', { name: tg.name })}
                        />
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tg.color }}
                        />
                        <span className="text-sm text-popover-foreground truncate">{tg.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Active Tag Filter Chips */}
          {selectedTagIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTagIds.map((id) => {
                const tg = tagsMap[id];
                if (!tg) return null;
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: tg.color + '20',
                      color: tg.color,
                    }}
                  >
                    {tg.name}
                    <button
                      onClick={() => toggleTagFilter(id)}
                      aria-label={t('removeTagFilter', { name: tg.name })}
                      className="hover:opacity-70"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                );
              })}
              <button
                onClick={clearTagFilters}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                {t('clearAll')}
              </button>
            </div>
          )}

          {/* Bulk Actions Bar */}
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
              <p className="text-sm font-medium text-foreground">
                {t('selectedCount', { count: selected.size })}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddToGroupOpen(true)}
                  className="border-border text-foreground hover:bg-muted"
                >
                  <UserPlus className="size-3.5" />
                  Add to Group
                </Button>

                {selectedGroupId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMoveGroupOpen(true)}
                    className="border-border text-foreground hover:bg-muted"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    Move to Group
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCsv('selected')}
                  className="border-border text-foreground hover:bg-muted"
                >
                  <Download className="size-3.5" />
                  Export Selected
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {t('clearSelection')}
                </Button>

                {selectedGroupId ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkRemoveFromGroupConfirmOpen(true)}
                    disabled={bulkRemovingFromGroup}
                  >
                    <UserMinus className="size-3.5" />
                    Remove from Group
                  </Button>
                ) : (
                  <GatedButton
                    variant="destructive"
                    size="sm"
                    canAct={canEdit}
                    gateReason={tGate('reasons.deleteContacts')}
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="size-3.5" />
                    {t('deleteSelected')}
                  </GatedButton>
                )}
              </div>
            </div>
          )}

          {/* Contacts Table */}
          <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      indeterminate={!allOnPageSelected && someOnPageSelected}
                      onCheckedChange={toggleSelectAll}
                      disabled={contacts.length === 0}
                      aria-label={t('selectAllOnPage')}
                    />
                  </TableHead>
                  <TableHead className="text-muted-foreground">{t('tableColumns.name')}</TableHead>
                  <TableHead className="text-muted-foreground">{t('tableColumns.phone')}</TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">{t('tableColumns.email')}</TableHead>
                  <TableHead className="text-muted-foreground hidden lg:table-cell">{t('tableColumns.company')}</TableHead>
                  <TableHead className="text-muted-foreground hidden md:table-cell">{t('tableColumns.tags')}</TableHead>
                  <TableHead className="text-muted-foreground hidden lg:table-cell">{t('tableColumns.createdAt')}</TableHead>
                  <TableHead className="text-muted-foreground w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <ContactsTableRowsSkeleton rows={8} />
                ) : contacts.length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="size-8 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedGroupId
                            ? 'No contacts in this group yet. Select contacts and click "Add to Group" or import a CSV.'
                            : t('noContactsYet')}
                        </p>
                        {!selectedGroupId && (
                          <GatedButton
                            canAct={canEdit}
                            gateReason={tGate('reasons.addOrImportContacts')}
                            variant="outline"
                            size="sm"
                            onClick={openAddForm}
                            className="mt-2 border-border text-muted-foreground hover:bg-muted"
                          >
                            <Plus className="size-3.5" />
                            {t('addFirstContact')}
                          </GatedButton>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => {
                    const igHandle = contact.ig_username || contact.secondaryChannels?.igUsername;
                    const fbUser = contact.fb_name || contact.secondaryChannels?.fbName;
                    const hasWa = Boolean(contact.phone || contact.secondaryChannels?.hasWhatsApp);

                    return (
                      <TableRow
                        key={contact.id}
                        className="border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => openDetail(contact.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(contact.id)}
                            onCheckedChange={() => toggleSelect(contact.id)}
                            aria-label={t('selectContact', { name: contact.name || contact.phone })}
                          />
                        </TableCell>
                        <TableCell className="text-foreground font-medium">
                          <div>
                            <span className="block truncate max-w-[12rem]">
                              {contact.name || <span className="text-muted-foreground italic">{t('unnamed')}</span>}
                            </span>
                            {/* Omnichannel Channel Badges */}
                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                              {hasWa && (
                                <span className="inline-flex items-center text-[9px] font-semibold text-emerald-600 bg-emerald-500/10 px-1 py-0.2 rounded">
                                  WhatsApp
                                </span>
                              )}
                              {igHandle && (
                                <span className="inline-flex items-center text-[9px] font-semibold text-pink-600 bg-pink-500/10 px-1 py-0.2 rounded">
                                  @{igHandle.replace(/^@/, '')}
                                </span>
                              )}
                              {fbUser && (
                                <span className="inline-flex items-center text-[9px] font-semibold text-blue-600 bg-blue-500/10 px-1 py-0.2 rounded">
                                  FB: {fbUser}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {contact.phone || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell text-sm">
                          {contact.email || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell text-sm">
                          {contact.company || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {contact.tags && contact.tags.length > 0 ? (
                              contact.tags.slice(0, 3).map((tg) => (
                                <span
                                  key={tg.id}
                                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    backgroundColor: tg.color + '20',
                                    color: tg.color,
                                  }}
                                >
                                  {tg.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                            {contact.tags && contact.tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{contact.tags.length - 3}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">
                          {new Date(contact.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-foreground"
                                />
                              }
                            >
                              <MoreHorizontal className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover border-border">
                              <DropdownMenuItem onClick={() => openEditForm(contact)}>
                                <Pencil className="size-4 mr-2" />
                                {t('editAction')}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-border" />
                              {selectedGroupId ? (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setRemoveFromGroupTarget(contact);
                                    setRemoveFromGroupConfirmOpen(true);
                                  }}
                                >
                                  <UserMinus className="size-4 mr-2" />
                                  Remove from Group
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => confirmDelete(contact)}
                                >
                                  <Trash2 className="size-4 mr-2" />
                                  {t('deleteAction')}
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('showingPagination', {
                  start: page * PAGE_SIZE + 1,
                  end: Math.min((page + 1) * PAGE_SIZE, totalCount),
                  total: totalCount,
                })}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label={t('prevPage')}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  aria-label={t('nextPage')}
                  className="border-border text-muted-foreground hover:bg-muted"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Contact Modal */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchGroups();
        }}
      />

      {/* Contact Details Dossier Modal */}
      <ContactDetailView
        contactId={detailContactId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={() => {
          fetchContacts();
          fetchGroups();
        }}
      />

      {/* CSV Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultGroupId={selectedGroupId}
        onImported={() => {
          fetchContacts();
          fetchGroups();
        }}
      />

      {/* Custom Fields Settings Modal */}
      <CustomFieldsManager
        open={customFieldsOpen}
        onOpenChange={setCustomFieldsOpen}
      />

      {/* Single Remove from Group Dialog */}
      <Dialog open={removeFromGroupConfirmOpen} onOpenChange={setRemoveFromGroupConfirmOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Remove from Group</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to remove {removeFromGroupTarget?.name || removeFromGroupTarget?.phone || 'this contact'} from &quot;{activeGroup?.name}&quot;?
              Their master profile and all chat history in the Inbox will NOT be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveFromGroupConfirmOpen(false)}
              disabled={removingFromGroup}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveContactFromGroup}
              disabled={removingFromGroup}
            >
              {removingFromGroup ? <Loader2 className="size-4 animate-spin" /> : 'Remove from Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Remove from Group Dialog */}
      <Dialog open={bulkRemoveFromGroupConfirmOpen} onOpenChange={setBulkRemoveFromGroupConfirmOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Remove Selected from Group</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to remove {selected.size} contact(s) from &quot;{activeGroup?.name}&quot;?
              Their master profiles and all chat history in the Inbox will NOT be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkRemoveFromGroupConfirmOpen(false)}
              disabled={bulkRemovingFromGroup}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveFromCurrentGroup}
              disabled={bulkRemovingFromGroup}
            >
              {bulkRemovingFromGroup ? <Loader2 className="size-4 animate-spin" /> : 'Remove from Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteConfirmDescription', { name: deleteTarget?.name || deleteTarget?.phone || '' })}
              <span className="block mt-1 text-xs text-muted-foreground/80">
                Note: Any message history in the Inbox is preserved.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancelAction')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : t('deleteAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteBulkTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t('deleteBulkDescription', { count: selected.size })}
              <span className="block mt-1 text-xs text-muted-foreground/80">
                Note: Any message history in the Inbox is preserved.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteOpen(false)}
              disabled={deleting}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t('cancelAction')}
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : t('deleteAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Group Dialog */}
      <Dialog open={newGroupOpen} onOpenChange={setNewGroupOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground flex items-center gap-2">
              <FolderKanban className="size-4 text-primary" />
              Create Contact Group
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Organize contacts into a group for broadcast campaigns or customer segmenting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Group Name *</label>
              <Input
                placeholder="e.g. VIP Clients, Solar Leads Nov"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Color</label>
              <div className="flex items-center gap-2">
                {['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewGroupColor(c)}
                    className={`size-6 rounded-full border-2 transition-transform ${
                      newGroupColor === c ? 'scale-110 border-foreground ring-1 ring-primary' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Description (Optional)</label>
              <Input
                placeholder="Brief summary of this audience group"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewGroupOpen(false)}
              disabled={creatingGroup}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={creatingGroup}>
              {creatingGroup ? <Loader2 className="size-4 animate-spin" /> : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Group Dialog */}
      <Dialog open={renameGroupOpen} onOpenChange={setRenameGroupOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Rename Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-medium text-foreground">Group Name</label>
            <Input
              value={renameGroupName}
              onChange={(e) => setRenameGroupName(e.target.value)}
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameGroupOpen(false)}
              disabled={renamingGroup}
            >
              Cancel
            </Button>
            <Button onClick={handleRenameGroup} disabled={renamingGroup}>
              {renamingGroup ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">Delete Contact Group</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete the group "{groupToDelete?.name}"? Contacts in this group will NOT be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteGroupOpen(false)}
              disabled={deletingGroup}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteGroup} disabled={deletingGroup}>
              {deletingGroup ? <Loader2 className="size-4 animate-spin" /> : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Selected Contacts to Group Dialog */}
      <Dialog open={addToGroupOpen} onOpenChange={setAddToGroupOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              Add {selected.size} Contact(s) to Group
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose the target group to add the selected contacts to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <label className="text-xs font-medium text-foreground">Target Group</label>
            {groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No groups created yet. Please create a group first.</p>
            ) : (
              <select
                value={targetGroupIdForAdd}
                onChange={(e) => setTargetGroupIdForAdd(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select a group...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count ?? 0} members)
                  </option>
                ))}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddToGroupOpen(false)}
              disabled={addingToGroup}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddToGroup}
              disabled={addingToGroup || !targetGroupIdForAdd}
            >
              {addingToGroup ? <Loader2 className="size-4 animate-spin" /> : 'Add to Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Selected Contacts to Another Group Dialog */}
      <Dialog open={moveGroupOpen} onOpenChange={setMoveGroupOpen}>
        <DialogContent className="bg-popover border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground flex items-center gap-2">
              <ArrowRightLeft className="size-4 text-primary" />
              Move {selected.size} Contact(s) to Another Group
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Move contacts from "{activeGroup?.name}" to a different group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-3">
            <label className="text-xs font-medium text-foreground">Destination Group</label>
            <select
              value={targetGroupIdForMove}
              onChange={(e) => setTargetGroupIdForMove(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Select destination group...</option>
              {groups
                .filter((g) => g.id !== selectedGroupId)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.member_count ?? 0} members)
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMoveGroupOpen(false)}
              disabled={movingGroup}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMoveToGroup}
              disabled={movingGroup || !targetGroupIdForMove}
            >
              {movingGroup ? <Loader2 className="size-4 animate-spin" /> : 'Move Contacts'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
