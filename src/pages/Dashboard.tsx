import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import StatCard from '@/components/StatCard';
import GlassCard from '@/components/GlassCard';
import { DollarSign, Eye, MousePointerClick, Rocket, Upload, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

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

const Dashboard = () => {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'there';

  const { data: campaigns = [] } = useQuery({
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

  const campaignIds = campaigns.map(c => c.id);

  const { data: analyticsData = [] } = useQuery({
    queryKey: ['dashboard-analytics', campaignIds],
    queryFn: async () => {
      if (campaignIds.length === 0) return [];
      const { data } = await supabase
        .from('campaign_analytics')
        .select('*')
        .in('campaign_id', campaignIds)
        .order('date', { ascending: true })
        .limit(30);
      return data || [];
    },
    enabled: !!user && campaignIds.length > 0,
  });

  const totalSpend = campaigns.reduce((sum, c) => sum + Number(c.total_spend || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + Number(c.total_impressions || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + Number(c.total_clicks || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;
  const recentCampaigns = campaigns.slice(0, 4);

  const chartData = analyticsData.length > 0
    ? analyticsData.map(a => ({
        name: new Date(a.date).toLocaleDateString('en', { weekday: 'short' }),
        impressions: Number(a.impressions || 0),
        clicks: Number(a.clicks || 0),
      }))
    : [];

  // Build sparklines from last 7 analytics entries
  const spendSpark = analyticsData.slice(-7).map(a => Number(a.spend || 0));
  const impSpark = analyticsData.slice(-7).map(a => Number(a.impressions || 0));
  const clickSpark = analyticsData.slice(-7).map(a => Number(a.clicks || 0));

  return (
    <PageTransition>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, <span className="warm-gradient-text">{displayName}</span>
        </h1>
        <p className="text-muted-foreground mt-1">Here's how your campaigns are performing today.</p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Spend" value={totalSpend} prefix="$" icon={<DollarSign className="w-5 h-5 text-foreground" />} index={0} sparkline={spendSpark.length > 0 ? spendSpark : undefined} />
        <StatCard label="Impressions" value={totalImpressions} icon={<Eye className="w-5 h-5 text-foreground" />} index={1} sparkline={impSpark.length > 0 ? impSpark : undefined} />
        <StatCard label="Total Clicks" value={totalClicks} icon={<MousePointerClick className="w-5 h-5 text-foreground" />} index={2} sparkline={clickSpark.length > 0 ? clickSpark : undefined} />
        <StatCard label="Active Campaigns" value={activeCampaigns} icon={<Rocket className="w-5 h-5 text-foreground" />} index={3} />
      </div>

      {campaigns.length > 0 && (
        <GlassCard hoverable={false} className="p-4 mb-8 border border-emerald-500/10 bg-emerald-500/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Performance Insight</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {(() => {
                  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
                  const topCampaign = [...campaigns].sort((a, b) => {
                    const ctrA = Number(a.total_impressions || 0) > 0 ? Number(a.total_clicks || 0) / Number(a.total_impressions || 1) : 0;
                    const ctrB = Number(b.total_impressions || 0) > 0 ? Number(b.total_clicks || 0) / Number(b.total_impressions || 1) : 0;
                    return ctrB - ctrA;
                  })[0];
                  const topCtr = Number(topCampaign.total_impressions || 0) > 0 ? ((Number(topCampaign.total_clicks || 0) / Number(topCampaign.total_impressions || 1)) * 100).toFixed(1) : '0';
                  return `Your overall CTR is ${avgCtr.toFixed(1)}%. Top performer: "${topCampaign.name}" with ${topCtr}% CTR. Total reach: ${formatNum(totalImpressions)} impressions across ${campaigns.length} campaigns.`;
                })()}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <GlassCard hoverable={false} className="lg:col-span-2 p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Performance Overview</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="warmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF6B6B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#FF6B6B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#A0AEC0" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#A0AEC0" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'rgba(15,15,26,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(12px)', color: '#fff' }} />
                <Area type="monotone" dataKey="impressions" stroke="#FF6B6B" fill="url(#warmGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="clicks" stroke="#FFC857" fill="none" strokeWidth={2} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[260px] text-muted-foreground">
              <p>No analytics data yet. Launch a campaign to see performance here.</p>
            </div>
          )}
        </GlassCard>

        <Link to="/upload">
          <GlassCard gradient className="h-full p-6 flex flex-col items-center justify-center text-center cursor-pointer">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="w-16 h-16 rounded-2xl warm-gradient flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-foreground" />
            </motion.div>
            <h3 className="text-lg font-bold text-foreground mb-2">Quick Upload</h3>
            <p className="text-sm text-muted-foreground">Upload a video & launch a new campaign</p>
          </GlassCard>
        </Link>
      </div>

      <GlassCard hoverable={false} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Recent Campaigns</h3>
          <Link to="/campaigns" className="text-sm warm-gradient-text font-medium">View all</Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No campaigns yet. Upload a video to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b" style={{ borderColor: 'var(--glass-border)' }}>
                  <th className="pb-3 font-medium">Campaign</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Health</th>
                  <th className="pb-3 font-medium">Budget</th>
                  <th className="pb-3 font-medium">Impressions</th>
                  <th className="pb-3 font-medium">Clicks</th>
                  <th className="pb-3 font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c, i) => (
                  <motion.tr key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }} className="border-b last:border-b-0 hover:bg-[var(--glass-bg-hover)] transition-all" style={{ borderColor: 'var(--glass-border)' }}>
                    <td className="py-3 text-sm font-medium text-foreground">{c.name}</td>
                    <td className="py-3"><span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', statusColors[c.status] || 'bg-slate-500/20 text-slate-400')}>{c.status}</span></td>
                    <td className="py-3">
                      {(() => {
                        const ctr = Number(c.total_impressions || 0) > 0 ? (Number(c.total_clicks || 0) / Number(c.total_impressions || 1)) * 100 : 0;
                        if (ctr >= 2) return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle className="w-3.5 h-3.5" /> Great</span>;
                        if (ctr >= 1) return <span className="flex items-center gap-1 text-xs text-amber-400"><TrendingUp className="w-3.5 h-3.5" /> Good</span>;
                        return <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="w-3.5 h-3.5" /> Low</span>;
                      })()}
                    </td>
                    <td className="py-3 text-sm font-data text-muted-foreground">${((c.daily_budget || 0) / 100).toFixed(0)}/day</td>
                    <td className="py-3 text-sm font-data text-muted-foreground">{formatNum(Number(c.total_impressions || 0))}</td>
                    <td className="py-3 text-sm font-data text-muted-foreground">{formatNum(Number(c.total_clicks || 0))}</td>
                    <td className="py-3 text-sm font-data text-muted-foreground">{Number(c.total_impressions || 0) > 0 ? ((Number(c.total_clicks || 0) / Number(c.total_impressions || 1)) * 100).toFixed(1) : '0.0'}%</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </PageTransition>
  );
};

export default Dashboard;
