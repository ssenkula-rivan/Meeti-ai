import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, type Colors } from '../../theme';
import { actionItemsApi, meetingsApi, authApi, type ActionItem, type Meeting } from '../../lib/api';

/* Action items (Tasks) for mobile — mirrors the web "Action items" screen:
   metric summary, Open / Assigned to me / Completed tabs, a task list with
   complete-toggle + status/priority badges, and an add-item modal. Backed by
   the live API (GET /action-items/user, PATCH /action-items/:id,
   POST /action-items). Styled to the app's blue theme. */

type TabKey = 'open' | 'mine' | 'completed';

const OPEN_STATUSES: ActionItem['status'][] = ['pending', 'in_progress'];
const isOpen = (s: ActionItem['status']) => OPEN_STATUSES.includes(s);

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export default function TasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [items, setItems] = useState<ActionItem[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meName, setMeName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [tab, setTab] = useState<TabKey>('open');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState<{ meetingId: string; task: string; assignee: string; priority: 'low' | 'medium' | 'high' }>({
    meetingId: '',
    task: '',
    assignee: '',
    priority: 'medium',
  });

  const loadData = useCallback(async () => {
    try {
      const [itemsRes, meetingsRes, profileRes] = await Promise.all([
        actionItemsApi.getUserItems(),
        meetingsApi.list().catch(() => ({ data: [] as Meeting[] })),
        authApi.getProfile().catch(() => null),
      ]);
      setItems(itemsRes.data || []);
      setMeetings(meetingsRes.data || []);
      setMeName((profileRes?.data?.profile?.full_name || '').trim());
      if (meetingsRes.data?.length) {
        setNewItem((p) => (p.meetingId ? p : { ...p, meetingId: meetingsRes.data[0].id }));
      }
    } catch (err: any) {
      console.warn('Failed to load action items:', err?.message || err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const reloadItems = useCallback(async () => {
    try {
      const res = await actionItemsApi.getUserItems();
      setItems(res.data || []);
    } catch (err: any) {
      console.warn('Failed to reload action items:', err?.message || err);
    }
  }, []);

  const toggleDone = useCallback(async (item: ActionItem) => {
    const next = item.status === 'completed' ? 'pending' : 'completed';
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: next as ActionItem['status'] } : i)));
    try {
      await actionItemsApi.updateStatus(item.id, next);
    } catch (err: any) {
      console.warn('Failed to update status:', err?.message || err);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!newItem.task.trim() || !newItem.meetingId) return;
    setCreating(true);
    try {
      await actionItemsApi.create(newItem.meetingId, {
        task: newItem.task.trim(),
        assignee: newItem.assignee.trim() || undefined,
        priority: newItem.priority,
      });
      setNewItem({ meetingId: meetings[0]?.id || '', task: '', assignee: '', priority: 'medium' });
      setShowAdd(false);
      await reloadItems();
    } catch (err: any) {
      console.warn('Failed to create action item:', err?.message || err);
    } finally {
      setCreating(false);
    }
  }, [newItem, meetings, reloadItems]);

  const isMine = useCallback(
    (item: ActionItem) => {
      if (!meName || !item.assignee) return false;
      const a = item.assignee.toLowerCase();
      const me = meName.toLowerCase();
      return a === me || a.includes(me) || me.includes(a);
    },
    [meName],
  );

  const openItems = useMemo(() => items.filter((i) => isOpen(i.status)), [items]);
  const completedItems = useMemo(() => items.filter((i) => i.status === 'completed'), [items]);
  const mineItems = useMemo(() => openItems.filter(isMine), [openItems, isMine]);

  const now = new Date();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const dueToday = openItems.filter((i) => i.due_date && sameDay(new Date(i.due_date), now)).length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;

  const visible = useMemo(() => {
    let base = tab === 'open' ? openItems : tab === 'mine' ? mineItems : completedItems;
    const q = searchQuery.trim().toLowerCase();
    if (q) base = base.filter((i) => i.task.toLowerCase().includes(q) || (i.meeting_title || '').toLowerCase().includes(q));
    return base;
  }, [tab, openItems, mineItems, completedItems, searchQuery]);

  const statusMeta = (item: ActionItem) => {
    if (item.status === 'completed') return { label: 'Completed', bg: colors.successSoft, fg: colors.success };
    if (item.status === 'in_progress') return { label: 'In progress', bg: colors.primarySoft, fg: colors.primary };
    if (item.due_date && new Date(item.due_date) < today0) return { label: 'Overdue', bg: colors.dangerSoft, fg: colors.danger };
    return { label: 'To do', bg: colors.neutralSoft, fg: colors.textMuted };
  };
  const priorityMeta = (p?: ActionItem['priority']) => {
    if (p === 'high') return { label: 'High', bg: colors.dangerSoft, fg: colors.danger };
    if (p === 'medium') return { label: 'Medium', bg: colors.warningSoft, fg: colors.warning };
    return { label: 'Low', bg: colors.neutralSoft, fg: colors.textMuted };
  };
  const dueMeta = (item: ActionItem) => {
    if (!item.due_date) return null;
    const d = new Date(item.due_date);
    if (item.status === 'completed') return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: colors.textMuted };
    if (sameDay(d, now)) return { text: 'Today', color: colors.warning };
    if (d < today0) return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: colors.danger };
    return { text: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), color: colors.textMuted };
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'open', label: 'Open', count: openItems.length },
    { key: 'mine', label: 'Mine', count: mineItems.length },
    { key: 'completed', label: 'Done', count: completedItems.length },
  ];

  return (
    <View style={styles.container}>
      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricTile colors={colors} icon="list-outline" value={openItems.length} label="Open" tone={colors.primary} />
        <MetricTile colors={colors} icon="today-outline" value={dueToday} label="Due today" tone={colors.warning} />
        <MetricTile colors={colors} icon="hourglass-outline" value={inProgress} label="In progress" tone={colors.primary} />
        <MetricTile colors={colors} icon="checkmark-done-outline" value={completedItems.length} label="Completed" tone={colors.success} />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Filter action items..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabChip, active && styles.tabChipActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label} · {t.count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkbox-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {tab === 'completed' ? 'Nothing completed yet' : tab === 'mine' ? 'Nothing assigned to you' : 'No open action items'}
            </Text>
            <Text style={styles.emptySubtitle}>Action items are extracted when meetings finish processing.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const done = item.status === 'completed';
          const st = statusMeta(item);
          const pr = priorityMeta(item.priority);
          const due = dueMeta(item);
          return (
            <View style={styles.taskCard}>
              <TouchableOpacity style={styles.checkWrap} onPress={() => toggleDone(item)}>
                <Ionicons
                  name={done ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={done ? colors.success : colors.textMuted}
                />
              </TouchableOpacity>
              <View style={styles.taskBody}>
                <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
                  {item.task}
                </Text>
                {item.meeting_id && (
                  <TouchableOpacity onPress={() => router.push(`/meetings/${item.meeting_id}`)} disabled={!item.meeting_id}>
                    <View style={styles.sourceRow}>
                      <Ionicons name="videocam-outline" size={13} color={colors.primary} />
                      <Text style={styles.sourceText} numberOfLines={1}>
                        {item.meeting_title || 'Source meeting'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: pr.bg }]}>
                    <Text style={[styles.badgeText, { color: pr.fg }]}>{pr.label}</Text>
                  </View>
                  {due && (
                    <View style={styles.dueWrap}>
                      <Ionicons name="calendar-outline" size={13} color={due.color} />
                      <Text style={[styles.dueText, { color: due.color }]}>{due.text}</Text>
                    </View>
                  )}
                  {item.assignee ? (
                    <View style={styles.assigneeWrap}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initialsOf(item.assignee)}</Text>
                      </View>
                      <Text style={styles.assigneeText} numberOfLines={1}>{item.assignee}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Floating add button */}
      {meetings.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </TouchableOpacity>
      )}

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowAdd(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Add action item</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Task</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Send updated roadmap to client"
              placeholderTextColor={colors.textMuted}
              value={newItem.task}
              onChangeText={(v) => setNewItem((p) => ({ ...p, task: v }))}
              multiline
            />

            <Text style={styles.fieldLabel}>Assignee (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sarah Reed"
              placeholderTextColor={colors.textMuted}
              value={newItem.assignee}
              onChangeText={(v) => setNewItem((p) => ({ ...p, assignee: v }))}
            />

            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as const).map((p) => {
                const active = newItem.priority === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priorityChip, active && styles.priorityChipActive]}
                    onPress={() => setNewItem((prev) => ({ ...prev, priority: p }))}
                  >
                    <Text style={[styles.priorityChipText, active && styles.priorityChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Meeting</Text>
            <ScrollView style={styles.meetingList} horizontal showsHorizontalScrollIndicator={false}>
              {meetings.map((m) => {
                const active = newItem.meetingId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.meetingChip, active && styles.meetingChipActive]}
                    onPress={() => setNewItem((prev) => ({ ...prev, meetingId: m.id }))}
                  >
                    <Text style={[styles.meetingChipText, active && styles.meetingChipTextActive]} numberOfLines={1}>
                      {m.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.submitBtn, (!newItem.task.trim() || !newItem.meetingId || creating) && styles.submitBtnDisabled]}
              onPress={handleCreate}
              disabled={!newItem.task.trim() || !newItem.meetingId || creating}
            >
              <Text style={styles.submitBtnText}>{creating ? 'Saving...' : 'Create action item'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function MetricTile({
  colors,
  icon,
  value,
  label,
  tone,
}: {
  colors: Colors;
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tone: string;
}) {
  const st = createStyles(colors);
  return (
    <View style={st.metricTile}>
      <Ionicons name={icon} size={16} color={tone} />
      <Text style={st.metricValue}>{value}</Text>
      <Text style={st.metricLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (c: Colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background },

    metricsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 12 },
    metricTile: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 10,
      alignItems: 'center',
      gap: 2,
    },
    metricValue: { fontSize: 18, fontWeight: '700', color: c.text },
    metricLabel: { fontSize: 11, color: c.textMuted },

    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.card,
      marginHorizontal: 12,
      marginTop: 12,
      marginBottom: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: c.text },

    tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
    tabChip: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
    },
    tabChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    tabText: { fontSize: 13, color: c.textMuted, fontWeight: '500' },
    tabTextActive: { color: c.onPrimary },

    listContent: { padding: 12, paddingTop: 4, paddingBottom: 96 },
    taskCard: {
      flexDirection: 'row',
      backgroundColor: c.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
      gap: 10,
    },
    checkWrap: { paddingTop: 2 },
    taskBody: { flex: 1 },
    taskTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    taskTitleDone: { color: c.textMuted, textDecorationLine: 'line-through' },
    sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    sourceText: { fontSize: 12, color: c.primary, flex: 1 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    dueWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    dueText: { fontSize: 11, fontWeight: '500' },
    assigneeWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    avatar: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 9, fontWeight: '700', color: c.primary },
    assigneeText: { fontSize: 12, color: c.textMuted, maxWidth: 100 },

    empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: c.text, marginTop: 12 },
    emptySubtitle: { fontSize: 13, color: c.textMuted, textAlign: 'center', marginTop: 4 },

    fab: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },

    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: c.card,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      padding: 20,
      paddingBottom: 32,
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.text },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: c.textMuted, marginTop: 12, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: c.text,
      backgroundColor: c.inputBg,
      minHeight: 44,
    },
    priorityRow: { flexDirection: 'row', gap: 8 },
    priorityChip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: c.neutralSoft,
      borderWidth: 1,
      borderColor: c.border,
    },
    priorityChipActive: { backgroundColor: c.primary, borderColor: c.primary },
    priorityChipText: { fontSize: 13, color: c.textMuted, textTransform: 'capitalize' },
    priorityChipTextActive: { color: c.onPrimary },
    meetingList: { flexGrow: 0 },
    meetingChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 16,
      backgroundColor: c.neutralSoft,
      borderWidth: 1,
      borderColor: c.border,
      marginRight: 8,
      maxWidth: 200,
    },
    meetingChipActive: { backgroundColor: c.primarySoft, borderColor: c.primary },
    meetingChipText: { fontSize: 13, color: c.text },
    meetingChipTextActive: { color: c.primary, fontWeight: '600' },
    submitBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: c.onPrimary, fontSize: 15, fontWeight: '700' },
  });
