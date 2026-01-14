-- BAM.ai Database Schema
-- PostgreSQL schema for future migration (currently using in-memory stores)

-- Clients with per-client API configurations
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    contact_email VARCHAR(255),
    contact_name VARCHAR(255),
    openrouter_api_key_id VARCHAR(255),
    elevenlabs_api_key_id VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    seats_included INTEGER DEFAULT 5,
    price_per_seat DECIMAL(10, 2) DEFAULT 19.99,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API Usage Tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID,
    service VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    tokens_prompt INTEGER DEFAULT 0,
    tokens_completion INTEGER DEFAULT 0,
    tokens_total INTEGER DEFAULT 0,
    cost_usd DECIMAL(10, 6) DEFAULT 0,
    endpoint VARCHAR(255),
    request_metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_usage_client ON api_usage_logs(client_id);
CREATE INDEX idx_api_usage_created ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_service ON api_usage_logs(service);

-- Social Media Accounts
CREATE TABLE IF NOT EXISTS social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    account_handle VARCHAR(255),
    account_name VARCHAR(255),
    account_id VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    scopes TEXT[],
    status VARCHAR(20) DEFAULT 'active',
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_social_accounts_client ON social_accounts(client_id);
CREATE INDEX idx_social_accounts_platform ON social_accounts(platform);

-- Content Campaigns
CREATE TABLE IF NOT EXISTS content_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    target_platforms TEXT[],
    settings JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_client ON content_campaigns(client_id);
CREATE INDEX idx_campaigns_status ON content_campaigns(status);

-- Video Uploads
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES content_campaigns(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    original_filename VARCHAR(255),
    storage_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    duration_seconds FLOAT,
    resolution VARCHAR(20),
    transcript TEXT,
    transcript_segments JSONB,
    processing_status VARCHAR(20) DEFAULT 'uploading',
    processing_error TEXT,
    metadata JSONB DEFAULT '{}',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_videos_client ON videos(client_id);
CREATE INDEX idx_videos_campaign ON videos(campaign_id);
CREATE INDEX idx_videos_status ON videos(processing_status);

-- Video Clips
CREATE TABLE IF NOT EXISTS video_clips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
    start_time_seconds FLOAT NOT NULL,
    end_time_seconds FLOAT NOT NULL,
    duration_seconds FLOAT GENERATED ALWAYS AS (end_time_seconds - start_time_seconds) STORED,
    virality_score DECIMAL(3, 2),
    engagement_prediction JSONB,
    subtitle_text TEXT,
    subtitle_style JSONB DEFAULT '{}',
    clip_storage_path TEXT,
    thumbnail_path TEXT,
    status VARCHAR(20) DEFAULT 'pending_review',
    approved_by UUID,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_clips_video ON video_clips(video_id);
CREATE INDEX idx_clips_status ON video_clips(status);
CREATE INDEX idx_clips_virality ON video_clips(virality_score DESC);

-- Scheduled Posts
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clip_id UUID REFERENCES video_clips(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES content_campaigns(id) ON DELETE SET NULL,
    caption TEXT,
    hashtags TEXT[],
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'scheduled',
    platform_post_id VARCHAR(255),
    platform_url TEXT,
    engagement_metrics JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_posts_scheduled ON scheduled_posts(scheduled_at);
CREATE INDEX idx_posts_status ON scheduled_posts(status);
CREATE INDEX idx_posts_account ON scheduled_posts(social_account_id);

-- Onboarding Sessions (enhanced)
CREATE TABLE IF NOT EXISTS onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    session_type VARCHAR(20) DEFAULT 'human_assisted',
    status VARCHAR(20) DEFAULT 'scheduled',
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    company_name VARCHAR(255),
    industry VARCHAR(100),
    answers JSONB DEFAULT '{}',
    transcript TEXT,
    transcript_segments JSONB,
    brains_created BOOLEAN DEFAULT FALSE,
    brains_data JSONB,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    onboarded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_onboarding_client ON onboarding_sessions(client_id);
CREATE INDEX idx_onboarding_status ON onboarding_sessions(status);

-- AI Onboarding Sessions (PLG self-service)
CREATE TABLE IF NOT EXISTS ai_onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    industry VARCHAR(100),
    current_section VARCHAR(100),
    current_question_index INTEGER DEFAULT 0,
    answers JSONB DEFAULT '{}',
    conversation_history JSONB DEFAULT '[]',
    progress_percentage INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'in_progress',
    brains_created BOOLEAN DEFAULT FALSE,
    client_id UUID REFERENCES clients(id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_onboarding_email ON ai_onboarding_sessions(email);
CREATE INDEX idx_ai_onboarding_status ON ai_onboarding_sessions(status);

-- Knowledge Base Sources (for anti-hallucination tracking)
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id UUID,
    title VARCHAR(255),
    content_hash VARCHAR(64),
    embedding_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_knowledge_client ON knowledge_sources(client_id);
CREATE INDEX idx_knowledge_type ON knowledge_sources(source_type);
