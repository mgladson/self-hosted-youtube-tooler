import { describe, it, expect } from 'vitest';
import {
  extractVideoId,
  formatDuration,
  groupTranscript,
  mapMetadata,
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
