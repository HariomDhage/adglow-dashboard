import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import { cn } from '@/lib/utils';
import { Play, Pause, Copy, Trash2, Edit, Search, LayoutGrid, List, Loader2, X, Save, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  updateCampaignStatus as updateMetaStatus,
  updateCampaignOnMeta,
  updateAdSetOnMeta,
  deleteCampaign as archiveMetaCampaign,
  getCampaignDailyInsights,
} from '@/lib/facebook-api';

const tabs = ['All', 'Active', 'Paused', 'Draft', 'Completed'];

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/20 text-emerald-400',
  Paused: 'bg-amber-500/20 text-amber-400',
  Draft: 'bg-slate-500/20 text-slate-400',
  Completed: 'bg-blue-500/20 text-blue-400',
};

const metaStatusMap: Record<string, string> = {
  Active: 'ACTIVE',
  Paused: 'PAUSED',
  Draft: 'PAUSED',
  Completed: 'PAUSED',
};

const formatNum = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

const Campaigns = () => {
  const { user, fbConnection } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('All');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCampaign, setEditingCampaign] = useState<typeof campaigns[0] | null>(null);
  const [editForm, setEditForm] = useState({ name: '', daily_budget: '', status: '', primary_text: '', headline: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus, fbCampaignId, fbAdsetId }: { id: string; currentStatus: string; fbCampaignId?: string; fbAdsetId?: string }) => {
      const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
      const metaStatus = newStatus === 'Active' ? 'ACTIVE' : 'PAUSED';

      // Update on Meta if connected and campaign has a Meta ID
      if (fbConnection?.access_token && fbCampaignId) {
        try {
          await updateMetaStatus(fbCampaignId, metaStatus as 'ACTIVE' | 'PAUSED', fbConnection.access_token);
          // Also update ad set status
          if (fbAdsetId) {
            await updateAdSetOnMeta(fbAdsetId, { status: metaStatus }, fbConnection.access_token);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          toast.error(`Meta sync failed: ${msg}. Updated locally.`);
        }
      }

      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateCampaign = useMutation({
    mutationFn: async (campaign: typeof campaigns[0]) => {
      const { id, created_at, updated_at, fb_campaign_id, fb_adset_id, fb_ad_id, fb_creative_id, fb_video_id, total_spend, total_impressions, total_clicks, ctr, ...rest } = campaign;
      const { error } = await supabase.from('campaigns').insert({
        ...rest,
        name: `${campaign.name} (Copy)`,
        status: 'Draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCampaignMut = useMutation({
    mutationFn: async ({ id, fbCampaignId }: { id: string; fbCampaignId?: string }) => {
      // Archive on Meta if connected
      if (fbConnection?.access_token && fbCampaignId) {
        try {
          await archiveMetaCampaign(fbCampaignId, fbConnection.access_token);
        } catch (err) {
          console.warn('Meta delete failed, deleting locally:', err);
        }
      }

      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCampaign = useMutation({
    mutationFn: async ({ id, updates, fbCampaignId, fbAdsetId }: {
      id: string;
      updates: Record<string, unknown>;
      fbCampaignId?: string;
      fbAdsetId?: string;
    }) => {
      // Sync changes to Meta if connected
      if (fbConnection?.access_token && fbCampaignId) {
        try {
          // Sync campaign name and status
          const metaUpdates: { name?: string; status?: string } = {};
          if (updates.name) metaUpdates.name = updates.name as string;
          if (updates.status) metaUpdates.status = metaStatusMap[updates.status as string] || 'PAUSED';
          if (Object.keys(metaUpdates).length > 0) {
            await updateCampaignOnMeta(fbCampaignId, metaUpdates, fbConnection.access_token);
          }

          // Sync budget to ad set
          if (updates.daily_budget && fbAdsetId) {
            await updateAdSetOnMeta(fbAdsetId, {
              daily_budget: updates.daily_budget as number,
              status: metaStatusMap[updates.status as string] || undefined,
            }, fbConnection.access_token);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          toast.warning(`Updated locally. Meta sync failed: ${msg}`);
        }
      }

      const { error } = await supabase.from('campaigns').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign updated');
      setEditingCampaign(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sync single campaign analytics from Meta
  const handleSyncCampaign = async (campaign: typeof campaigns[0]) => {
    if (!fbConnection?.access_token || !campaign.fb_campaign_id) {
      toast.error('Campaign not linked to Meta');
      return;
    }
    setSyncingId(campaign.id);
    try {
      const insights = await getCampaignDailyInsights(campaign.fb_campaign_id, fbConnection.access_token);

      for (const row of insights) {
        const date = row.date_start || '';
        if (!date) continue;
        await supabase.from('campaign_analytics').upsert({
          campaign_id: campaign.id,
          date,
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          spend: Number(row.spend || 0),
          ctr: Number(row.ctr || 0),
          cpc: Number(row.cpc || 0),
          cpm: Number(row.cpm || 0),
          reach: Number(row.reach || 0),
        }, { onConflict: 'campaign_id,date' });
      }

      // Update totals
      if (insights.length > 0) {
        const totSpend = insights.reduce((s, r) => s + Number(r.spend || 0), 0);
        const totImpressions = insights.reduce((s, r) => s + Number(r.impressions || 0), 0);
        const totClicks = insights.reduce((s, r) => s + Number(r.clicks || 0), 0);
        await supabase.from('campaigns').update({
          total_spend: totSpend,
          total_impressions: totImpressions,
          total_clicks: totClicks,
        }).eq('id', campaign.id);
      }

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Synced analytics for "${campaign.name}"`);
    } catch (err) {
      toast.error(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setSyncingId(null);
  };

  const openEdit = (campaign: typeof campaigns[0]) => {
    setEditingCampaign(campaign);
    setEditForm({
      name: campaign.name,
      daily_budget: String((campaign.daily_budget || 0) / 100),
      status: campaign.status,
      primary_text: campaign.primary_text || '',
      headline: campaign.headline || '',
    });
  };

  const filtered = campaigns
    .filter(c => activeTab === 'All' || c.status === activeTab)
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campaigns</h1>
          <p className="text-muted-foreground mt-1">Manage and monitor all your ad campaigns.</p>
        </div>
        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView('grid')} className={cn('p-2 rounded-xl transition-all', view === 'grid' ? 'warm-gradient' : 'glass')}>
            <LayoutGrid className="w-4 h-4 text-foreground" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setView('list')} className={cn('p-2 rounded-xl transition-all', view === 'list' ? 'warm-gradient' : 'glass')}>
            <List className="w-4 h-4 text-foreground" />
          </motion.button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {tabs.map(tab => (
          <motion.button
            key={tab}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', activeTab === tab ? 'warm-gradient text-foreground' : 'glass text-muted-foreground hover:text-foreground')}
            style={activeTab === tab ? { boxShadow: '0 4px 20px rgba(255,107,107,0.3)' } : {}}
          >
            {tab}
          </motion.button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input className="glass-input pl-10 text-sm w-64" placeholder="Search campaigns..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No campaigns found</p>
          <p className="text-sm mt-1">Upload a video to create your first campaign.</p>
        </div>
      ) : (
        <div className={cn(view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-3')}>
          {filtered.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <GlassCard className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{c.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', statusColors[c.status] || 'bg-slate-500/20 text-slate-400')}>
                        {c.status}
                      </span>
                      {c.fb_campaign_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">Meta</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-data text-muted-foreground">${((c.daily_budget || 0) / 100).toFixed(0)}/day</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Spend</p>
                    <p className="text-sm font-data font-medium text-foreground">${Number(c.total_spend || 0).toFixed(0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Impressions</p>
                    <p className="text-sm font-data font-medium text-foreground">{formatNum(Number(c.total_impressions || 0))}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">CTR</p>
                    <p className="text-sm font-data font-medium text-foreground">
                      {Number(c.total_impressions || 0) > 0
                        ? ((Number(c.total_clicks || 0) / Number(c.total_impressions || 1)) * 100).toFixed(1)
                        : '0.0'}%
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => openEdit(c)}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title="Edit"
                  >
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleStatus.mutate({ id: c.id, currentStatus: c.status, fbCampaignId: c.fb_campaign_id, fbAdsetId: c.fb_adset_id })}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title={c.status === 'Active' ? 'Pause' : 'Resume'}
                  >
                    {c.status === 'Active' ? <Pause className="w-4 h-4 text-muted-foreground" /> : <Play className="w-4 h-4 text-muted-foreground" />}
                  </motion.button>
                  {c.fb_campaign_id && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSyncCampaign(c)}
                      disabled={syncingId === c.id}
                      className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all disabled:opacity-50"
                      title="Sync analytics from Meta"
                    >
                      {syncingId === c.id ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <RefreshCw className="w-4 h-4 text-muted-foreground" />}
                    </motion.button>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => duplicateCampaign.mutate(c)}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  {deleteConfirm === c.id ? (
                    <div className="flex items-center gap-1">
                      <motion.button
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        onClick={() => { deleteCampaignMut.mutate({ id: c.id, fbCampaignId: c.fb_campaign_id }); setDeleteConfirm(null); }}
                        className="px-2 py-1 rounded-lg bg-destructive/20 text-destructive text-xs font-medium hover:bg-destructive/30 transition-all"
                      >
                        Confirm
                      </motion.button>
                      <motion.button
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                        onClick={() => setDeleteConfirm(null)}
                        className="p-1 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                      >
                        <X className="w-3 h-3 text-muted-foreground" />
                      </motion.button>
                    </div>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setDeleteConfirm(c.id)}
                      className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </motion.button>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {editingCampaign && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setEditingCampaign(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl p-6 w-full max-w-lg border border-[var(--glass-border)]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">Edit Campaign</h2>
                <button onClick={() => setEditingCampaign(null)} className="p-1 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
              {editingCampaign.fb_campaign_id && (
                <div className="glass rounded-xl p-3 mb-4 border border-blue-500/20 bg-blue-500/5">
                  <p className="text-xs text-blue-400">Changes will be synced to Meta Ads Manager.</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Campaign Name</label>
                  <input className="glass-input w-full" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Daily Budget ($)</label>
                    <input className="glass-input w-full" type="number" min="1" value={editForm.daily_budget} onChange={e => setEditForm(f => ({ ...f, daily_budget: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-1.5 block">Status</label>
                    <select className="glass-input w-full" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                      <option>Active</option>
                      <option>Paused</option>
                      <option>Draft</option>
                      <option>Completed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Headline</label>
                  <input className="glass-input w-full" value={editForm.headline} onChange={e => setEditForm(f => ({ ...f, headline: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Primary Text</label>
                  <textarea className="glass-input w-full min-h-[80px] resize-none" value={editForm.primary_text} onChange={e => setEditForm(f => ({ ...f, primary_text: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={updateCampaign.isPending}
                  onClick={() => updateCampaign.mutate({
                    id: editingCampaign.id,
                    updates: {
                      name: editForm.name,
                      daily_budget: Math.round(Number(editForm.daily_budget) * 100),
                      status: editForm.status,
                      headline: editForm.headline,
                      primary_text: editForm.primary_text,
                    },
                    fbCampaignId: editingCampaign.fb_campaign_id,
                    fbAdsetId: editingCampaign.fb_adset_id,
                  })}
                  className="btn-warm flex items-center gap-2 disabled:opacity-60"
                >
                  {updateCampaign.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditingCampaign(null)} className="btn-glass">
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageTransition>
  );
};

export default Campaigns;
