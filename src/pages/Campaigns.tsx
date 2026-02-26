import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import { cn } from '@/lib/utils';
import { Play, Pause, Copy, Trash2, Edit, Search, LayoutGrid, List, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { updateCampaignStatus as updateMetaStatus, deleteCampaign as archiveMetaCampaign } from '@/lib/facebook-api';

const tabs = ['All', 'Active', 'Paused', 'Draft', 'Completed'];

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/20 text-emerald-400',
  Paused: 'bg-amber-500/20 text-amber-400',
  Draft: 'bg-slate-500/20 text-slate-400',
  Completed: 'bg-blue-500/20 text-blue-400',
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
    mutationFn: async ({ id, currentStatus, fbCampaignId }: { id: string; currentStatus: string; fbCampaignId?: string }) => {
      const newStatus = currentStatus === 'Active' ? 'Paused' : 'Active';

      // Update on Meta if connected and campaign has a Meta ID
      if (fbConnection?.access_token && fbCampaignId) {
        try {
          await updateMetaStatus(fbCampaignId, newStatus === 'Active' ? 'ACTIVE' : 'PAUSED', fbConnection.access_token);
        } catch (err) {
          console.warn('Meta status update failed, updating locally:', err);
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

  const deleteCampaign = useMutation({
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
                  <span className="text-sm font-data text-muted-foreground">${(c.daily_budget / 100).toFixed(0)}/day</span>
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
                    <p className="text-sm font-data font-medium text-foreground">{Number(c.ctr || 0).toFixed(1)}%</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.9 }} className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all" title="Edit">
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => toggleStatus.mutate({ id: c.id, currentStatus: c.status, fbCampaignId: c.fb_campaign_id })}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title={c.status === 'Active' ? 'Pause' : 'Resume'}
                  >
                    {c.status === 'Active' ? <Pause className="w-4 h-4 text-muted-foreground" /> : <Play className="w-4 h-4 text-muted-foreground" />}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => duplicateCampaign.mutate(c)}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4 text-muted-foreground" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => { if (confirm('Delete this campaign?')) deleteCampaign.mutate({ id: c.id, fbCampaignId: c.fb_campaign_id }); }}
                    className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </motion.button>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </PageTransition>
  );
};

export default Campaigns;
