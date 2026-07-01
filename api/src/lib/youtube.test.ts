import { describe, it, expect } from 'vitest';
import {
  assertAllowedUrl,
  canonicalPlaylistUrl,
  extractPlaylistId,
  extractVideoId,
  formatDuration,
  groupTranscript,
  mapMetadata,
  mapPlaylistEntries,
  mediaKey,
  parseProxyList,
  parseVtt,
} from './youtube.js';

describe('extractVideoId', () => {
  it('parses watch?v= URLs', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('parses youtu.be short links with query params', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ?si=abc123')).toBe('dQw4w9WgXcQ');
  });
  it('parses embed and shorts URLs', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('accepts a bare 11-char id', () => {
    expect(extractVideoId('dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });
  it('returns null for non-YouTube or empty input', () => {
    expect(extractVideoId('https://example.com/watch?v=foo')).toBeNull();
    expect(extractVideoId('not a url')).toBeNull();
    expect(extractVideoId('')).toBeNull();
  });
});

describe('assertAllowedUrl', () => {
  it('accepts allowlisted hosts and names the source', () => {
    expect(assertAllowedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').source).toBe('youtube');
    expect(assertAllowedUrl('https://youtu.be/dQw4w9WgXcQ').source).toBe('youtube');
    expect(assertAllowedUrl('https://vimeo.com/123456789').source).toBe('vimeo');
    expect(assertAllowedUrl('https://www.tiktok.com/@a/video/123').source).toBe('tiktok');
    expect(assertAllowedUrl('https://x.com/a/status/123').source).toBe('twitter');
  });
  it('rejects non-allowlisted and look-alike hosts', () => {
    expect(() => assertAllowedUrl('https://evil.com/x')).toThrow();
    expect(() => assertAllowedUrl('https://youtube.com.evil.com/x')).toThrow();
  });
  it('rejects non-http(s), localhost, and IP-literal hosts (SSRF guard)', () => {
    expect(() => assertAllowedUrl('file:///etc/passwd')).toThrow();
    expect(() => assertAllowedUrl('http://localhost/x')).toThrow();
    expect(() => assertAllowedUrl('http://169.254.169.254/latest/meta-data')).toThrow();
    expect(() => assertAllowedUrl('not a url')).toThrow();
  });
});

describe('mediaKey', () => {
  it('keys YouTube by its 11-char id across url forms', () => {
    expect(mediaKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('yt:dQw4w9WgXcQ');
    expect(mediaKey('https://youtu.be/dQw4w9WgXcQ?si=x')).toBe('yt:dQw4w9WgXcQ');
    expect(mediaKey('dQw4w9WgXcQ')).toBe('yt:dQw4w9WgXcQ');
  });
  it('namespaces other sources and is stable per normalized url', () => {
    const a = mediaKey('https://vimeo.com/123456789');
    const b = mediaKey('https://vimeo.com/123456789?utm_source=x#frag');
    expect(a).toBe(b);
    expect(a.startsWith('vimeo:')).toBe(true);
    expect(a.length).toBeLessThanOrEqual(64);
  });
  it('throws for unsupported input', () => {
    expect(() => mediaKey('https://evil.com/x')).toThrow();
  });
});

describe('formatDuration', () => {
  it('formats sub-hour durations as M:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(125)).toBe('2:05');
  });
  it('formats hour+ durations as H:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });
});

describe('parseVtt', () => {
  it('parses cues, strips inline tags, and dedupes rolling captions', () => {
    const vtt = [
      'WEBVTT',
      'Kind: captions',
      'Language: en',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'hello world',
      '',
      '00:00:03.000 --> 00:00:05.000',
      'hello world',
      '',
      '00:00:05.000 --> 00:00:07.500',
      '<00:00:05.100><c>this</c> is <c>a test</c>',
      '',
    ].join('\n');
    const entries = parseVtt(vtt);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ text: 'hello world', start: 1, duration: 2 });
    expect(entries[1].text).toBe('this is a test');
    expect(entries[1].start).toBe(5);
    expect(entries[1].duration).toBeCloseTo(2.5);
  });
  it('returns an empty array for header-only content', () => {
    expect(parseVtt('WEBVTT\n\n')).toEqual([]);
  });
  it('keeps the opening cue whose payload starts with a blank placeholder line', () => {
    // YouTube's first auto-caption cue prefixes its text with a single-space
    // line. The opening cue must survive at its real start (0.24) — previously
    // the space line was treated as the cue terminator, dropping it so the
    // transcript began at the second cue (0:02 instead of 0:00).
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.240 --> 00:00:02.230',
      ' ',
      '90<00:00:00.560><c> days</c>',
      '',
      '00:00:02.230 --> 00:00:02.240',
      '90 days',
      '',
      '00:00:02.240 --> 00:00:04.710',
      '90 days',
      'the<00:00:02.480><c> US</c>',
      '',
    ].join('\n');
    const entries = parseVtt(vtt);
    expect(entries[0].text).toBe('90 days');
    expect(entries[0].start).toBeCloseTo(0.24);
    expect(entries[entries.length - 1].text).toBe('90 days the US');
  });
});

describe('groupTranscript', () => {
  it('merges entries into groups of at least chunkSeconds', () => {
    const entries = [
      { text: 'a', start: 0, duration: 10 },
      { text: 'b', start: 30, duration: 10 },
      { text: 'c', start: 70, duration: 10 },
    ];
    const groups = groupTranscript(entries, 60);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ start: 0, text: 'a b' });
    expect(groups[1]).toEqual({ start: 70, text: 'c' });
  });
  it('handles empty input', () => {
    expect(groupTranscript([])).toEqual([]);
  });
});

describe('mapMetadata', () => {
  it('normalizes yt-dlp json into the public shape', () => {
    const raw = {
      id: 'dQw4w9WgXcQ',
      webpage_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Test Title',
      description: 'a description',
      tags: ['alpha', 'beta', 3],
      categories: ['Music'],
      channel: 'Some Channel',
      channel_id: 'UC123',
      channel_follower_count: 1000,
      upload_date: '20251231',
      duration: 212,
      view_count: 500,
      like_count: 50,
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      thumbnails: [{ url: 'https://x/1.jpg', width: 120, height: 90 }],
      chapters: [
        { title: 'Intro', start_time: 0 },
        { title: 'Middle', start_time: 60 },
      ],
    };
    const m = mapMetadata(raw, 'https://youtu.be/dQw4w9WgXcQ');
    expect(m.videoId).toBe('dQw4w9WgXcQ');
    expect(m.title).toBe('Test Title');
    expect(m.tags).toEqual(['alpha', 'beta']); // non-string entries filtered out
    expect(m.uploadDate).toBe('2025-12-31');
    expect(m.durationText).toBe('3:32');
    expect(m.thumbnail?.url).toContain('maxresdefault.jpg');
    expect(m.chapters).toHaveLength(2);
    expect(m.commentCount).toBeNull();
  });
});

describe('parseProxyList', () => {
  it('wraps a single proxy URL in a one-element pool', () => {
    expect(parseProxyList('http://user:pass@host:8080')).toEqual([
      'http://user:pass@host:8080',
    ]);
  });
  it('splits comma- or whitespace-separated pools and trims each entry', () => {
    expect(parseProxyList('http://a:1, http://b:2\nhttp://c:3')).toEqual([
      'http://a:1',
      'http://b:2',
      'http://c:3',
    ]);
  });
  it('returns an empty pool for empty, blank, or undefined input', () => {
    expect(parseProxyList('')).toEqual([]);
    expect(parseProxyList('   ')).toEqual([]);
    expect(parseProxyList(undefined)).toEqual([]);
  });
});

describe('extractPlaylistId', () => {
  it('parses the list= param from watch and playlist URLs', () => {
    expect(
      extractPlaylistId(
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb',
      ),
    ).toBe('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb');
    expect(
      extractPlaylistId('https://www.youtube.com/playlist?list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb'),
    ).toBe('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb');
  });
  it('parses the list= param from a youtu.be short link', () => {
    expect(
      extractPlaylistId('https://youtu.be/dQw4w9WgXcQ?list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb'),
    ).toBe('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb');
  });
  it('accepts a bare channel-uploads (UU) playlist id', () => {
    expect(extractPlaylistId('UUBR8-60-B28hp2BmDPdntcQ')).toBe('UUBR8-60-B28hp2BmDPdntcQ');
  });
  it('returns null for a plain video URL, a bare video id, or junk', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(extractPlaylistId('dQw4w9WgXcQ')).toBeNull(); // 11-char video id, below the length bound
    expect(extractPlaylistId('not a url')).toBeNull();
    expect(extractPlaylistId('')).toBeNull();
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=WL')).toBeNull(); // too short
  });
  it('accepts a playlist URL pasted without a scheme', () => {
    expect(
      extractPlaylistId('www.youtube.com/playlist?list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb'),
    ).toBe('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb');
    expect(
      extractPlaylistId('youtube.com/watch?v=dQw4w9WgXcQ&list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb'),
    ).toBe('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb');
  });
});

describe('canonicalPlaylistUrl', () => {
  it('builds a canonical playlist URL from an id', () => {
    expect(canonicalPlaylistUrl('PLabc123def456')).toBe(
      'https://www.youtube.com/playlist?list=PLabc123def456',
    );
  });
});

describe('mapPlaylistEntries', () => {
  it('maps flat entries, drops invalid ids, floors durations, skips null placeholders', () => {
    const raw = {
      id: 'PLtest',
      title: 'My Playlist',
      playlist_count: 3,
      entries: [
        { id: 'dQw4w9WgXcQ', title: 'First', duration: 212.7 }, // fractional → floored
        { id: 'oHg5SJYRHA0', title: 'Second', duration: null },
        { id: 'bad', title: 'Broken id', duration: 10 }, // invalid id → dropped
        null, // yt-dlp placeholder for an unavailable item → skipped, not a crash
      ],
    };
    const e = mapPlaylistEntries(raw, 'PLtest', 50);
    expect(e.playlistId).toBe('PLtest');
    expect(e.title).toBe('My Playlist');
    expect(e.totalCount).toBe(3);
    expect(e.capped).toBe(false);
    expect(e.entries).toEqual([
      { videoId: 'dQw4w9WgXcQ', title: 'First', duration: 212 },
      { videoId: 'oHg5SJYRHA0', title: 'Second', duration: null },
    ]);
  });
  it('caps entries to maxVideos and flags capped, using playlist_count when present', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      id: `abcdefghij${i}`, // 11 chars
      title: `V${i}`,
      duration: 1,
    }));
    const e = mapPlaylistEntries({ id: 'PLx', title: 'x', playlist_count: 5, entries }, 'PLx', 2);
    expect(e.entries).toHaveLength(2);
    expect(e.totalCount).toBe(5);
    expect(e.capped).toBe(true);
  });
  it('flags capped even when yt-dlp omits playlist_count (via the probed extra entry)', () => {
    // getPlaylistEntries fetches maxVideos+1; here 3 valid entries for maxVideos 2, no count.
    const entries = Array.from({ length: 3 }, (_, i) => ({
      id: `abcdefghij${i}`,
      title: `V${i}`,
      duration: 1,
    }));
    const e = mapPlaylistEntries({ id: 'PLx', title: 'x', entries }, 'PLx', 2);
    expect(e.entries).toHaveLength(2);
    expect(e.capped).toBe(true);
  });
  it('falls back to the requested id and entry count when fields are absent', () => {
    const e = mapPlaylistEntries({ entries: [] }, 'PLfallback', 50);
    expect(e.playlistId).toBe('PLfallback');
    expect(e.title).toBe('');
    expect(e.totalCount).toBe(0);
    expect(e.capped).toBe(false);
    expect(e.entries).toEqual([]);
  });
});
