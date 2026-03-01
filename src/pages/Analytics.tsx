import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import StatCard from '@/components/StatCard';
import GlassCard from '@/components/GlassCard';
import { cn } from '@/lib/utils';
import { DollarSign, Eye, MousePointerClick, Target, Users, Monitor, Smartphone, Loader2, Download, RefreshCw } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getCampaignDailyInsights, getCampaignBreakdownInsights } from '@/lib/facebook-api';

const dateRanges = ['Today', '7D', '30D', '90D'];

const Analytics = () => {
  const { user, fbConnection } = useAuth();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState('30D');
  const [syncing, setSyncing] = useState(false);

  const daysMap: Record<string, number> = { Today: 1, '7D': 7, '30D': 30, '90D': 90 };
  const days = daysMap[dateRange] || 30;

  // First fetch user's campaigns to get IDs for filtering
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('campaigns').select('*').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const campaignIds = campaigns.map(c => c.id);

  // Filter analytics by user's campaigns
  const { data: analyticsData = [], isLoading } = useQuery({
    queryKey: ['analytics', dateRange, campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data } = await supabase
        .from('campaign_analytics')
        .select('*')
        .in('campaign_id', campaignIds)
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!user && campaignIds.length > 0,
  });

  // Filter breakdowns by user's campaigns
  const { data: breakdowns = [] } = useQuery({
    queryKey: ['breakdowns', dateRange, campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data } = await supabase
        .from('audience_breakdowns')
        .select('*')
        .in('campaign_id', campaignIds)
        .gte('date', since.toISOString().split('T')[0]);
      return data || [];
    },
    enabled: !!user && campaignIds.length > 0,
  });

  // Compute stats from filtered analytics data (not campaign lifetime totals)
  const totalSpend = analyticsData.reduce((s, a) => s + Number(a.spend || 0), 0);
  const totalImpressions = analyticsData.reduce((s, a) => s + Number(a.impressions || 0), 0);
  const totalClicks = analyticsData.reduce((s, a) => s + Number(a.clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Aggregate daily analytics across all campaigns
  const chartData = (() => {
    if (analyticsData.length === 0) return [];
    const dayMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    analyticsData.forEach(a => {
      const key = a.date;
      const prev = dayMap.get(key) || { impressions: 0, clicks: 0, spend: 0 };
      dayMap.set(key, {
        impressions: prev.impressions + Number(a.impressions || 0),
        clicks: prev.clicks + Number(a.clicks || 0),
        spend: prev.spend + Number(a.spend || 0),
      });
    });
    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ day: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), ...vals }));
  })();

  // Aggregate breakdowns by value (sum across all campaigns)
  const aggregate = (items: typeof breakdowns) => {
    const map = new Map<string, number>();
    items.forEach(b => map.set(b.breakdown_value, (map.get(b.breakdown_value) || 0) + Number(b.impressions || 0)));
    return map;
  };

  const ageMap = aggregate(breakdowns.filter(b => b.breakdown_type === 'age'));
  const genderMap = aggregate(breakdowns.filter(b => b.breakdown_type === 'gender'));
  const deviceMap = aggregate(breakdowns.filter(b => b.breakdown_type === 'device'));

  const ageOrder = ['18-24', '25-34', '35-44', '45-54', '55+'];
  const ageData = ageMap.size > 0
    ? ageOrder.map(age => ({ age, value: ageMap.get(age) || 0 }))
    : ageOrder.map(age => ({ age, value: 0 }));

  const ageTotal = ageData.reduce((s, d) => s + d.value, 0) || 1;
  const ageDataPercent = ageData.map(d => ({ ...d, value: Math.round((d.value / ageTotal) * 100) }));

  const genderColorMap: Record<string, string> = { Male: '#FF6B6B', Female: '#FFC857', Other: '#FF8E53' };
  const genderOrder = ['Male', 'Female', 'Other'];
  const genderData = genderMap.size > 0
    ? genderOrder.map(name => ({ name, value: genderMap.get(name) || 0, color: genderColorMap[name] }))
    : genderOrder.map(name => ({ name, value: 0, color: genderColorMap[name] }));

  const genderTotal = genderData.reduce((s, d) => s + d.value, 0) || 1;
  const genderDataPercent = genderData.map(d => ({ ...d, value: Math.round((d.value / genderTotal) * 100) || 0 }));

  const deviceColorMap: Record<string, string> = { Mobile: '#FF6B6B', Desktop: '#FFC857', Tablet: '#FF8E53' };
  const deviceOrder = ['Mobile', 'Desktop', 'Tablet'];
  const deviceData = deviceMap.size > 0
    ? deviceOrder.map(name => ({ name, value: deviceMap.get(name) || 0, color: deviceColorMap[name] }))
    : deviceOrder.map(name => ({ name, value: 0, color: deviceColorMap[name] }));

  const deviceTotal = deviceData.reduce((s, d) => s + d.value, 0) || 1;
  const deviceDataPercent = deviceData.map(d => ({ ...d, value: Math.round((d.value / deviceTotal) * 100) || 0 }));

  const exportCSV = () => {
    if (chartData.length === 0) return;
    const header = 'Date,Impressions,Clicks,Spend,CTR\n';
    const rows = chartData.map(d => {
      const ctr = d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0';
      return `${d.day},${d.impressions},${d.clicks},${d.spend.toFixed(2)},${ctr}%`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Sync analytics from Meta for all campaigns with a fb_campaign_id
  const handleSyncFromMeta = async () => {
    if (!fbConnection?.access_token || !fbConnection.ad_account_id) {
      toast.error('No Facebook connection. Connect in Settings first.');
      return;
    }

    // Check token expiry
    if (fbConnection.token_expires_at && new Date(fbConnection.token_expires_at) < new Date()) {
      toast.error('Facebook token expired. Reconnect in Settings.');
      return;
    }

    const metaCampaigns = campaigns.filter(c => c.fb_campaign_id);
    if (metaCampaigns.length === 0) {
      toast.info('No campaigns linked to Meta. Launch a campaign first.');
      return;
    }

    setSyncing(true);
    let synced = 0;

    for (const campaign of metaCampaigns) {
      try {
        // Fetch daily insights
        const dailyInsights = await getCampaignDailyInsights(
          campaign.fb_campaign_id!,
          fbConnection.access_token,
          days
        );

        // Upsert daily analytics
        for (const row of dailyInsights) {
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

        // Update campaign totals
        if (dailyInsights.length > 0) {
          const totSpend = dailyInsights.reduce((s, r) => s + Number(r.spend || 0), 0);
          const totImpressions = dailyInsights.reduce((s, r) => s + Number(r.impressions || 0), 0);
          const totClicks = dailyInsights.reduce((s, r) => s + Number(r.clicks || 0), 0);
          await supabase.from('campaigns').update({
            total_spend: totSpend,
            total_impressions: totImpressions,
            total_clicks: totClicks,
          }).eq('id', campaign.id);
        }

        // Fetch audience breakdowns
        for (const breakdownType of ['age', 'gender', 'device_platform'] as const) {
          try {
            const breakdownData = await getCampaignBreakdownInsights(
              campaign.fb_campaign_id!,
              breakdownType,
              fbConnection.access_token,
              days
            );
            const dbType = breakdownType === 'device_platform' ? 'device' : breakdownType;
            for (const row of breakdownData) {
              const date = row.date_start || '';
              const value = breakdownType === 'age' ? row.age
                : breakdownType === 'gender' ? (row.gender === '1' ? 'Male' : row.gender === '2' ? 'Female' : 'Other')
                : row.device_platform || 'Unknown';
              if (!date || !value) continue;

              // Map device_platform values
              const displayValue = breakdownType === 'device_platform'
                ? (value === 'mobile_app' || value === 'mobile_web' ? 'Mobile'
                  : value === 'desktop' ? 'Desktop'
                  : 'Tablet')
                : (breakdownType === 'gender'
                  ? (value === '1' ? 'Male' : value === '2' ? 'Female' : 'Other')
                  : value);

              await supabase.from('audience_breakdowns').upsert({
                campaign_id: campaign.id,
                date,
                breakdown_type: dbType,
                breakdown_value: displayValue,
                impressions: Number(row.impressions || 0),
                clicks: Number(row.clicks || 0),
                spend: Number(row.spend || 0),
              }, { onConflict: 'campaign_id,date,breakdown_type,breakdown_value' });
            }
          } catch {
            // Some breakdowns may not be available
          }
        }

        synced++;
      } catch (err) {
        console.error(`Failed to sync campaign ${campaign.name}:`, err);
      }
    }

    // Refresh queries
    queryClient.invalidateQueries({ queryKey: ['analytics'] });
    queryClient.invalidateQueries({ queryKey: ['breakdowns'] });
    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-analytics'] });

    setSyncing(false);
    toast.success(`Synced analytics for ${synced}/${metaCampaigns.length} campaigns from Meta.`);
  };

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Deep dive into your campaign performance.</p>
        </div>
        <div className="flex gap-2">
          {fbConnection?.ad_account_id && (
            <motion.button whileTap={{ scale: syncing ? 1 : 0.95 }} onClick={handleSyncFromMeta} disabled={syncing}
              className="btn-glass flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync from Meta
            </motion.button>
          )}
          {chartData.length > 0 && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={exportCSV}
              className="btn-glass flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium">
              <Download className="w-4 h-4" /> Export CSV
            </motion.button>
          )}
          {dateRanges.map(range => (
            <motion.button key={range} whileTap={{ scale: 0.95 }} onClick={() => setDateRange(range)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', dateRange === range ? 'warm-gradient text-foreground' : 'glass text-muted-foreground')}>
              {range}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Spend" value={totalSpend} prefix="$" icon={<DollarSign className="w-5 h-5 text-foreground" />} index={0} />
        <StatCard label="Impressions" value={totalImpressions} icon={<Eye className="w-5 h-5 text-foreground" />} index={1} />
        <StatCard label="Clicks" value={totalClicks} icon={<MousePointerClick className="w-5 h-5 text-foreground" />} index={2} />
        <StatCard label="CTR" value={Number(avgCtr.toFixed(1))} suffix="%" icon={<Target className="w-5 h-5 text-foreground" />} index={3} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : campaigns.length === 0 ? (
        <GlassCard hoverable={false} className="p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No campaigns yet</h3>
          <p className="text-muted-foreground">Create your first campaign to see analytics data here.</p>
        </GlassCard>
      ) : (
        <>
          <GlassCard hoverable={false} className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Trend</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFC857" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#FFC857" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" stroke="#A0AEC0" fontSize={11} tickLine={false} axisLine={false} interval={4} />
                  <YAxis stroke="#A0AEC0" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: 'rgba(15,15,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Area type="monotone" dataKey="impressions" stroke="#FF6B6B" fill="url(#coralGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="clicks" stroke="#FFC857" fill="url(#goldGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                <div className="text-center">
                  <p>No analytics data for this period.</p>
                  {fbConnection?.ad_account_id && (
                    <p className="text-sm mt-1">Click "Sync from Meta" to pull real data.</p>
                  )}
                </div>
              </div>
            )}
          </GlassCard>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <GlassCard hoverable={false} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Users className="w-4 h-4" /> Age Distribution</h3>
              <div className="space-y-3">
                {ageDataPercent.map((d, i) => (
                  <div key={d.age}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{d.age}</span>
                      <span className="font-data text-foreground">{d.value}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                      <motion.div className="h-full rounded-full warm-gradient" initial={{ width: 0 }} animate={{ width: `${d.value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} />
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard hoverable={false} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4">Gender Split</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={genderDataPercent} innerRadius={50} outerRadius={70} dataKey="value" paddingAngle={4}>
                    {genderDataPercent.map((entry, i) => (<Cell key={i} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'rgba(15,15,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {genderDataPercent.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} {d.value}%
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard hoverable={false} className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Monitor className="w-4 h-4" /> Devices</h3>
              <div className="space-y-4 mt-6">
                {deviceDataPercent.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-3">
                    {d.name === 'Mobile' ? <Smartphone className="w-4 h-4 text-muted-foreground" /> : <Monitor className="w-4 h-4 text-muted-foreground" />}
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-data text-foreground">{d.value}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                        <motion.div className="h-full rounded-full" style={{ background: d.color }} initial={{ width: 0 }} animate={{ width: `${d.value}%` }} transition={{ duration: 0.8, delay: i * 0.1 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </PageTransition>
  );
};

export default Analytics;
