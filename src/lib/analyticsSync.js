import { supabase } from './supabase'
import { updateVolunteerRanking } from './rankingEngine'

export const syncYouTube = async (volunteerId, channelUrl) => {
  const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

  if (!YT_API_KEY || !channelUrl) {
    console.log('Missing API key or URL')
    return null
  }

  try {
    let handle = channelUrl.trim().replace(/\/$/, '')

    if (handle.includes('@')) {
      handle = handle.split('@')[1].split('/')[0].split('?')[0].trim()
    } else if (handle.includes('/channel/')) {
      handle = handle.split('/channel/')[1].split('/')[0]
    }

    console.log('Fetching for handle:', handle)

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?` +
      `part=statistics,snippet&forHandle=${handle}&key=${YT_API_KEY}`
    )
    const data = await res.json()

    if (data.error) {
      console.error('YT Error:', data.error)
      return null
    }

    if (!data.items?.length) {
      console.log('No channel found')
      return null
    }

    const channel   = data.items[0]
    const stats     = channel.statistics
    const snippet   = channel.snippet
    const channelId = channel.id

    console.log('Channel found:', snippet.title)
    console.log('Views:', stats.viewCount)

    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    let videosThisWeek = 0
    let videosList     = []

    try {
      const vidRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&channelId=${channelId}&type=video&order=date&maxResults=20&` +
        `publishedAfter=${weekAgo.toISOString()}&key=${YT_API_KEY}`
      )
      const vidData = await vidRes.json()

      if (!vidData.error) {
        videosThisWeek = vidData.items?.length || 0
        videosList     = vidData.items || []

        if (videosList.length > 0) {
          const ids = videosList.map(v => v.id.videoId).filter(Boolean).join(',')

          if (ids) {
            const statsRes  = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?` +
              `part=statistics,snippet&id=${ids}&key=${YT_API_KEY}`
            )
            const statsData = await statsRes.json()

            for (const video of statsData.items || []) {
              await supabase.from('yt_videos').upsert({
                volunteer_id:  volunteerId,
                video_id:      video.id,
                title:         video.snippet.title,
                views:         parseInt(video.statistics.viewCount)    || 0,
                likes:         parseInt(video.statistics.likeCount)    || 0,
                comments:      parseInt(video.statistics.commentCount) || 0,
                thumbnail_url: video.snippet.thumbnails?.medium?.url,
                published_at:  video.snippet.publishedAt,
              }, { onConflict: 'volunteer_id,video_id' })
            }
          }
        }
      }
    } catch (vidErr) {
      console.log('Video fetch error:', vidErr)
    }

    const ytData = {
      yt_views:            parseInt(stats.viewCount)       || 0,
      yt_subs:             parseInt(stats.subscriberCount) || 0,
      yt_total_videos:     parseInt(stats.videoCount)      || 0,
      yt_videos_this_week: videosThisWeek,
    }

    console.log('Saving YT data:', ytData)
    return ytData

  } catch (err) {
    console.error('YT sync error:', err)
    return null
  }
}

export const syncAllAnalytics = async (volunteerId) => {
  const { data: accounts } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('volunteer_id', volunteerId)
    .maybeSingle()

  if (!accounts) return null

  let ytData = null
  if (accounts.yt_connected && accounts.youtube_channel_url) {
    ytData = await syncYouTube(volunteerId, accounts.youtube_channel_url)
  }

  const snapshotDate = new Date().toISOString().split('T')[0]

  const analyticsData = {
    volunteer_id:        volunteerId,
    snapshot_date:       snapshotDate,
    yt_views:            ytData?.yt_views            || 0,
    yt_subs:             ytData?.yt_subs             || 0,
    yt_total_videos:     ytData?.yt_total_videos     || 0,
    yt_videos_this_week: ytData?.yt_videos_this_week || 0,
    last_updated:        new Date().toISOString(),
  }

  const { data: existing } = await supabase
    .from('analytics_snapshots')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .eq('snapshot_date', snapshotDate)
    .maybeSingle()

  if (existing) {
    await supabase.from('analytics_snapshots')
      .update(analyticsData).eq('id', existing.id)
  } else {
    await supabase.from('analytics_snapshots').insert(analyticsData)
  }

  const totalScore =
    ((analyticsData.yt_views || 0) * 0.40) +
    ((analyticsData.yt_videos_this_week || 0) * 100)

  const { data: weekScore } = await supabase
    .from('weekly_scores')
    .select('id')
    .eq('volunteer_id', volunteerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (weekScore) {
    await supabase.from('weekly_scores')
      .update({ total_score: Math.round(totalScore) }).eq('id', weekScore.id)
  } else {
    await supabase.from('weekly_scores').insert({
      volunteer_id: volunteerId,
      week_start:   snapshotDate,
      total_score:  Math.round(totalScore),
      grade:        'sparsh',
    })
  }

  // Update ranking after sync
  await updateVolunteerRanking(volunteerId)

  return analyticsData
}
