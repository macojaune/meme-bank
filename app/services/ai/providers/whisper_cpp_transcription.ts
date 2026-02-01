import type {
  AITranscriptionService,
  TranscriptionResult,
  TranscriptionOptions,
} from '../ai_interfaces.js'
import aiConfig from '../ai_config.js'
import drive from '@adonisjs/drive/services/main'
import { exec } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { extname } from 'node:path'

/**
 * Whisper.cpp implementation of the transcription service
 * Uses whisper.cpp CLI for fast local transcription
 */
export class WhisperCppTranscriptionService implements AITranscriptionService {
  private modelPath: string
  private whisperPath: string
  private supportedExtensions = [
    '.mp4',
    '.mp3',
    '.wav',
    '.m4a',
    '.webm',
    '.ogg',
    '.mov',
    '.avi',
    '.mkv',
    '.flac',
  ]

  constructor() {
    // Paths inside the Docker container
    this.modelPath = process.env.WHISPER_MODEL_PATH || '/models/ggml-base.bin'
    this.whisperPath = process.env.WHISPER_CLI_PATH || '/usr/local/bin/whisper-cli'
  }

  async transcribe(filePath: string, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    let tempFilePath: string | null = null
    let tempAudioPath: string | null = null

    try {
      // Step 1: Download file from S3/MinIO to temp location
      console.log(`[Whisper] Downloading ${filePath} from S3...`)
      tempFilePath = await this.downloadFromS3(filePath)
      console.log(`[Whisper] Downloaded to ${tempFilePath}`)

      // Step 2: Validate file
      const validation = this.validateFile(tempFilePath)
      if (!validation.valid) {
        return {
          text: '',
          language: options?.language || 'auto',
          error: validation.error,
        }
      }

      // Step 3: Extract audio from video using ffmpeg (whisper needs audio only)
      const tempDir = tmpdir()
      const audioId = uuidv4()
      tempAudioPath = join(tempDir, `${audioId}.wav`)

      console.log(`[Whisper] Extracting audio to ${tempAudioPath}...`)
      await new Promise<void>((resolve, reject) => {
        const ffmpegCmd = `ffmpeg -i "${tempFilePath}" -vn -ar 16000 -ac 1 -c:a pcm_s16le "${tempAudioPath}" -y 2>&1`
        exec(ffmpegCmd, { timeout: 120000 }, (error, _stdout, stderr) => {
          if (error) {
            console.error('[Whisper] FFmpeg error:', stderr)
            reject(error)
          } else {
            resolve()
          }
        })
      })
      console.log(`[Whisper] Audio extracted successfully`)

      // Step 4: Build whisper.cpp command - use stdout for text output
      const language = options?.language || 'fr'
      // Use -nt for no timestamps, capture text directly to stdout
      const cmd = `${this.whisperPath} -f "${tempAudioPath}" -m "${this.modelPath}" -l ${language} -nt 2>/dev/null`

      console.log(`[Whisper] Running transcription...`)
      console.log(`[Whisper] Command: ${cmd}`)

      // Step 5: Execute whisper.cpp and capture stdout
      const fullText = await new Promise<string>((resolve, reject) => {
        exec(cmd, { timeout: 300000, encoding: 'utf8' }, (error, stdout, stderr) => {
          if (error) {
            console.error('[Whisper] Execution error:', stderr)
            reject(error)
          } else {
            // Clean up the output (remove newlines and extra spaces)
            const text = stdout.trim().replace(/\s+/g, ' ')
            resolve(text)
          }
        })
      })

      // Get duration using ffprobe
      const duration = await this.getAudioDuration(tempAudioPath)

      console.log(`[Whisper] Transcription complete: ${fullText.length} chars`)

      return {
        text: fullText,
        language: language,
        segments: undefined, // TODO: Parse timestamps if needed
        duration: duration,
      }
    } catch (error) {
      console.error('[Whisper] Transcription error:', error)
      return {
        text: '',
        language: options?.language || 'auto',
        error: `Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    } finally {
      // Step 8: Cleanup temp files
      await this.cleanup(tempFilePath, tempAudioPath)
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check whisper binary exists
      await fs.access(this.whisperPath)

      // Check model file exists
      await fs.access(this.modelPath)

      return { healthy: true }
    } catch (error) {
      return {
        healthy: false,
        message: `Whisper.cpp not properly installed. Binary: ${this.whisperPath}, Model: ${this.modelPath}`,
      }
    }
  }

  getSupportedLanguages(): string[] {
    return aiConfig.supportedLanguages
  }

  validateFile(filePath: string): { valid: boolean; error?: string } {
    const ext = extname(filePath).toLowerCase()

    if (!this.supportedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `Unsupported file format: ${ext}. Supported: ${this.supportedExtensions.join(', ')}`,
      }
    }

    return { valid: true }
  }

  /**
   * Download file from S3/MinIO to temp location
   */
  private async downloadFromS3(s3Path: string): Promise<string> {
    const tempDir = tmpdir()
    const fileId = uuidv4()
    const ext = extname(s3Path) || '.mp4'
    const tempFilePath = join(tempDir, `${fileId}${ext}`)

    try {
      // Get file from MinIO/S3
      const fileBuffer = await drive.use('spaces').getBytes(s3Path)
      await fs.writeFile(tempFilePath, fileBuffer)
      return tempFilePath
    } catch (error) {
      throw new Error(
        `Failed to download ${s3Path} from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get audio duration using ffprobe or fallback
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    try {
      // Try ffprobe if available
      const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
      const result = await new Promise<string>((resolve, reject) => {
        exec(cmd, (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout.trim())
        })
      })
      return parseFloat(result) || 0
    } catch {
      // Fallback: return 0 if ffprobe not available
      return 0
    }
  }

  /**
   * Cleanup temp files
   */
  private async cleanup(...files: (string | null)[]) {
    for (const file of files) {
      if (file) {
        try {
          await fs.unlink(file)
          // Also try to delete .json file if it exists
          try {
            await fs.unlink(`${file}.json`)
          } catch {
            // Ignore if doesn't exist
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
}
