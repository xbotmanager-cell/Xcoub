package com.draftmaster.app

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.util.concurrent.Executors

class MainActivity : FlutterActivity() {
    private val channelName = "com.draftmaster.app/video_exporter"
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                if (call.method == "exportMatchVideo") {
                    @Suppress("UNCHECKED_CAST")
                    val args = call.arguments as? Map<String, Any?>
                    if (args == null) {
                        result.error("INVALID_ARGS", "Missing export arguments", null)
                        return@setMethodCallHandler
                    }
                    executor.execute {
                        try {
                            val outPath = renderMatchToMp4(args)
                            mainHandler.post { result.success(outPath) }
                        } catch (e: Exception) {
                            mainHandler.post {
                                result.error("EXPORT_FAILED", e.message ?: "MP4 encoding failed", null)
                            }
                        }
                    }
                } else {
                    result.notImplemented()
                }
            }
    }

    private fun renderMatchToMp4(args: Map<String, Any?>): String {
        val outputPath = args["outputPath"] as String
        val title = args["title"] as? String ?: "DRAFT MASTER"
        val subtitle = args["subtitle"] as? String ?: ""
        val winnerLabel = args["winnerLabel"] as? String ?: ""
        val boardSize = (args["boardSize"] as? Number)?.toInt() ?: 8
        val paletteId = args["paletteId"] as? String ?: "walnut"
        @Suppress("UNCHECKED_CAST")
        val frames = (args["frames"] as? List<Map<String, Any?>>) ?: emptyList()

        val width = 720
        val height = 960
        val fps = 30
        val framesPerMove = 18 // 0.6s per move
        val endHoldFrames = 45 // 1.5s winner banner hold

        val outFile = File(outputPath)
        outFile.parentFile?.mkdirs()
        if (outFile.exists()) outFile.delete()

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, 2_800_000)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }

        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        val inputSurface = codec.createInputSurface()
        codec.start()

        val muxer = MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var trackIndex = -1
        var muxerStarted = false
        val bufferInfo = MediaCodec.BufferInfo()
        var frameIdx = 0L

        fun drainEncoder(endOfStream: Boolean) {
            if (endOfStream) codec.signalEndOfInputStream()
            while (true) {
                val outIdx = codec.dequeueOutputBuffer(bufferInfo, 10_000)
                if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) {
                    if (!endOfStream) break
                } else if (outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (muxerStarted) throw RuntimeException("Format changed twice")
                    trackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                } else if (outIdx >= 0) {
                    val encodedData = codec.getOutputBuffer(outIdx)
                    if (encodedData != null && (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && bufferInfo.size > 0 && muxerStarted) {
                        encodedData.position(bufferInfo.offset)
                        encodedData.limit(bufferInfo.offset + bufferInfo.size)
                        bufferInfo.presentationTimeUs = (frameIdx * 1_000_000L) / fps
                        muxer.writeSampleData(trackIndex, encodedData, bufferInfo)
                    }
                    codec.releaseOutputBuffer(outIdx, false)
                    if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) break
                }
            }
        }

        val palette = when (paletteId) {
            "slate" -> Triple(Color.parseColor("#CBD5E1"), Color.parseColor("#1E293B"), Color.parseColor("#0F172A"))
            "emerald" -> Triple(Color.parseColor("#D1FAE5"), Color.parseColor("#0F5132"), Color.parseColor("#062C1B"))
            "obsidian_brass" -> Triple(Color.parseColor("#D4CFC7"), Color.parseColor("#27272A"), Color.parseColor("#18181B"))
            else -> Triple(Color.parseColor("#E7D5B8"), Color.parseColor("#5C3D28"), Color.parseColor("#2B1B12"))
        }

        val bgPaint = Paint().apply { color = Color.parseColor("#0B0F17") }
        val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor("#F59E0B")
        }
        val lightPaint = Paint().apply { color = palette.first }
        val darkPaint = Paint().apply { color = palette.second }
        val framePaint = Paint().apply { color = palette.third }
        val highlightPaint = Paint().apply { color = Color.argb(115, 245, 158, 11) }
        val whitePiecePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#F5EFE6") }
        val blackPiecePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#1F2430") }
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3f
            color = Color.parseColor("#D97706")
        }

        try {
            val totalSteps = frames.size
            for ((stepIdx, frameData) in frames.withIndex()) {
                val compressed = frameData["boardCompressed"] as? String ?: ""
                val notation = frameData["notation"] as? String ?: ""
                val fromRow = (frameData["fromRow"] as? Number)?.toInt() ?: -1
                val fromCol = (frameData["fromCol"] as? Number)?.toInt() ?: -1
                val toRow = (frameData["toRow"] as? Number)?.toInt() ?: -1
                val toCol = (frameData["toCol"] as? Number)?.toInt() ?: -1
                val isLastStep = stepIdx == totalSteps - 1
                val repeatCount = if (isLastStep) endHoldFrames else framesPerMove

                for (rep in 0 until repeatCount) {
                    val canvas: Canvas = inputSurface.lockCanvas(null)
                    try {
                        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), bgPaint)

                        // Matching DRAFT MASTER geometric Crowned King badge in top-left header
                        val badgeCx = 66f
                        val badgeCy = 76f
                        val badgeOuterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#D97706") }
                        val badgeCorePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.parseColor("#131A26") }
                        val badgeRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            style = Paint.Style.STROKE
                            strokeWidth = 3f
                            color = Color.parseColor("#F59E0B")
                        }
                        canvas.drawCircle(badgeCx, badgeCy, 26f, badgeOuterPaint)
                        canvas.drawCircle(badgeCx, badgeCy, 20f, badgeCorePaint)
                        canvas.drawCircle(badgeCx, badgeCy, 16f, badgeRingPaint)
                        subPaint.textSize = 18f
                        subPaint.textAlign = Paint.Align.CENTER
                        canvas.drawText("K", badgeCx, badgeCy + 6f, subPaint)
                        subPaint.textAlign = Paint.Align.LEFT

                        textPaint.textSize = 28f
                        canvas.drawText("DRAFT MASTER", 104f, 64f, textPaint)
                        subPaint.textSize = 20f
                        canvas.drawText(subtitle, 104f, 96f, subPaint)
                        textPaint.textSize = 18f
                        canvas.drawText(title, 40f, 128f, textPaint)

                        val boardMargin = 40f
                        val boardDim = width - boardMargin * 2
                        val boardTop = 156f
                        canvas.drawRoundRect(
                            RectF(boardMargin - 10f, boardTop - 10f, boardMargin + boardDim + 10f, boardTop + boardDim + 10f),
                            16f,
                            16f,
                            framePaint
                        )

                        val cell = boardDim / boardSize
                        val data = compressed.substringAfter(':', "")
                        var dataIdx = 0

                        for (r in 0 until boardSize) {
                            for (c in 0 until boardSize) {
                                val left = boardMargin + c * cell
                                val top = boardTop + r * cell
                                val isDark = (r + c) % 2 == 1
                                canvas.drawRect(left, top, left + cell, top + cell, if (isDark) darkPaint else lightPaint)

                                if ((r == fromRow && c == fromCol) || (r == toRow && c == toCol)) {
                                    canvas.drawRect(left, top, left + cell, top + cell, highlightPaint)
                                }

                                if (isDark && dataIdx < data.length) {
                                    val ch = data[dataIdx++]
                                    if (ch != '.') {
                                        val cx = left + cell / 2f
                                        val cy = top + cell / 2f
                                        val radius = cell * 0.36f
                                        val isWhitePiece = ch == 'w' || ch == 'W'
                                        val isKing = ch == 'W' || ch == 'B'
                                        canvas.drawCircle(cx, cy, radius, if (isWhitePiece) whitePiecePaint else blackPiecePaint)
                                        if (isKing) {
                                            canvas.drawCircle(cx, cy, radius * 0.72f, strokePaint)
                                            subPaint.textSize = cell * 0.34f
                                            subPaint.textAlign = Paint.Align.CENTER
                                            canvas.drawText("K", cx, cy + cell * 0.12f, subPaint)
                                            subPaint.textAlign = Paint.Align.LEFT
                                        }
                                    }
                                }
                            }
                        }

                        textPaint.textSize = 24f
                        canvas.drawText("Ply $stepIdx/${(totalSteps - 1).coerceAtLeast(0)} · $notation", 40f, boardTop + boardDim + 64f, textPaint)

                        if (isLastStep && winnerLabel.isNotEmpty()) {
                            val bannerPaint = Paint().apply { color = Color.parseColor("#D97706") }
                            canvas.drawRoundRect(
                                RectF(40f, boardTop + boardDim + 90f, width - 40f, boardTop + boardDim + 150f),
                                14f,
                                14f,
                                bannerPaint
                            )
                            textPaint.textSize = 26f
                            textPaint.textAlign = Paint.Align.CENTER
                            canvas.drawText(winnerLabel, width / 2f, boardTop + boardDim + 130f, textPaint)
                            textPaint.textAlign = Paint.Align.LEFT
                        }
                    } finally {
                        inputSurface.unlockCanvasAndPost(canvas)
                    }
                    drainEncoder(false)
                    frameIdx++
                }
            }
            drainEncoder(true)
        } finally {
            codec.stop()
            codec.release()
            inputSurface.release()
            if (muxerStarted) {
                muxer.stop()
            }
            muxer.release()
        }

        return outFile.absolutePath
    }
}
