package com.chronosabc.ui.admin

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chronosabc.data.repository.LogRepository
import com.chronosabc.reports.PdfReportService
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class ReportsViewModel(app: Application) : AndroidViewModel(app) {
    private val logRepo = LogRepository(app)
    private val pdfService = PdfReportService(app)

    var dateFromText by mutableStateOf("")
    var dateToText by mutableStateOf("")
    var statusMessage by mutableStateOf<String?>(null)
    var loading by mutableStateOf(false)

    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    private fun parseDate(dateStr: String): Long? {
        return try {
            dateFormat.parse(dateStr.trim())?.time
        } catch (e: Exception) {
            null
        }
    }

    fun generateReport() {
        viewModelScope.launch {
            loading = true
            statusMessage = null
            try {
                val from = parseDate(dateFromText)
                val to = parseDate(dateToText)
                if (from == null || to == null) {
                    statusMessage = "Fechas inválidas. Usa formato YYYY-MM-DD."
                    return@launch
                }
                if (to < from) {
                    statusMessage = "La fecha 'hasta' no puede ser menor que 'desde'."
                    return@launch
                }

                val logs = logRepo.getAuthLogs(from, to)
                if (logs.isEmpty()) {
                    statusMessage = "No hay registros en ese rango."
                    return@launch
                }

                val file = pdfService.generateAuthReport(logs, from, to)
                statusMessage = if (file != null) {
                    "Reporte generado: ${file.absolutePath}"
                } else {
                    "Error al generar el reporte."
                }
            } catch (e: Exception) {
                statusMessage = "Error: ${e.message}"
            } finally {
                loading = false
            }
        }
    }
}

@Composable
fun ReportsScreen() {
    val context = LocalContext.current
    val vm = remember { ReportsViewModel(context.applicationContext as Application) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(8.dp)
    ) {
        Text("Reportes de autenticación", style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.height(8.dp))

        Text("Rango de fechas (formato: YYYY-MM-DD)")
        Spacer(Modifier.height(4.dp))

        OutlinedTextField(
            value = vm.dateFromText,
            onValueChange = { vm.dateFromText = it },
            label = { Text("Desde") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value = vm.dateToText,
            onValueChange = { vm.dateToText = it },
            label = { Text("Hasta") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(16.dp))

        Button(
            onClick = { vm.generateReport() },
            enabled = !vm.loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Generar PDF")
        }

        Spacer(Modifier.height(16.dp))

        vm.statusMessage?.let {
            Text(it)
        }
    }
}
