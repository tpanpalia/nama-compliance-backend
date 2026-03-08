import PDFDocument from 'pdfkit';

type PdfWorkOrder = {
  reference?: string | null;
  status?: string | null;
  overallScore?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  site?: {
    name?: string | null;
  } | null;
};

type PdfSummary = {
  total?: number;
  completed?: number;
  submitted?: number;
  avgScore?: number | null;
};

type PdfPayload = {
  reportType?: string;
  subject?: string;
  period?: string;
  workOrders?: PdfWorkOrder[];
  summary?: PdfSummary;
};

type InspectionEvidence = {
  id?: string;
  type?: string;
  s3Url?: string | null;
  capturedAt?: Date | string | null;
  isLocationFlagged?: boolean;
};

type InspectionResponse = {
  rating?: string | null;
  comment?: string | null;
};

type InspectionTemplateItem = {
  id: string;
  text: string;
  weight: number;
};

type InspectionTemplateSection = {
  name: string;
  weight: number;
  items: InspectionTemplateItem[];
};

type InspectionSectionScore = {
  name: string;
  score: number;
  rated: number;
  total: number;
};

type InspectionPdfPayload = {
  workOrder: {
    reference: string;
    status: string;
    overallScore: number | null;
    scheduledDate: Date | string | null;
    submittedAt: Date | string | null;
    site: {
      name: string;
      location: string;
    };
    contractor: {
      companyName: string;
      crNumber: string;
    } | null;
    inspector: {
      displayName: string;
      isActive: boolean;
    } | null;
  };
  template: {
    sections: InspectionTemplateSection[];
  } | null;
  evidenceByItem: Record<string, { contractor: InspectionEvidence[]; inspector: InspectionEvidence[] }>;
  responseByItem: Record<string, InspectionResponse | undefined>;
  summary: {
    total: number;
    compliant: number;
    partial: number;
    nonCompliant: number;
  };
  sectionScores: InspectionSectionScore[];
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ensurePageSpace(doc: PDFKit.PDFDocument, requiredHeight = 30): void {
  if (doc.y + requiredHeight > 720) {
    doc.addPage();
  }
}

function drawFooter(doc: PDFKit.PDFDocument, pageNumber: number, totalPages: number): void {
  const page = doc.page;
  doc
    .fontSize(8)
    .fillColor('#AAAAAA')
    .font('Helvetica')
    .text(
      `Nama Water Services - Confidential - Page ${pageNumber} of ${totalPages}`,
      40,
      page.height - 40,
      { align: 'center', width: 515 }
    );
}

export function buildSimplePdf(payload: PdfPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc
      .fontSize(20)
      .fillColor('#02474E')
      .font('Helvetica-Bold')
      .text('NAMA WATER SERVICES', { align: 'center' });

    doc
      .fontSize(14)
      .fillColor('#333333')
      .font('Helvetica')
      .text('Compliance Inspection Report', { align: 'center' });

    doc.moveDown();
    doc
      .fontSize(10)
      .fillColor('#666666')
      .text(
        `Generated: ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`,
        { align: 'center' }
      );

    doc.moveDown(2);
    doc
      .fontSize(16)
      .fillColor('#02474E')
      .font('Helvetica-Bold')
      .text(payload.reportType ?? 'Report', { align: 'center' });

    doc
      .fontSize(12)
      .fillColor('#444444')
      .font('Helvetica')
      .text(`Subject: ${payload.subject ?? '-'}`, { align: 'center' })
      .text(`Period: ${payload.period ?? '-'}`, { align: 'center' });

    doc.moveDown(2);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#02474E').lineWidth(1).stroke();
    doc.moveDown();

    const workOrders = payload.workOrders ?? [];
    if (workOrders.length > 0) {
      doc
        .fontSize(13)
        .fillColor('#02474E')
        .font('Helvetica-Bold')
        .text('Work Orders');

      doc.moveDown(0.5);

      const colX = {
        ref: 40,
        site: 130,
        status: 300,
        score: 390,
        date: 460,
      };

      ensurePageSpace(doc, 24);
      doc.save();
      doc.rect(40, doc.y, 515, 18).fill('#02474E');
      const headerY = doc.y + 4;
      doc
        .fillColor('#FFFFFF')
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Reference', colX.ref, headerY)
        .text('Site', colX.site, headerY)
        .text('Status', colX.status, headerY)
        .text('Score', colX.score, headerY)
        .text('Date', colX.date, headerY);
      doc.restore();
      doc.y += 18;

      workOrders.forEach((workOrder, index) => {
        ensurePageSpace(doc, 22);
        const rowY = doc.y;
        const bg = index % 2 === 0 ? '#F8FAFA' : '#FFFFFF';

        doc.save();
        doc.rect(40, rowY, 515, 18).fill(bg);
        doc.restore();

        const score = typeof workOrder.overallScore === 'number' ? `${workOrder.overallScore.toFixed(1)}%` : 'N/A';
        const date = formatDate(workOrder.submittedAt || workOrder.approvedAt || null);

        doc
          .fontSize(8)
          .fillColor('#333333')
          .font('Helvetica')
          .text(workOrder.reference ?? '-', colX.ref, rowY + 5, { width: 85, ellipsis: true })
          .text(workOrder.site?.name ?? '-', colX.site, rowY + 5, { width: 165, ellipsis: true })
          .text(workOrder.status ?? '-', colX.status, rowY + 5, { width: 85, ellipsis: true })
          .text(score, colX.score, rowY + 5, { width: 65 })
          .text(date, colX.date, rowY + 5, { width: 95, ellipsis: true });

        doc.y = rowY + 18;
      });
    } else {
      doc
        .fontSize(11)
        .fillColor('#888888')
        .font('Helvetica')
        .text('No work orders found for the selected filters.', { align: 'center' });
    }

    if (payload.summary) {
      doc.moveDown(2);
      ensurePageSpace(doc, 100);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
      doc.moveDown();

      doc
        .fontSize(13)
        .fillColor('#02474E')
        .font('Helvetica-Bold')
        .text('Summary');

      doc.moveDown(0.5);
      const items: Array<[string, string]> = [
        ['Total Work Orders', String(payload.summary.total ?? 0)],
        ['Completed', String(payload.summary.completed ?? 0)],
        ['Submitted', String(payload.summary.submitted ?? 0)],
        [
          'Average Score',
          typeof payload.summary.avgScore === 'number' ? `${payload.summary.avgScore.toFixed(1)}%` : 'N/A',
        ],
      ];

      for (const [label, value] of items) {
        doc
          .fontSize(10)
          .fillColor('#333333')
          .font('Helvetica-Bold')
          .text(`${label}: `, 40, doc.y, { continued: true, width: 200 })
          .font('Helvetica')
          .text(value);
      }
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      drawFooter(doc, i - range.start + 1, totalPages);
    }

    doc.end();
  });
}

function formatLooseDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function generateWorkOrderInspectionPdf(params: InspectionPdfPayload): Promise<Buffer> {
  const { workOrder, template, evidenceByItem, responseByItem } = params;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const PRIMARY = '#02474E';
    const LIGHT_BG = '#F0F9FA';
    const TEXT_DARK = '#111827';
    const TEXT_GREY = '#6B7280';
    const TEAL_LIGHT = '#E6F4F5';

    const drawPageHeader = () => {
      doc.save();
      doc.rect(0, 0, doc.page.width, 60).fill(PRIMARY);
      doc.restore();
      doc
        .fontSize(16)
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .text('NAMA WATER SERVICES', 40, 18, {
          align: 'center',
          width: doc.page.width - 80,
        });
      doc
        .fontSize(9)
        .fillColor('#D1FAE5')
        .font('Helvetica')
        .text('Compliance Inspection Report', 40, 38, {
          align: 'center',
          width: doc.page.width - 80,
      });
      doc.y = 75;
    };

    const PAGE_BOTTOM = doc.page.height - 60;

    const checkPageBreak = (neededHeight = 60) => {
      if (doc.y + neededHeight > PAGE_BOTTOM) {
        doc.addPage();
        drawPageHeader();
      }
    };

    const drawStatistics = () => {
      checkPageBreak(240);

      doc
        .fontSize(12)
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text('Inspection Summary', 40);

      doc.moveDown(0.5);

      const stats = [
        { label: 'Total Items', value: String(params.summary.total), color: PRIMARY, bg: TEAL_LIGHT },
        { label: 'Compliant', value: String(params.summary.compliant), color: '#059669', bg: '#ECFDF5' },
        { label: 'Partial', value: String(params.summary.partial), color: '#D97706', bg: '#FFFBEB' },
        { label: 'Non-Compliant', value: String(params.summary.nonCompliant), color: '#DC2626', bg: '#FEF2F2' },
      ];

      const boxW = 118;
      const boxH = 52;
      const startX = 40;
      const startY = doc.y;
      const gap = 9;

      stats.forEach((stat, index) => {
        const x = startX + index * (boxW + gap);
        doc.save();
        doc.rect(x, startY, boxW, boxH).fillAndStroke(stat.bg, '#E5E7EB');
        doc.restore();
        doc
          .fontSize(20)
          .fillColor(stat.color)
          .font('Helvetica-Bold')
          .text(stat.value, x, startY + 7, { width: boxW, align: 'center' });
        doc
          .fontSize(7.5)
          .fillColor(TEXT_GREY)
          .font('Helvetica')
          .text(stat.label, x, startY + 33, { width: boxW, align: 'center' });
      });

      doc.y = startY + boxH + 14;

      if (workOrder.overallScore != null) {
        checkPageBreak(45);
        const score = workOrder.overallScore;
        const band = score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : score >= 60 ? 'FAIR' : 'POOR';
        const bandColor =
          band === 'EXCELLENT' ? '#059669' : band === 'GOOD' ? '#02474E' : band === 'FAIR' ? '#D97706' : '#DC2626';

        const bannerY = doc.y;
        doc.save();
        doc.rect(40, bannerY, 515, 36).fill(bandColor);
        doc.restore();
        doc
          .fontSize(12)
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .text(`Overall Compliance Score: ${score.toFixed(1)}%   -   ${band}`, 40, bannerY + 11, {
            width: 515,
            align: 'center',
          });
        doc.y = bannerY + 50;
      }

      doc.moveDown(1);
      checkPageBreak(30 + params.sectionScores.length * 32);
      doc
        .fontSize(10)
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text('Compliance by Section');

      doc.moveDown(0.4);

      const chartX = 40;
      const labelW = 155;
      const trackW = 290;
      const barH = 18;
      const barGap = 10;

      for (const section of params.sectionScores ?? []) {
        checkPageBreak(barH + barGap + 5);
        const rowY = doc.y;
        const score = section.score ?? 0;
        const filled = (score / 100) * trackW;
        const barColor = score >= 90 ? '#059669' : score >= 75 ? '#02474E' : score >= 60 ? '#D97706' : '#DC2626';

        doc
          .fontSize(8)
          .fillColor('#374151')
          .font('Helvetica')
          .text(section.name, chartX, rowY + 6, { width: labelW, ellipsis: true });

        doc.save();
        doc.rect(chartX + labelW, rowY, trackW, barH).fill('#F3F4F6');
        if (filled > 0) {
          doc.rect(chartX + labelW, rowY, filled, barH).fill(barColor);
        }
        doc.restore();

        doc
          .fontSize(8)
          .fillColor('#111827')
          .font('Helvetica-Bold')
          .text(`${score.toFixed(1)}%`, chartX + labelW + trackW + 8, rowY + 5);

        doc.y = rowY + barH + barGap;
      }

      doc.moveDown(1);
    };

    drawPageHeader();

    doc
      .fontSize(14)
      .fillColor(PRIMARY)
      .font('Helvetica-Bold')
      .text(`Work Order: ${workOrder.reference}`, 40);

    const STATUS_LABELS: Record<string, string> = {
      PENDING: 'Unassigned',
      ASSIGNED: 'WIP at Site',
      IN_PROGRESS: 'WIP at Site',
      SUBMITTED: 'Submitted for Inspection',
      INSPECTION_COMPLETED: 'Inspection Complete',
    };

    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor(TEXT_GREY)
      .font('Helvetica')
      .text(
        `Status: ${STATUS_LABELS[workOrder.status] ?? workOrder.status}  |  Site: ${workOrder.site.name}  |  Location: ${workOrder.site.location}`
      );

    if (workOrder.overallScore != null) {
      doc.moveDown(0.4);
      doc
        .fontSize(11)
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text(`Final Compliance Score: ${workOrder.overallScore.toFixed(1)}%`);
    }

    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .fillColor(TEXT_GREY)
      .font('Helvetica')
      .text(
        `Scheduled: ${formatLooseDate(workOrder.scheduledDate)}   Submitted: ${formatLooseDate(workOrder.submittedAt)}   Generated: ${formatLooseDate(new Date())}`
      );

    doc.moveDown(0.8);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(PRIMARY).lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    checkPageBreak(80);
    const infoY = doc.y;
    const colStartY = infoY;
    doc
      .fontSize(9)
      .fillColor(PRIMARY)
      .font('Helvetica-Bold')
      .text('Contractor Information', 40, colStartY);
    doc
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .text(workOrder.contractor?.companyName ?? '-', 40, colStartY + 14, { width: 220 });
    doc
      .fontSize(8)
      .fillColor(TEXT_GREY)
      .font('Helvetica')
      .text(`CR: ${workOrder.contractor?.crNumber ?? '-'}`, 40, colStartY + 26, { width: 220 });
    const leftY = doc.y;

    doc
      .fontSize(9)
      .fillColor(PRIMARY)
      .font('Helvetica-Bold')
      .text('Assigned Inspector', 300, colStartY);
    doc
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .font('Helvetica-Bold')
      .text(workOrder.inspector?.displayName ?? 'Not Assigned', 300, colStartY + 14, { width: 220 });
    doc
      .fontSize(8)
      .fillColor(TEXT_GREY)
      .font('Helvetica')
      .text(workOrder.inspector?.isActive ? 'Status: Active' : 'Status: -', 300, colStartY + 26, { width: 220 });
    const rightY = doc.y;

    doc.y = Math.max(leftY, rightY) + 10;
    doc.moveDown(0.5);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E5E7EB').lineWidth(0.5).stroke();
    doc.moveDown(0.8);

    drawStatistics();

    for (const section of template?.sections ?? []) {
      checkPageBreak(46);

      doc.save();
      doc.rect(40, doc.y, 515, 22).fill(LIGHT_BG);
      doc.restore();
      const sectionY = doc.y + 4;
      doc
        .fontSize(10)
        .fillColor(PRIMARY)
        .font('Helvetica-Bold')
        .text(section.name, 44, sectionY);
      doc
        .fontSize(8)
        .fillColor(TEXT_GREY)
        .font('Helvetica')
        .text(`Weight: ${Math.round(section.weight * 100)}%`, 450, sectionY, {
          align: 'right',
          width: 100,
        });
      doc.y += 26;

      for (const item of section.items) {
        checkPageBreak(86);

        const evidence = evidenceByItem[item.id] ?? { contractor: [], inspector: [] };
        const response = responseByItem[item.id] ?? null;

        doc
          .fontSize(9)
          .fillColor(TEXT_DARK)
          .font('Helvetica-Bold')
          .text(item.text, 44);

        doc.moveDown(0.3);
        const colY = doc.y;

        doc
          .fontSize(8)
          .fillColor(PRIMARY)
          .font('Helvetica-Bold')
          .text('Contractor Evidence', 44, colY);
        doc
          .fontSize(8)
          .fillColor(TEXT_GREY)
          .font('Helvetica')
          .text(`${evidence.contractor.length} file(s) uploaded`, 44, colY + 12);

        if (evidence.contractor.length > 0) {
          doc.text(
            `Photos: ${evidence.contractor.filter((entry) => entry.type === 'PHOTO').length}  Videos: ${evidence.contractor.filter((entry) => entry.type === 'VIDEO').length}  ${evidence.contractor.some((entry) => entry.isLocationFlagged) ? 'Location flag(s) present' : ''}`,
            44,
            colY + 24,
            { width: 220 }
          );
        }
        const leftColumnEndY = doc.y;

        doc
          .fontSize(8)
          .fillColor('#1D4ED8')
          .font('Helvetica-Bold')
          .text('Inspector Response', 300, colY);

        const RATING_TEXT: Record<string, string> = {
          COMPLIANT: 'Compliant',
          PARTIAL: 'Partial Compliance',
          NON_COMPLIANT: 'Non-Compliant',
        };

        doc
          .fontSize(8)
          .fillColor(TEXT_GREY)
          .font('Helvetica')
          .text(response?.rating ? RATING_TEXT[response.rating] ?? response.rating : 'Not yet rated', 300, colY + 12);

        if (response?.comment) {
          doc.text(`Comment: ${response.comment}`, 300, colY + 24, {
            width: 250,
            ellipsis: true,
          });
        }
        const rightColumnEndY = doc.y;

        doc.y = Math.max(leftColumnEndY, rightColumnEndY) + 10;
        doc.moveTo(44, doc.y).lineTo(551, doc.y).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
        doc.moveDown(0.5);
      }

      doc.moveDown(0.8);
    }

    const range = doc.bufferedPageRange();
    const totalPages = range.count;
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc
        .fontSize(7)
        .fillColor('#9CA3AF')
        .font('Helvetica')
        .text(
          `Nama Water Services - Confidential - Generated ${new Date().toLocaleString()} - Page ${i - range.start + 1} of ${totalPages}`,
          40,
          doc.page.height - 35,
          {
            align: 'center',
            width: doc.page.width - 80,
          }
        );
    }

    doc.end();
  });
}
