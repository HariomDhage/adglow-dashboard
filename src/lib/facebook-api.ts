const META_API_BASE = 'https://graph.facebook.com/v25.0';

interface MetaApiError {
  message: string;
  type: string;
  code: number;
}

async function metaFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    try {
      const data = JSON.parse(text);
      if (data.error) {
        const err = data.error as MetaApiError;
        throw new Error(`Meta API Error: ${err.message} (code: ${err.code})`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Meta API')) throw e;
    }
    throw new Error(`Meta API request failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (data.error) {
    const err = data.error as MetaApiError;
    throw new Error(`Meta API Error: ${err.message} (code: ${err.code})`);
  }
  return data as T;
}

// ---------- Video Upload ----------

export async function uploadVideoToMeta(
  adAccountId: string,
  file: File,
  accessToken: string
): Promise<{ id: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('access_token', accessToken);

  return metaFetch<{ id: string }>(
    `${META_API_BASE}/act_${adAccountId}/advideos`,
    { method: 'POST', body: formData }
  );
}

// Poll video status until ready (Meta needs time to process uploaded videos)
export async function waitForVideoReady(
  videoId: string,
  accessToken: string,
  maxAttempts = 30
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const params = new URLSearchParams({
      fields: 'status',
      access_token: accessToken,
    });
    try {
      const data = await metaFetch<{ status: { video_status: string } }>(
        `${META_API_BASE}/${videoId}?${params}`
      );
      const status = data.status?.video_status;
      if (status === 'ready') return true;
      if (status === 'error') return false;
    } catch {
      // Video might not be queryable yet, keep retrying
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

// ---------- Campaign Creation ----------

interface CreateCampaignParams {
  name: string;
  objective: string;
  status?: string;
  specialAdCategories?: string[];
}

export async function createCampaign(
  adAccountId: string,
  params: CreateCampaignParams,
  accessToken: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    name: params.name,
    objective: params.objective,
    status: params.status || 'PAUSED',
    // Empty array = no special categories. ['NONE'] is invalid since API v9.0
    special_ad_categories: JSON.stringify(params.specialAdCategories || []),
    access_token: accessToken,
  });

  return metaFetch<{ id: string }>(
    `${META_API_BASE}/act_${adAccountId}/campaigns`,
    { method: 'POST', body }
  );
}

// ---------- Ad Set Creation ----------

interface Targeting {
  geo_locations?: { countries?: string[] };
  age_min?: number;
  age_max?: number;
  genders?: number[];
}

interface CreateAdSetParams {
  campaignId: string;
  name: string;
  dailyBudget: number; // in cents
  optimizationGoal?: string;
  targeting: Targeting;
  startTime?: string;
  endTime?: string;
  status?: string;
}

export async function createAdSet(
  adAccountId: string,
  params: CreateAdSetParams,
  accessToken: string
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    campaign_id: params.campaignId,
    name: params.name,
    daily_budget: String(params.dailyBudget),
    billing_event: 'IMPRESSIONS',
    optimization_goal: params.optimizationGoal || 'LINK_CLICKS',
    targeting: JSON.stringify(params.targeting),
    status: params.status || 'PAUSED',
    access_token: accessToken,
  });

  if (params.startTime) body.set('start_time', params.startTime);
  if (params.endTime) body.set('end_time', params.endTime);

  return metaFetch<{ id: string }>(
    `${META_API_BASE}/act_${adAccountId}/adsets`,
    { method: 'POST', body }
  );
}

// ---------- Ad Creative Creation ----------

interface CreateCreativeParams {
  name: string;
  pageId: string;
  videoId: string;
  message: string;
  headline?: string;
  linkUrl?: string;
  ctaType?: string;
  imageHash?: string;
}

export async function createAdCreative(
  adAccountId: string,
  params: CreateCreativeParams,
  accessToken: string
): Promise<{ id: string }> {
  const videoData: Record<string, unknown> = {
    video_id: params.videoId,
    message: params.message,
    title: params.headline || '',
  };

  // Only include CTA if a link URL is provided (Meta requires a valid URL)
  if (params.linkUrl) {
    videoData.call_to_action = {
      type: params.ctaType || 'LEARN_MORE',
      value: { link: params.linkUrl },
    };
  }

  if (params.imageHash) {
    videoData.image_hash = params.imageHash;
  }

  const objectStorySpec = {
    page_id: params.pageId,
    video_data: videoData,
  };

  const body = new URLSearchParams({
    name: params.name,
    object_story_spec: JSON.stringify(objectStorySpec),
    access_token: accessToken,
  });

  return metaFetch<{ id: string }>(
    `${META_API_BASE}/act_${adAccountId}/adcreatives`,
    { method: 'POST', body }
  );
}

// ---------- Ad Creation ----------

export async function createAd(
  adAccountId: string,
  adsetId: string,
  creativeId: string,
  name: string,
  accessToken: string,
  status = 'PAUSED'
): Promise<{ id: string }> {
  const body = new URLSearchParams({
    adset_id: adsetId,
    name,
    creative: JSON.stringify({ creative_id: creativeId }),
    status,
    access_token: accessToken,
  });

  return metaFetch<{ id: string }>(
    `${META_API_BASE}/act_${adAccountId}/ads`,
    { method: 'POST', body }
  );
}

// ---------- Campaign Management ----------

export async function updateCampaignStatus(
  campaignId: string,
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  accessToken: string
): Promise<{ success: boolean }> {
  const body = new URLSearchParams({ status, access_token: accessToken });
  return metaFetch<{ success: boolean }>(
    `${META_API_BASE}/${campaignId}`,
    { method: 'POST', body }
  );
}

export async function updateCampaignOnMeta(
  campaignId: string,
  updates: { name?: string; status?: string },
  accessToken: string
): Promise<{ success: boolean }> {
  const body = new URLSearchParams({ access_token: accessToken });
  if (updates.name) body.set('name', updates.name);
  if (updates.status) body.set('status', updates.status);
  return metaFetch<{ success: boolean }>(
    `${META_API_BASE}/${campaignId}`,
    { method: 'POST', body }
  );
}

export async function updateAdSetOnMeta(
  adsetId: string,
  updates: { daily_budget?: number; status?: string },
  accessToken: string
): Promise<{ success: boolean }> {
  const body = new URLSearchParams({ access_token: accessToken });
  if (updates.daily_budget !== undefined) body.set('daily_budget', String(updates.daily_budget));
  if (updates.status) body.set('status', updates.status);
  return metaFetch<{ success: boolean }>(
    `${META_API_BASE}/${adsetId}`,
    { method: 'POST', body }
  );
}

export async function updateAdSetStatus(
  adsetId: string,
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  accessToken: string
): Promise<{ success: boolean }> {
  const body = new URLSearchParams({ status, access_token: accessToken });
  return metaFetch<{ success: boolean }>(
    `${META_API_BASE}/${adsetId}`,
    { method: 'POST', body }
  );
}

export async function deleteCampaign(
  campaignId: string,
  accessToken: string
): Promise<{ success: boolean }> {
  const body = new URLSearchParams({ status: 'ARCHIVED', access_token: accessToken });
  return metaFetch<{ success: boolean }>(
    `${META_API_BASE}/${campaignId}`,
    { method: 'POST', body }
  );
}

// ---------- Insights / Analytics ----------

export interface InsightRow {
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start?: string;
  date_stop?: string;
  // Breakdown fields
  age?: string;
  gender?: string;
  device_platform?: string;
}

interface InsightsResponse {
  data: InsightRow[];
  paging?: { next?: string };
}

export async function getCampaignInsights(
  campaignId: string,
  datePreset: string,
  accessToken: string
): Promise<InsightRow[]> {
  const params = new URLSearchParams({
    fields: 'campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach',
    date_preset: datePreset,
    access_token: accessToken,
  });

  const data = await metaFetch<InsightsResponse>(
    `${META_API_BASE}/${campaignId}/insights?${params}`
  );
  return data.data || [];
}

// Fetch daily time-series insights for a campaign
export async function getCampaignDailyInsights(
  campaignId: string,
  accessToken: string,
  days = 30
): Promise<InsightRow[]> {
  const preset = days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d';
  const params = new URLSearchParams({
    fields: 'impressions,clicks,spend,ctr,cpc,cpm,reach',
    time_increment: '1',
    date_preset: preset,
    access_token: accessToken,
  });

  const data = await metaFetch<InsightsResponse>(
    `${META_API_BASE}/${campaignId}/insights?${params}`
  );
  return data.data || [];
}

// Fetch insights with audience breakdowns
export async function getCampaignBreakdownInsights(
  campaignId: string,
  breakdownType: 'age' | 'gender' | 'device_platform',
  accessToken: string,
  days = 30
): Promise<InsightRow[]> {
  const preset = days <= 7 ? 'last_7d' : days <= 30 ? 'last_30d' : 'last_90d';
  const params = new URLSearchParams({
    fields: 'impressions,clicks,spend',
    breakdowns: breakdownType,
    date_preset: preset,
    access_token: accessToken,
  });

  const data = await metaFetch<InsightsResponse>(
    `${META_API_BASE}/${campaignId}/insights?${params}`
  );
  return data.data || [];
}

export async function getAccountInsights(
  adAccountId: string,
  datePreset: string,
  accessToken: string,
  breakdowns?: string
): Promise<InsightRow[]> {
  const params = new URLSearchParams({
    fields: 'campaign_id,campaign_name,impressions,clicks,spend,ctr,cpc,cpm,reach',
    date_preset: datePreset,
    level: 'campaign',
    access_token: accessToken,
  });

  if (breakdowns) params.set('breakdowns', breakdowns);

  const data = await metaFetch<InsightsResponse>(
    `${META_API_BASE}/act_${adAccountId}/insights?${params}`
  );
  return data.data || [];
}

export async function getAccountInsightsTimeSeries(
  adAccountId: string,
  datePreset: string,
  accessToken: string
): Promise<InsightRow[]> {
  const params = new URLSearchParams({
    fields: 'impressions,clicks,spend,ctr,cpc,cpm',
    date_preset: datePreset,
    time_increment: '1',
    level: 'account',
    access_token: accessToken,
  });

  const data = await metaFetch<InsightsResponse>(
    `${META_API_BASE}/act_${adAccountId}/insights?${params}`
  );
  return data.data || [];
}

// ---------- Import Existing Campaigns ----------

interface MetaCampaignRaw {
  id: string;
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
  insights?: { data: InsightRow[] };
}

export async function getAdAccountCampaigns(
  adAccountId: string,
  accessToken: string
): Promise<MetaCampaignRaw[]> {
  const params = new URLSearchParams({
    fields: 'id,name,objective,status,daily_budget',
    limit: '50',
    access_token: accessToken,
  });
  const data = await metaFetch<{ data: MetaCampaignRaw[] }>(
    `${META_API_BASE}/act_${adAccountId}/campaigns?${params}`
  );
  return data.data || [];
}

// ---------- Ad Account & Pages ----------

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
}

export async function getAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const params = new URLSearchParams({
    fields: 'id,name,account_id',
    access_token: accessToken,
  });
  const data = await metaFetch<{ data: AdAccount[] }>(
    `${META_API_BASE}/me/adaccounts?${params}`
  );
  return data.data || [];
}

interface Page {
  id: string;
  name: string;
  access_token: string;
}

export async function getPages(accessToken: string): Promise<Page[]> {
  const params = new URLSearchParams({
    fields: 'id,name,access_token',
    access_token: accessToken,
  });
  const data = await metaFetch<{ data: Page[] }>(
    `${META_API_BASE}/me/accounts?${params}`
  );
  return data.data || [];
}
