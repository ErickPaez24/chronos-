package com.chronosabc.reports

import android.content.Context
import android.graphics.pdf.PdfDocument
import android.os.Environment
import android.print.pdf.PrintedPdfDocument
import androidx.core.content.ContextCompat
import com.chronosabc.data.entities.AuthLogEntity
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*

class PdfReportService(private val context: Context) {

    fun generateAuthReport(
        logs: List<AuthLogEntity>,
        start: Long,
        end: Long
    ): File? {
        if (logs.isEmpty()) return null

        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
        val dateRange =
            "${formatter.format(Date(start))} - ${formatter.format(Date(end))}"

        val pdfDocument = PdfDocument()
        val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4
        val page = pdfDocument.startPage(pageInfo)
        val canvas = page.canvas

        val paint = android.graphics.Paint().apply {
            textSize = 14f
            isAntiAlias = true
        }

        var y = 40f
        canvas.drawText("Chronos ABC - Reporte de autenticación", 40f, y, paint)
        y += 20f
        canvas.drawText("Rango: $dateRange", 40f, y, paint)
        y += 30f

        paint.textSize = 12f

        logs.forEach { log ->
            if (y > 800f) {
                pdfDocument.finishPage(page)
                // Para simplicidad, solo 1 página en este ejemplo
                return@forEach
            }
            val line = "${formatter.format(Date(log.timestamp))} - userId=${log.userId} - ${log.method} - ${log.result} - ${log.reason ?: ""}"
            canvas.drawText(line, 40f, y, paint)
            y += 18f
        }

        pdfDocument.finishPage(page)

        val dir = File(
            context.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS),
            "ChronosABC"
        )
        if (!dir.exists()) dir.mkdirs()

        val fileName = "reporte_auth_${System.currentTimeMillis()}.pdf"
        val file = File(dir, fileName)

        FileOutputStream(file).use { out ->
            pdfDocument.writeTo(out)
        }
        pdfDocument.close()

        return file
    }
}
