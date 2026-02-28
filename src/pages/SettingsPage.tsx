import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import { User, Bell, CreditCard, Link2, Loader2, Check, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getAdAccountCampaigns, getCampaignInsights } from '@/lib/facebook-api';

const SettingsPage = () => {
  const { user, profile, fbConnection } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const { data: fbConnectionData } = useQuery({
    queryKey: ['fb-connection'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fb_connections')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: notifPrefs } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const updateNotif = useMutation({
    mutationFn: async (updates: { campaign_status?: boolean; budget_alerts?: boolean; weekly_reports?: boolean }) => {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  });

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, email, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Profile updated!');
    }
  };

  const handleImportFromMeta = async () => {
    if (!fbConnection?.access_token || !fbConnection.ad_account_id || !user) return;
    setImporting(true);
    try {
      toast.info('Fetching your campaigns from Meta...');
      const metaCampaigns = await getAdAccountCampaigns(fbConnection.ad_account_id, fbConnection.access_token);

      if (metaCampaigns.length === 0) {
        toast.info('No campaigns found in your Meta ad account.');
        setImporting(false);
        return;
      }

      const statusMap: Record<string, string> = { ACTIVE: 'Active', PAUSED: 'Paused', ARCHIVED: 'Draft', DELETED: 'Draft' };
      let imported = 0;

      for (const c of metaCampaigns) {
        // Upsert campaign — skip if already imported by fb_campaign_id
        const { data: existing } = await supabase
          .from('campaigns')
          .select('id')
          .eq('fb_campaign_id', c.id)
          .eq('user_id', user.id)
          .single();

        let campaignId = existing?.id;

        if (!campaignId) {
          const { data: inserted } = await supabase.from('campaigns').insert({
            user_id: user.id,
            name: c.name,
            objective: c.objective,
            status: statusMap[c.status] || 'Draft',
            daily_budget: c.daily_budget ? Number(c.daily_budget) : 0,
            targeting: {},
            fb_campaign_id: c.id,
          }).select('id').single();
          campaignId = inserted?.id;
          imported++;
        }

        // Fetch last 30 days insights and store
        if (campaignId) {
          try {
            const insights = await getCampaignInsights(c.id, 'last_30d', fbConnection.access_token);
            if (insights.length > 0) {
              const row = insights[0];
              await supabase.from('campaigns').update({
                total_spend: Math.round(Number(row.spend || 0) * 100),
                total_impressions: Number(row.impressions || 0),
                total_clicks: Number(row.clicks || 0),
              }).eq('id', campaignId);
            }
          } catch { /* insights may not be available */ }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Imported ${imported} new campaign${imported !== 1 ? 's' : ''} from Meta! (${metaCampaigns.length} total found)`);
    } catch (err) {
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setImporting(false);
  };

  const handleConnectFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        scopes: 'ads_management,ads_read,business_management,pages_read_engagement',
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) toast.error(error.message);
  };


  const initials = (fullName || email || 'U').charAt(0).toUpperCase();
  const notifItems = [
    { key: 'campaign_status' as const, label: 'Campaign status changes', desc: 'Get notified when campaigns start, pause, or complete', checked: notifPrefs?.campaign_status ?? true },
    { key: 'budget_alerts' as const, label: 'Budget alerts', desc: 'Alert when spending exceeds thresholds', checked: notifPrefs?.budget_alerts ?? true },
    { key: 'weekly_reports' as const, label: 'Weekly performance reports', desc: 'Receive a summary every Monday', checked: notifPrefs?.weekly_reports ?? false },
  ];

  return (
    <PageTransition>
      <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Manage your account and preferences.</p>

      <div className="space-y-6 max-w-3xl">
        {/* Profile */}
        <GlassCard hoverable={false} className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><User className="w-5 h-5" /> Profile</h2>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl warm-gradient flex items-center justify-center text-2xl font-bold text-foreground">{initials}</div>
            <div>
              <p className="font-medium text-foreground">{fullName || 'User'}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Full Name</label>
              <input className="glass-input" value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
              <input className="glass-input" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
        </GlassCard>

        {/* Facebook Connection */}
        <GlassCard hoverable={false} className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Link2 className="w-5 h-5" /> Facebook Connection</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">Facebook Ad Account</p>
                {fbConnectionData?.access_token ? (
                  <div className="space-y-1 mt-1">
                    <p className="text-sm text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Facebook connected</p>
                    {fbConnectionData.ad_account_id ? (
                      <p className="text-xs text-muted-foreground">Ad Account: {fbConnectionData.ad_account_id}</p>
                    ) : (
                      <p className="text-xs text-amber-400">Ad account will be linked automatically after connecting</p>
                    )}
                    {fbConnectionData.page_id && (
                      <p className="text-xs text-muted-foreground">Page ID: {fbConnectionData.page_id}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Connect your Facebook account to manage ads</p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {fbConnectionData?.ad_account_id && (
                  <motion.button
                    onClick={handleImportFromMeta}
                    disabled={importing}
                    whileTap={{ scale: importing ? 1 : 0.95 }}
                    className="btn-glass text-sm flex items-center gap-2 disabled:opacity-60"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Import from Meta
                  </motion.button>
                )}
                <motion.button onClick={handleConnectFacebook} whileTap={{ scale: 0.95 }} className="btn-warm text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"/>
                  </svg>
                  {fbConnectionData?.access_token ? 'Reconnect Facebook' : 'Connect Facebook'}
                </motion.button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Notifications */}
        <GlassCard hoverable={false} className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</h2>
          <div className="space-y-4">
            {notifItems.map(item => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={e => updateNotif.mutate({ [item.key]: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-coral after:bg-foreground" style={{ background: 'var(--glass-bg)' }} />
                </label>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Billing */}
        <GlassCard hoverable={false} className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5" /> Billing</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground font-medium">Free Plan</p>
              <p className="text-sm text-muted-foreground">Manage your campaigns with AdFlow</p>
            </div>
          </div>
        </GlassCard>

        <motion.button
          onClick={handleSave}
          disabled={saving}
          whileTap={{ scale: saving ? 1 : 0.97 }}
          className="btn-warm w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save Changes
        </motion.button>
      </div>
    </PageTransition>
  );
};

export default SettingsPage;
