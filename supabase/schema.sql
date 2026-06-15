-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Onboarding answers
CREATE TABLE IF NOT EXISTS onboarding_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  purchasing_power TEXT NOT NULL,
  industries TEXT[] NOT NULL DEFAULT '{}',
  watching_stocks TEXT[] NOT NULL DEFAULT '{}',
  risk_appetite TEXT NOT NULL,
  priority TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Watchlist items
CREATE TABLE IF NOT EXISTS watchlist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  notes TEXT,
  confidence_level INTEGER DEFAULT 3 CHECK (confidence_level >= 1 AND confidence_level <= 5),
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  shares DECIMAL(12,4) NOT NULL,
  avg_cost DECIMAL(12,2) NOT NULL,
  current_value DECIMAL(12,2),
  notes TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Stock analyses
CREATE TABLE IF NOT EXISTS stock_analyses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '{}',
  score JSONB NOT NULL DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Research reports
CREATE TABLE IF NOT EXISTS research_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  overview TEXT NOT NULL DEFAULT '',
  industry_position TEXT NOT NULL DEFAULT '',
  cash_flow_analysis TEXT NOT NULL DEFAULT '',
  earnings_analysis TEXT NOT NULL DEFAULT '',
  debt_analysis TEXT NOT NULL DEFAULT '',
  technical_analysis TEXT NOT NULL DEFAULT '',
  news_summary TEXT NOT NULL DEFAULT '',
  bull_case TEXT NOT NULL DEFAULT '',
  bear_case TEXT NOT NULL DEFAULT '',
  risks TEXT NOT NULL DEFAULT '',
  conclusion TEXT NOT NULL DEFAULT '',
  disclaimer TEXT NOT NULL DEFAULT 'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.',
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Option contracts (can be mock or real)
CREATE TABLE IF NOT EXISTS option_contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticker TEXT NOT NULL,
  option_type TEXT NOT NULL DEFAULT 'CALL',
  expiration_date DATE NOT NULL,
  strike_price DECIMAL(10,2) NOT NULL,
  current_premium DECIMAL(10,2) NOT NULL,
  all_time_high_premium DECIMAL(10,2) NOT NULL,
  depreciation_pct DECIMAL(5,2) NOT NULL,
  implied_volatility DECIMAL(5,4) NOT NULL,
  delta DECIMAL(5,4) NOT NULL,
  theta DECIMAL(8,4) NOT NULL,
  volume INTEGER NOT NULL DEFAULT 0,
  open_interest INTEGER NOT NULL DEFAULT 0,
  is_mock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- LEAPS recommendations
CREATE TABLE IF NOT EXISTS leaps_recommendations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  stock_score INTEGER NOT NULL DEFAULT 0,
  recommendations JSONB NOT NULL DEFAULT '[]',
  front_runner_explanation TEXT NOT NULL DEFAULT '',
  disclaimer TEXT NOT NULL DEFAULT 'This is for educational and research purposes only. Past performance does not guarantee future results. This is not financial advice.',
  generated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_ticker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Scoring config (per user custom weights)
CREATE TABLE IF NOT EXISTS scoring_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  weights JSONB NOT NULL DEFAULT '{
    "industry_leadership": 25,
    "cash_flow": 20,
    "earnings_quality": 20,
    "debt_to_equity": 10,
    "ema_distance": 15,
    "option_affordability": 5,
    "option_expiration": 5
  }',
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaps_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;

-- Profiles: users can view and update only their own
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Onboarding: users own their answers
CREATE POLICY "Users own onboarding answers" ON onboarding_answers FOR ALL USING (auth.uid() = user_id);

-- Watchlist: users own their items
CREATE POLICY "Users own watchlist items" ON watchlist_items FOR ALL USING (auth.uid() = user_id);

-- Portfolio: users own their holdings
CREATE POLICY "Users own portfolio holdings" ON portfolio_holdings FOR ALL USING (auth.uid() = user_id);

-- Stock analyses: users own their analyses
CREATE POLICY "Users own stock analyses" ON stock_analyses FOR ALL USING (auth.uid() = user_id);

-- Research reports: users own their reports
CREATE POLICY "Users own research reports" ON research_reports FOR ALL USING (auth.uid() = user_id);

-- Option contracts: anyone authenticated can read (mock data is shared)
CREATE POLICY "Authenticated users can read option contracts" ON option_contracts FOR SELECT USING (auth.role() = 'authenticated');

-- LEAPS recommendations: users own their recommendations
CREATE POLICY "Users own leaps recommendations" ON leaps_recommendations FOR ALL USING (auth.uid() = user_id);

-- Chat messages: users own their messages
CREATE POLICY "Users own chat messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Scoring config: users own their config
CREATE POLICY "Users own scoring config" ON scoring_config FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scoring_config_updated_at BEFORE UPDATE ON scoring_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA: Mock Option Contracts
-- ============================================================

-- AAPL mock options (12-24 months out from ~mid-2026)
INSERT INTO option_contracts (ticker, option_type, expiration_date, strike_price, current_premium, all_time_high_premium, depreciation_pct, implied_volatility, delta, theta, volume, open_interest, is_mock) VALUES
('AAPL', 'CALL', '2027-01-15', 200.00, 18.50, 32.00, 42.19, 0.2850, 0.5200, -0.0450, 1250, 8500, true),
('AAPL', 'CALL', '2027-06-18', 210.00, 15.20, 26.00, 41.54, 0.2920, 0.4800, -0.0380, 890, 5200, true),
('AAPL', 'CALL', '2027-01-15', 220.00, 12.40, 21.50, 42.33, 0.3010, 0.4200, -0.0320, 650, 4100, true),

-- MSFT mock options
('MSFT', 'CALL', '2027-01-15', 420.00, 45.20, 78.00, 42.05, 0.2650, 0.5400, -0.0620, 980, 6200, true),
('MSFT', 'CALL', '2027-06-18', 440.00, 38.50, 65.00, 40.77, 0.2720, 0.4900, -0.0540, 720, 4800, true),
('MSFT', 'CALL', '2027-01-15', 460.00, 31.80, 55.00, 42.18, 0.2800, 0.4400, -0.0460, 520, 3600, true),

-- NVDA mock options
('NVDA', 'CALL', '2027-01-15', 120.00, 28.40, 48.50, 41.44, 0.4250, 0.5600, -0.0820, 2150, 12500, true),
('NVDA', 'CALL', '2027-06-18', 130.00, 23.60, 40.50, 41.73, 0.4380, 0.5100, -0.0740, 1680, 9800, true),
('NVDA', 'CALL', '2027-01-15', 140.00, 19.20, 33.00, 41.82, 0.4520, 0.4600, -0.0650, 1250, 7200, true),

-- JPM mock options
('JPM', 'CALL', '2027-01-15', 230.00, 22.80, 39.00, 41.54, 0.2420, 0.5300, -0.0380, 780, 5200, true),
('JPM', 'CALL', '2027-06-18', 240.00, 18.90, 32.50, 41.85, 0.2510, 0.4850, -0.0330, 580, 3900, true),
('JPM', 'CALL', '2027-01-15', 250.00, 15.20, 26.00, 41.54, 0.2600, 0.4350, -0.0280, 420, 2800, true),

-- UNH mock options
('UNH', 'CALL', '2027-01-15', 550.00, 52.40, 89.00, 41.12, 0.2180, 0.5150, -0.0750, 420, 2800, true),
('UNH', 'CALL', '2027-06-18', 580.00, 42.80, 74.00, 42.16, 0.2250, 0.4700, -0.0650, 310, 2100, true),
('UNH', 'CALL', '2027-01-15', 600.00, 34.60, 59.50, 41.85, 0.2330, 0.4200, -0.0550, 240, 1600, true),

-- HD mock options
('HD', 'CALL', '2027-01-15', 360.00, 34.20, 58.00, 41.03, 0.2320, 0.5250, -0.0520, 560, 3800, true),
('HD', 'CALL', '2027-06-18', 380.00, 27.80, 47.50, 41.47, 0.2400, 0.4800, -0.0450, 420, 2900, true),
('HD', 'CALL', '2027-01-15', 400.00, 22.40, 38.50, 41.82, 0.2480, 0.4300, -0.0380, 310, 2100, true),

-- AMZN mock options
('AMZN', 'CALL', '2027-01-15', 200.00, 26.80, 46.00, 41.74, 0.3150, 0.5350, -0.0580, 1450, 9200, true),
('AMZN', 'CALL', '2027-06-18', 215.00, 21.60, 37.00, 41.62, 0.3240, 0.4900, -0.0510, 1080, 7100, true),
('AMZN', 'CALL', '2027-01-15', 230.00, 17.20, 29.50, 41.69, 0.3350, 0.4400, -0.0440, 780, 5200, true);

-- Default scoring config for reference (users get their own copy)
INSERT INTO scoring_config (id, user_id, weights)
SELECT uuid_generate_v4(), id, '{"industry_leadership":25,"cash_flow":20,"earnings_quality":20,"debt_to_equity":10,"ema_distance":15,"option_affordability":5,"option_expiration":5}'::jsonb
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
