import { dashboardRepository } from '../../repositories/dashboard.repository'
import { reportRepository } from '../../repositories/report.repository'
import { governorateRepository } from '../../repositories/governorate.repository'
import { fileRepository } from '../../repositories/file.repository'
import { generateReport } from './pdfReport.service'
import { getStorageService } from '../../lib/storage'

export const adminReportService = {
  inspectorWorkload: async (from: string, to: string) => {
    const result = await dashboardRepository.getInspectorWorkload(from, to)
    return (result[0] as Record<string, unknown>)['get_inspector_workload']
  },

  exports: async (page: number, limit: number) => {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      reportRepository.findManyExports(skip, limit),
      reportRepository.countExports(),
    ])
    return { items, total }
  },

  governorates: async () => governorateRepository.findAll(),

  generate: async (performedBy: string, params: {
    reportType: 'performance-summary' | 'contractor-performance'
    regions?: string[]
    contractors?: string[]
    years: number[]
    months?: number[]
  }) => {
    const pdfBuffer = await generateReport(params)

    // Save to storage
    const storage = getStorageService()
    const fileRecord = await fileRepository.create({
      bucket: 'reports',
      s3Key: 'pending',
      mimeType: 'application/pdf',
      category: 'REPORT_PDF',
      uploadStatus: 'UPLOADED',
      fileSize: BigInt(pdfBuffer.length),
      uploadedBy: performedBy,
    })

    const s3Key = storage.buildKey('report_pdf', fileRecord.id, 'report.pdf')
    await fileRepository.updateKey(fileRecord.id, s3Key)
    await fileRepository.confirm(fileRecord.id)
    await storage.upload(s3Key, pdfBuffer, 'application/pdf')

    // Create export record
    const reportTypeEnum = params.reportType === 'performance-summary' ? 'SYSTEM_OVERVIEW' : 'CONTRACTOR_PERFORMANCE'
    await reportRepository.createExport({
      generatedBy: performedBy,
      reportType: reportTypeEnum,
      format: 'PDF',
      fileId: fileRecord.id,
      parametersUsed: JSON.parse(JSON.stringify(params)),
    })

    return { fileId: fileRecord.id, buffer: pdfBuffer }
  },
}
