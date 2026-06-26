import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

ffmpeg.setFfmpegPath(ffmpegPath.path.replace('app.asar', 'app.asar.unpacked'));
ffmpeg.setFfprobePath(ffprobePath.path.replace('app.asar', 'app.asar.unpacked'));

export interface ProbeResult {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
}

export interface TimelineClip {
  id: string;
  src: string;
  startTime: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  type: 'video' | 'audio' | 'caption';
  captionText?: string;
  volume?: number;
  speed?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface ExportOptions {
  outputPath: string;
  resolution: '1080p' | '4k' | '720p';
  format: 'mp4' | 'mov';
  fps: number;
  onProgress?: (percent: number) => void;
}

export async function probeVideo(filePath: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams.find((s) => s.codec_type === 'video');
      const audioStream = data.streams.find((s) => s.codec_type === 'audio');
      const duration = data.format.duration ?? 0;
      const fpsStr = videoStream?.r_frame_rate ?? '30/1';
      const [num, den] = fpsStr.split('/').map(Number);
      resolve({
        duration: Number(duration),
        width: videoStream?.width,
        height: videoStream?.height,
        fps: den ? num / den : 30,
        hasAudio: !!audioStream,
      });
    });
  });
}

export async function getThumbnail(filePath: string, timeSeconds = 0): Promise<string> {
  const outDir = path.join(os.tmpdir(), 'aicuts-thumbs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${uuidv4()}.jpg`);

  return new Promise((resolve) => {
    ffmpeg(filePath)
      .seekInput(timeSeconds)
      .frames(1)
      .output(outFile)
      .on('end', () => resolve(outFile))
      .on('error', () => resolve(''))
      .run();
  });
}

export async function exportProject(
  clips: TimelineClip[],
  options: ExportOptions,
): Promise<void> {
  const videoClips = clips.filter((c) => c.type === 'video');
  const captionClips = clips.filter((c) => c.type === 'caption');

  if (videoClips.length === 0) throw new Error('No video clips to export');

  const resMap = { '720p': '1280x720', '1080p': '1920x1080', '4k': '3840x2160' };
  const resolution = resMap[options.resolution];

  // Build trimmed segment temp files
  const tmpDir = path.join(os.tmpdir(), `aicuts-export-${uuidv4()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const segmentPaths: string[] = [];

  for (const clip of videoClips) {
    const effectiveDuration = clip.duration - clip.trimStart - clip.trimEnd;
    const segPath = path.join(tmpDir, `seg_${uuidv4()}.mp4`);
    await trimClipToFile(clip.src, clip.trimStart, effectiveDuration, segPath, resolution, options.fps, {
      speed: clip.speed,
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
    });
    segmentPaths.push(segPath);
  }

  // Concatenate all segments
  const concatListPath = path.join(tmpDir, 'concat.txt');
  const concatContent = segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  await concatSegments(
    concatListPath,
    options.outputPath,
    captionClips,
    options.onProgress,
  );

  // Cleanup temp files
  for (const seg of segmentPaths) fs.unlink(seg, () => {});
  fs.unlink(concatListPath, () => {});
  fs.rmdir(tmpDir, () => {});
}

function buildAtempo(speed: number): string {
  const filters: string[] = [];
  let s = speed;
  while (s > 2.0) { filters.push('atempo=2.0'); s /= 2.0; }
  while (s < 0.5) { filters.push('atempo=0.5'); s /= 0.5; }
  if (Math.abs(s - 1.0) > 0.001) filters.push(`atempo=${s.toFixed(4)}`);
  return filters.length > 0 ? filters.join(',') : '';
}

function trimClipToFile(
  src: string,
  trimStart: number,
  duration: number,
  outPath: string,
  resolution: string,
  fps: number,
  opts?: { speed?: number; fadeIn?: number; fadeOut?: number },
): Promise<void> {
  const speed = opts?.speed ?? 1;
  const outputDuration = duration / speed;
  const fadeIn = opts?.fadeIn ?? 0;
  const fadeOut = opts?.fadeOut ?? 0;

  const vfParts: string[] = [
    `scale=${resolution}:force_original_aspect_ratio=decrease`,
    `pad=${resolution}:(ow-iw)/2:(oh-ih)/2`,
  ];
  if (Math.abs(speed - 1) > 0.001) {
    vfParts.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
  }
  if (fadeIn > 0) vfParts.push(`fade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) vfParts.push(`fade=t=out:st=${Math.max(0, outputDuration - fadeOut).toFixed(3)}:d=${fadeOut}`);

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(src)
      .seekInput(trimStart)
      .duration(duration)
      .videoFilters(vfParts.join(','))
      .fps(fps)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset fast', '-crf 18', '-movflags +faststart']);

    const atempo = buildAtempo(speed);
    if (atempo) cmd = cmd.audioFilters(atempo);

    cmd.output(outPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

function concatSegments(
  concatListPath: string,
  outputPath: string,
  captionClips: TimelineClip[],
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f concat', '-safe 0']);

    // Burn in captions as subtitle overlay
    if (captionClips.length > 0) {
      const srtPath = buildSrtFile(captionClips);
      cmd = cmd
        .input(srtPath)
        .videoFilters(`subtitles='${srtPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
    }

    cmd
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-preset fast', '-crf 18', '-movflags +faststart', '-c copy'])
      .output(outputPath)
      .on('progress', (prog) => {
        if (onProgress && prog.percent != null) onProgress(Math.round(prog.percent));
      })
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

function buildSrtFile(captionClips: TimelineClip[]): string {
  const srtPath = path.join(os.tmpdir(), `aicuts-captions-${uuidv4()}.srt`);
  let srt = '';
  captionClips.forEach((clip, i) => {
    const start = toSrtTime(clip.startTime);
    const end = toSrtTime(clip.startTime + (clip.duration - clip.trimStart - clip.trimEnd));
    srt += `${i + 1}\n${start} --> ${end}\n${clip.captionText ?? ''}\n\n`;
  });
  fs.writeFileSync(srtPath, srt);
  return srtPath;
}

function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
