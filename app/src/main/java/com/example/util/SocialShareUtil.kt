package com.example.util

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.widget.Toast
import androidx.core.content.FileProvider
import com.example.model.LotteryCatalogItem
import java.io.File
import java.io.FileOutputStream

object SocialShareUtil {

    fun generateSummaryBitmap(
        context: Context,
        title: String,
        dateText: String,
        periodLabel: String,
        items: List<LotteryCatalogItem>
    ): Bitmap {
        val width = 1080
        val headerHeight = 280
        val rowHeight = 90
        val footerHeight = 120
        val totalHeight = headerHeight + (items.size * rowHeight) + footerHeight

        val bitmap = Bitmap.createBitmap(width, totalHeight.coerceAtLeast(600), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        // Background
        val bgPaint = Paint().apply {
            color = Color.parseColor("#0F172A")
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), totalHeight.toFloat(), bgPaint)

        // Header Gradient Banner
        val headerGradient = LinearGradient(
            0f, 0f, width.toFloat(), 0f,
            intArrayOf(Color.parseColor("#B45309"), Color.parseColor("#F59E0B"), Color.parseColor("#D97706")),
            null,
            Shader.TileMode.CLAMP
        )
        val headerPaint = Paint().apply {
            shader = headerGradient
            style = Paint.Style.FILL
        }
        canvas.drawRect(0f, 0f, width.toFloat(), headerHeight.toFloat(), headerPaint)

        // Header Title
        val titlePaint = Paint().apply {
            color = Color.parseColor("#020617")
            textSize = 52f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText(title, width / 2f, 90f, titlePaint)

        // Period & Date Badge
        val subPaint = Paint().apply {
            color = Color.parseColor("#1E293B")
            textSize = 36f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("$periodLabel • $dateText", width / 2f, 155f, subPaint)

        // Table Header Row in Header banner
        val colHeaderBgPaint = Paint().apply {
            color = Color.parseColor("#020617")
            alpha = 180
            style = Paint.Style.FILL
        }
        canvas.drawRect(40f, 195f, (width - 40).toFloat(), 260f, colHeaderBgPaint)

        val colLabelPaint = Paint().apply {
            color = Color.parseColor("#F8FAFC")
            textSize = 30f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        canvas.drawText("รายการหวย", 70f, 240f, colLabelPaint)
        colLabelPaint.textAlign = Paint.Align.CENTER
        canvas.drawText("3 ตัวบน", 680f, 240f, colLabelPaint)
        canvas.drawText("2 ตัวล่าง", 920f, 240f, colLabelPaint)

        // Draw Lottery Items
        var currentY = headerHeight.toFloat() + 20f

        val rowDividerPaint = Paint().apply {
            color = Color.parseColor("#1E293B")
            strokeWidth = 2f
        }
        val textPaint = Paint().apply {
            color = Color.parseColor("#F8FAFC")
            textSize = 34f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val subNamePaint = Paint().apply {
            color = Color.parseColor("#94A3B8")
            textSize = 24f
            isAntiAlias = true
        }

        val badgeGoldPaint = Paint().apply {
            color = Color.parseColor("#F59E0B")
            style = Paint.Style.FILL
        }
        val badgeGreenPaint = Paint().apply {
            color = Color.parseColor("#10B981")
            style = Paint.Style.FILL
        }
        val badgeDarkText = Paint().apply {
            color = Color.parseColor("#020617")
            textSize = 36f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }
        val badgeWhiteText = Paint().apply {
            color = Color.WHITE
            textSize = 36f
            isAntiAlias = true
            typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
            textAlign = Paint.Align.CENTER
        }

        items.forEachIndexed { index, item ->
            val rowTop = currentY
            val rowBottom = rowTop + rowHeight

            // Alternating subtle row bg
            if (index % 2 == 1) {
                val altBg = Paint().apply { color = Color.parseColor("#141E33") }
                canvas.drawRect(40f, rowTop - 10f, (width - 40).toFloat(), rowBottom - 10f, altBg)
            }

            // Flag and Name
            textPaint.textAlign = Paint.Align.LEFT
            val displayName = "${item.flag} ${item.name}"
            canvas.drawText(displayName, 60f, rowTop + 45f, textPaint)

            // Top3 Badge
            val top3Text = item.top3.ifBlank { if (item.status == "drawn") "---" else "รอผล" }
            val top3Rect = RectF(590f, rowTop + 5f, 770f, rowTop + 65f)
            canvas.drawRoundRect(top3Rect, 16f, 16f, badgeGoldPaint)
            canvas.drawText(top3Text, 680f, rowTop + 48f, badgeDarkText)

            // Bottom2 Badge
            val bottom2Text = item.bottom2.ifBlank { if (item.status == "drawn") "--" else "รอผล" }
            val bottom2Rect = RectF(830f, rowTop + 5f, 1010f, rowTop + 65f)
            canvas.drawRoundRect(bottom2Rect, 16f, 16f, badgeGreenPaint)
            canvas.drawText(bottom2Text, 920f, rowTop + 48f, badgeWhiteText)

            // Row divider line
            canvas.drawLine(40f, rowBottom - 10f, (width - 40).toFloat(), rowBottom - 10f, rowDividerPaint)

            currentY += rowHeight
        }

        // Footer Branding
        val footerPaint = Paint().apply {
            color = Color.parseColor("#64748B")
            textSize = 28f
            isAntiAlias = true
            textAlign = Paint.Align.CENTER
        }
        canvas.drawText("✦ ระบบแจ้งเตือนผลหวยอัตโนมัติ • Lottery Alert Pro ✦", width / 2f, totalHeight - 45f, footerPaint)

        return bitmap
    }

    fun shareBitmap(context: Context, bitmap: Bitmap, title: String) {
        try {
            val cachePath = File(context.cacheDir, "images")
            cachePath.mkdirs()
            val file = File(cachePath, "lottery_summary_${System.currentTimeMillis()}.png")
            val stream = FileOutputStream(file)
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            stream.close()

            val contentUri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_TEXT, "📊 $title\nดูผลหวยฉบับเต็มได้ที่แอป Lottery Alert")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(Intent.createChooser(shareIntent, "แชร์ภาพสรุปผลหวย"))
        } catch (e: Exception) {
            Toast.makeText(context, "ไม่สามารถแชร์รูปภาพได้: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    fun copyTextToClipboard(context: Context, label: String, text: String) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val clip = ClipData.newPlainText(label, text)
        clipboard.setPrimaryClip(clip)
        Toast.makeText(context, "คัดลอกเรียบร้อยแล้ว: $label", Toast.LENGTH_SHORT).show()
    }
}
