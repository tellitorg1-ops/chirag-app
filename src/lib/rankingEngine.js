import { supabase } from './supabase'

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY

/* ── Score calculation ── */

export const calculateScore = (data) => {
  const {
    yt_views = 0,
    yt_subs = 0,
    yt_total_videos = 0,
    fb_reach = 0,
    fb_likes = 0,
    fb_shares = 0,
    fb_comments = 0,
    posting_streak = 0,
    posts_this_week = 0,
    prev_yt_views = 0,
    prev_fb_reach = 0,
  } = data

  // YouTube Views Score (0-30)
  let ytViewsScore = 0
  if      (yt_views >= 500000) ytViewsScore = 30
  else if (yt_views >= 100000) ytViewsScore = 28
  else if (yt_views >= 50000)  ytViewsScore = 24
  else if (yt_views >= 10000)  ytViewsScore = 18
  else if (yt_views >= 1000)   ytViewsScore = 10
  else ytViewsScore = Math.min(yt_views / 200, 5)

  // YouTube Subs Score (0-10)
  let ytSubsScore = 0
  if      (yt_subs >= 5000) ytSubsScore = 10
  else if (yt_subs >= 1000) ytSubsScore = 9
  else if (yt_subs >= 500)  ytSubsScore = 7
  else if (yt_subs >= 100)  ytSubsScore = 5
  else ytSubsScore = Math.min(yt_subs / 20, 4)

  // YouTube Quality Score (0-5)
  let ytQualityScore = 0
  if (yt_total_videos > 0) {
    const avgViews = yt_views / yt_total_videos
    if      (avgViews >= 10000) ytQualityScore = 5
    else if (avgViews >= 2000)  ytQualityScore = 3
    else if (avgViews >= 500)   ytQualityScore = 2
    else if (avgViews >= 100)   ytQualityScore = 1
  }

  // Facebook Reach Score (0-15)
  let fbReachScore = 0
  if      (fb_reach >= 50000) fbReachScore = 15
  else if (fb_reach >= 10000) fbReachScore = 13
  else if (fb_reach >= 2000)  fbReachScore = 11
  else if (fb_reach >= 500)   fbReachScore = 7
  else fbReachScore = Math.min(fb_reach / 100, 5)

  // Facebook Engagement Score (0-10)
  let fbEngagementScore = 0
  if (fb_reach > 0) {
    const engagementRate =
      ((fb_likes + fb_shares * 3 + fb_comments * 2) / fb_reach) * 100
    if      (engagementRate >= 6) fbEngagementScore = 10
    else if (engagementRate >= 3) fbEngagementScore = 8
    else if (engagementRate >= 1) fbEngagementScore = 5
    else if (engagementRate > 0)  fbEngagementScore = 2
  }

  // Streak Score (0-10)
  let streakScore = 0
  if      (posting_streak >= 22) streakScore = 10
  else if (posting_streak >= 15) streakScore = 8
  else if (posting_streak >= 8)  streakScore = 6
  else if (posting_streak >= 4)  streakScore = 4
  else if (posting_streak >= 1)  streakScore = 2

  // Frequency Score (0-10)
  let frequencyScore = 0
  if      (posts_this_week >= 6) frequencyScore = 10
  else if (posts_this_week >= 4) frequencyScore = 8
  else if (posts_this_week >= 2) frequencyScore = 5
  else if (posts_this_week >= 1) frequencyScore = 2

  // Growth Score (0-10)
  let growthScore = 0
  if (prev_yt_views > 0) {
    const growth = ((yt_views - prev_yt_views) / prev_yt_views) * 100
    if      (growth >= 100) growthScore = 10
    else if (growth >= 50)  growthScore = 8
    else if (growth >= 25)  growthScore = 6
    else if (growth >= 10)  growthScore = 4
    else if (growth >= 0)   growthScore = 2
  } else if (yt_views > 0) {
    growthScore = 5
  }

  const totalScore =
    ytViewsScore + ytSubsScore + ytQualityScore +
    fbReachScore + fbEngagementScore +
    streakScore + frequencyScore + growthScore

  const r = (n) => Math.round(n * 100) / 100

  return {
    yt_views_score:       r(ytViewsScore),
    yt_subs_score:        r(ytSubsScore),
    yt_quality_score:     r(ytQualityScore),
    fb_reach_score:       r(fbReachScore),
    fb_engagement_score:  r(fbEngagementScore),
    streak_score:         r(streakScore),
    frequency_score:      r(frequencyScore),
    growth_score:         r(growthScore),
    total_score:          r(totalScore),
  }
}

/* ── Helpers ── */

const getWeakestArea = (scoreData) => {
  const areas = {
    'YouTube Views':      scoreData.yt_views_score,
    'YouTube Subscribers': scoreData.yt_subs_score,
    'Facebook Reach':     scoreData.fb_reach_score,
    'Posting Regularity': scoreData.streak_score,
    'Content Frequency':  scoreData.frequency_score,
    'Growth Rate':        scoreData.growth_score,
  }
  return Object.entries(areas).sort((a, b) => a[1] - b[1])[0]?.[0] || 'Posting Regularity'
}

const getFallbackSuggestion = (analytics, score) => {
  if ((analytics.posting_streak || 0) < 3) {
    return 'Post content daily to build your streak! Consistent posting is the #1 way to improve your ranking.'
  }
  if ((analytics.yt_videos_this_week || 0) < 2) {
    return 'You posted less than 2 videos this week. Try posting 3-4 short videos (under 60 sec) for better reach and engagement.'
  }
  if ((analytics.yt_views || 0) < 1000) {
    return 'Your YouTube views are growing! Share your videos on WhatsApp groups to get more views quickly.'
  }
  if ((analytics.fb_reach || 0) < 500) {
    return 'Connect your Facebook page to start tracking your reach. Facebook posts with images get 3x more engagement!'
  }
  return 'Great work! Keep posting daily to maintain your streak and improve your ranking further!'
}

/* ── AI suggestion ── */

export const generateAISuggestion = async (analyticsData, scoreData) => {
  if (!CLAUDE_API_KEY) {
    return getFallbackSuggestion(analyticsData, scoreData)
  }

  try {
    const prompt = `
You are a social media coach for political volunteers. Analyze this volunteer's data and give ONE specific, actionable suggestion in 2-3 sentences. Be encouraging. Write in simple English.

Volunteer Analytics:
- YouTube Views: ${analyticsData.yt_views || 0}
- YouTube Subscribers: ${analyticsData.yt_subs || 0}
- Total Videos: ${analyticsData.yt_total_videos || 0}
- Videos This Week: ${analyticsData.yt_videos_this_week || 0}
- Facebook Reach: ${analyticsData.fb_reach || 0}
- Facebook Likes: ${analyticsData.fb_likes || 0}
- Facebook Shares: ${analyticsData.fb_shares || 0}
- Posting Streak: ${analyticsData.posting_streak || 0} days
- Posts This Week: ${scoreData.posts_this_week || 0}

Current Score: ${scoreData.total_score}/100
Current Grade: ${scoreData.grade || 'sparsh'}
Weakest area: ${getWeakestArea(scoreData)}

Give ONE specific tip to improve their weakest area. Keep it under 50 words. Be specific with numbers if possible.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    return data.content?.[0]?.text || getFallbackSuggestion(analyticsData, scoreData)
  } catch (err) {
    console.error('AI suggestion error:', err)
    return getFallbackSuggestion(analyticsData, scoreData)
  }
}

/* ── Main ranking update ── */

export const updateVolunteerRanking = async (volunteerId) => {
  const { data: analytics } = await supabase
    .from('analytics_snapshots')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!analytics) return null

  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)

  const { data: prevAnalytics } = await supabase
    .from('analytics_snapshots')
    .select('yt_views, fb_reach')
    .eq('volunteer_id', volunteerId)
    .lte('snapshot_date', lastWeek.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const scoreData = calculateScore({
    yt_views:         analytics.yt_views        || 0,
    yt_subs:          analytics.yt_subs          || 0,
    yt_total_videos:  analytics.yt_total_videos  || 0,
    fb_reach:         analytics.fb_reach         || 0,
    fb_likes:         analytics.fb_total_likes   || 0,
    fb_shares:        0,
    fb_comments:      analytics.fb_total_comments || 0,
    posting_streak:   analytics.posting_streak   || 0,
    posts_this_week:
      (analytics.yt_videos_this_week || 0) +
      (analytics.fb_posts_this_week  || 0),
    prev_yt_views:    prevAnalytics?.yt_views || 0,
    prev_fb_reach:    prevAnalytics?.fb_reach || 0,
  })

  const suggestion = await generateAISuggestion(analytics, scoreData)

  const weekStart = new Date(
    Date.now() - new Date().getDay() * 86400000
  ).toISOString().split('T')[0]

  const { data: existing } = await supabase
    .from('ranking_scores')
    .select('id, rank')
    .eq('volunteer_id', volunteerId)
    .eq('week_start', weekStart)
    .maybeSingle()

  const rankingData = {
    volunteer_id:     volunteerId,
    week_start:       weekStart,
    ...scoreData,
    yt_views:         analytics.yt_views        || 0,
    yt_subs:          analytics.yt_subs          || 0,
    fb_reach:         analytics.fb_reach         || 0,
    posting_streak:   analytics.posting_streak   || 0,
    posts_this_week:
      (analytics.yt_videos_this_week || 0) +
      (analytics.fb_posts_this_week  || 0),
    ai_suggestion:    suggestion,
    ai_generated_at:  new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  }

  if (existing) {
    rankingData.previous_rank = existing.rank
    await supabase.from('ranking_scores').update(rankingData).eq('id', existing.id)
  } else {
    await supabase.from('ranking_scores').insert(rankingData)
  }

  return { scoreData, suggestion }
}
