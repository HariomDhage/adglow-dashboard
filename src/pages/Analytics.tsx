import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import PageTransition from '@/components/PageTransition';
import StatCard from '@/components/StatCard';
import GlassCard from '@/components/GlassCard';
import { cn } from '@/lib/utils';
import { DollarSign, Eye, MousePointerClick, Target, Users, Monitor, Smartphone, Loader2 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const dateRanges = ['Today', '7D', '30D', '90D'];

const genderColors = ['#FF6B6B', '#FFC857', '#FF8E53'];

const Analytics = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState('30D');

  const daysMap: Record<string, number> = { Today: 1, '7D': 7, '30D': 30, '90D': 90 };
  const days = daysMap[dateRange] || 30;

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('campaigns').select('*').eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: analyticsData = [], isLoading } = useQuery({
    queryKey: ['analytics', dateRange],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data } = await supabase
        .from('campaign_analytics')
        .select('*')
        .gte('date', since.toISOString().split('T')[0])
        .order('date', { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: breakdowns = [] } = useQuery({
    queryKey: ['breakdowns', dateRange],
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data } = await supabase
        .from('audience_breakdowns')
        .select('*')
        .gte('date', since.toISOString().split('T')[0]);
      return data || [];
    },
    enabled: !!user,
  });

  const totalSpend = campaigns.reduce((s, c) => s + Number(c.total_spend || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + Number(c.total_impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + Number(c.total_clicks || 0), 0);
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  // Aggregate daily analytics across all campaigns
  const chartData = (() => {
    if (analyticsData.length === 0) {
      return Array.from({ length: Math.min(days, 30) }, (_, i) => ({ day: `Day ${i + 1}`, impressions: 0, clicks: 0 }));
    }
    const dayMap = new Map<string, { impressions: number; clicks: number }>();
    analyticsData.forEach(a => {
      const key = a.date;
      const prev = dayMap.get(key) || { impressions: 0, clicks: 0 };
      dayMap.set(key, { impressions: prev.impressions + Number(a.impressions || 0), clicks: prev.clicks + Number(a.clicks || 0) });
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

  return (
    <PageTransition>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-1">Deep dive into your campaign performance.</p>
        </div>
        <div className="flex gap-2">
          {dateRanges.map(range => (
            <motion.button key={range} whileTap={{ scale: 0.95 }} onClick={() => setDateRange(range)}
              className={cn('px-4 py-2 rounded-xl text-sm font-medium transition-all', dateRange === range ? 'warm-gradient text-foreground' : 'glass text-muted-foreground')}>
              {range}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Spend" value={totalSpend} prefix="$" change={0} icon={<DollarSign className="w-5 h-5 text-foreground" />} index={0} />
        <StatCard label="Impressions" value={totalImpressions} change={0} icon={<Eye className="w-5 h-5 text-foreground" />} index={1} />
        <StatCard label="Clicks" value={totalClicks} change={0} icon={<MousePointerClick className="w-5 h-5 text-foreground" />} index={2} />
        <StatCard label="CTR" value={Number(avgCtr.toFixed(1))} suffix="%" change={0} icon={<Target className="w-5 h-5 text-foreground" />} index={3} />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <GlassCard hoverable={false} className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-foreground mb-4">Performance Trend</h3>
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
