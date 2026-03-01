import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import * as tus from 'tus-js-client';
import PageTransition from '@/components/PageTransition';
import GlassCard from '@/components/GlassCard';
import { CloudUpload, Check, Film, Rocket, Save, X, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  uploadVideoToMeta,
  createCampaign as createMetaCampaign,
  createAdSet,
  createAdCreative,
  createAd,
} from '@/lib/facebook-api';

const objectiveMap: Record<string, string> = {
  Awareness: 'OUTCOME_AWARENESS',
  Traffic: 'OUTCOME_TRAFFIC',
  Engagement: 'OUTCOME_ENGAGEMENT',
  Conversions: 'OUTCOME_SALES',
};

const ctaMap: Record<string, string> = {
  'Shop Now': 'SHOP_NOW',
  'Learn More': 'LEARN_MORE',
  'Sign Up': 'SIGN_UP',
  'Contact Us': 'CONTACT_US',
};

const UploadVideo = () => {
  const { user, fbConnection } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [launching, setLaunching] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  // Form state
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState('Traffic');
  const [dailyBudget, setDailyBudget] = useState('50');
  const [cta, setCta] = useState('Learn More');
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [locations, setLocations] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f || !user) return;
    setFile(f);
    setUploading(true);
    setUploaded(false);
    setProgress(0);

    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${user.id}/${Date.now()}_${safeName}`;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Not authenticated');
      setUploading(false);
      setFile(null);
      return;
    }

    const projectId = import.meta.env.VITE_SUPABASE_URL.replace('https://', '').replace('.supabase.co', '');

    const upload = new tus.Upload(f, {
      endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'videos',
        objectName: filePath,
        contentType: f.type,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError(error) {
        toast.error('Upload failed: ' + error.message);
        setUploading(false);
        setFile(null);
        setProgress(0);
      },
      onProgress(bytesUploaded, bytesTotal) {
        setProgress(Math.round((bytesUploaded / bytesTotal) * 100));
      },
      onSuccess() {
        const { data: publicUrl } = supabase.storage.from('videos').getPublicUrl(filePath);
        setVideoUrl(publicUrl.publicUrl);
        setProgress(100);
        setUploading(false);
        setUploaded(true);
        toast.success('Video uploaded!');
      },
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    });
  }, [user]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi'] },
    maxFiles: 1,
    maxSize: 524288000,
  });

  const launchToMeta = async (supabaseCampaignId: string) => {
    if (!fbConnection?.access_token || !fbConnection.ad_account_id || !file) return false;

    const token = fbConnection.access_token;
    const adAccountId = fbConnection.ad_account_id;
    const pageId = fbConnection.page_id || '';

    try {
      toast.info('Uploading video to Meta...');
      const metaVideo = await uploadVideoToMeta(adAccountId, file, token);

      toast.info('Creating Meta campaign...');
      const metaCampaign = await createMetaCampaign(adAccountId, {
        name: campaignName,
        objective: objectiveMap[objective] || 'OUTCOME_TRAFFIC',
        status: 'PAUSED',
      }, token);

      const metaAdSet = await createAdSet(adAccountId, {
        campaignId: metaCampaign.id,
        name: `${campaignName} - Ad Set`,
        dailyBudget: Math.round(Number(dailyBudget) * 100),
        targeting: {
          geo_locations: {
            countries: locations.split(',').map(l => l.trim()).filter(Boolean),
          },
        },
        status: 'PAUSED',
      }, token);

      const metaCreative = await createAdCreative(adAccountId, {
        name: `${campaignName} - Creative`,
        pageId,
        videoId: metaVideo.id,
        message: primaryText,
        headline,
        ctaType: ctaMap[cta] || 'LEARN_MORE',
      }, token);

      await createAd(adAccountId, metaAdSet.id, metaCreative.id, `${campaignName} - Ad`, token, 'ACTIVE');

      await supabase.from('campaigns').update({
        fb_campaign_id: metaCampaign.id,
        fb_adset_id: metaAdSet.id,
        fb_creative_id: metaCreative.id,
        fb_video_id: metaVideo.id,
        status: 'Active',
      }).eq('id', supabaseCampaignId);

      return true;
    } catch (err) {
      console.error('Meta API error:', err);
      toast.error(`Meta API: ${err instanceof Error ? err.message : 'Unknown error'}`);
      return false;
    }
  };

  const saveCampaign = async (status: string) => {
    if (!user) return null;
    if (!campaignName.trim()) {
      toast.error('Campaign name is required');
      return null;
    }

    const targetingJson = {
      geo_locations: {
        countries: locations.split(',').map(l => l.trim()).filter(Boolean),
      },
    };

    const { error, data } = await supabase.from('campaigns').insert({
      user_id: user.id,
      name: campaignName,
      objective: objectiveMap[objective] || 'OUTCOME_TRAFFIC',
      status,
      daily_budget: Math.round(Number(dailyBudget) * 100),
      targeting: targetingJson,
      primary_text: primaryText,
      headline,
      cta: ctaMap[cta] || 'LEARN_MORE',
      video_url: videoUrl,
      video_filename: file?.name || null,
    }).select('id').single();

    if (error) {
      toast.error('Failed to save: ' + error.message);
      return null;
    }

    queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    return data?.id || null;
  };

  const handleLaunch = async () => {
    if (!uploaded) {
      toast.error('Please upload a video first');
      return;
    }
    setLaunching(true);

    const campaignId = await saveCampaign('Draft');
    if (!campaignId) {
      setLaunching(false);
      return;
    }

    if (fbConnection?.access_token && fbConnection.ad_account_id) {
      const metaOk = await launchToMeta(campaignId);
      if (!metaOk) {
        toast.warning('Saved locally but Meta launch failed. You can retry from Campaigns.');
      } else {
        toast.success('Campaign launched on Meta!');
      }
    } else {
      toast.success('Campaign saved! Connect Facebook in Settings to publish to Meta.');
    }

    setLaunching(false);
    navigate('/campaigns');
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    const ok = await saveCampaign('Draft');
    setSavingDraft(false);
    if (ok) {
      toast.success('Draft saved!');
      navigate('/campaigns');
    }
  };

  const hasFbConnection = !!fbConnection?.ad_account_id;

  return (
    <PageTransition>
      <h1 className="text-3xl font-bold text-foreground mb-2">Upload Video</h1>
      <p className="text-muted-foreground mb-8">Upload your ad creative and configure your campaign.</p>

      {!hasFbConnection && (
        <div className="glass rounded-xl p-4 mb-6 border border-amber-500/20 bg-amber-500/5">
          <p className="text-sm text-amber-400">
            No Facebook Ad Account connected. Campaigns will be saved locally. Connect your Facebook account in{' '}
            <a href="/settings" className="underline font-medium">Settings</a> to publish to Meta.
          </p>
        </div>
      )}

      <GlassCard hoverable={false} className="p-8 mb-8">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div key="dropzone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div
                {...getRootProps()}
                className="border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all"
                style={{
                  borderColor: isDragActive ? '#FF6B6B' : 'var(--glass-border)',
                  background: isDragActive ? 'rgba(255,107,107,0.05)' : 'transparent',
                }}
              >
                <input {...getInputProps()} />
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} className="inline-block">
                  <CloudUpload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                </motion.div>
                <p className="text-lg font-medium text-foreground mb-1">
                  {isDragActive ? 'Drop your video here' : 'Drag your video here or click to browse'}
                </p>
                <p className="text-sm text-muted-foreground">Supports MP4, MOV, AVI - Max 500MB</p>
              </div>
            </motion.div>
          ) : (
            <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl warm-gradient flex items-center justify-center">
                  <Film className="w-6 h-6 text-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                {uploaded && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-400" />
                  </motion.div>
                )}
                <button onClick={() => { setFile(null); setUploaded(false); setProgress(0); setVideoUrl(''); }} className="p-2 rounded-lg hover:bg-[var(--glass-bg-hover)] transition-all">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              {(uploading || (progress > 0 && progress < 100)) && (
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--glass-bg)' }}>
                  <motion.div className="h-full warm-gradient rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      <GlassCard hoverable={false} className="p-8">
        <h2 className="text-xl font-bold text-foreground mb-6">Campaign Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Campaign Name *</label>
            <input className="glass-input" placeholder="e.g., Summer Sale 2024" value={campaignName} onChange={e => setCampaignName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Objective</label>
            <select className="glass-input" value={objective} onChange={e => setObjective(e.target.value)}>
              <option>Awareness</option>
              <option>Traffic</option>
              <option>Engagement</option>
              <option>Conversions</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Daily Budget ($)</label>
            <input className="glass-input" type="number" min="1" value={dailyBudget} onChange={e => setDailyBudget(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Call to Action</label>
            <select className="glass-input" value={cta} onChange={e => setCta(e.target.value)}>
              <option>Shop Now</option>
              <option>Learn More</option>
              <option>Sign Up</option>
              <option>Contact Us</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-muted-foreground mb-1.5 block">Primary Text</label>
            <textarea className="glass-input min-h-[80px] resize-none" placeholder="Write your ad copy..." value={primaryText} onChange={e => setPrimaryText(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Headline</label>
            <input className="glass-input" placeholder="Catchy headline" value={headline} onChange={e => setHeadline(e.target.value)} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">Target Locations (comma-separated)</label>
            <input className="glass-input" placeholder="US, CA, GB..." value={locations} onChange={e => setLocations(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <motion.button
            onClick={handleLaunch}
            disabled={launching}
            whileHover={{ scale: launching ? 1 : 1.02 }}
            whileTap={{ scale: launching ? 1 : 0.97 }}
            className="btn-warm flex items-center gap-2 disabled:opacity-60"
          >
            {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {hasFbConnection ? 'Launch on Meta' : 'Launch Campaign'}
          </motion.button>
          <motion.button
            onClick={handleSaveDraft}
            disabled={savingDraft}
            whileHover={{ scale: savingDraft ? 1 : 1.02 }}
            whileTap={{ scale: savingDraft ? 1 : 0.97 }}
            className="btn-glass flex items-center gap-2 disabled:opacity-60"
          >
            {savingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save as Draft
          </motion.button>
        </div>
      </GlassCard>
    </PageTransition>
  );
};

export default UploadVideo;
