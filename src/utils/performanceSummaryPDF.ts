import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import type { PerformanceSummaryData } from '../services/performanceSummaryReport.service';

const PRIMARY = '#02474E';
const PRIMARY_LIGHT = '#E6F4F5';
const GRAY_100 = '#F3F4F6';
const GRAY_200 = '#E5E7EB';
const GRAY_500 = '#6B7280';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';
const SUCCESS = '#22c55e';
const WARNING = '#f59e0b';
const DANGER = '#ef4444';
const WHITE = '#FFFFFF';

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const CONTENT_W = PAGE_W - MARGIN * 2;

const LOGO_PATH = (() => {
  const candidates = [
    path.join(process.cwd(), 'src/assets/nama-logo.png'),
    path.join(process.cwd(), 'src/assets/nama_logo.png'),
    path.join(__dirname, '../assets/nama-logo.png'),
    path.join(__dirname, '../assets/nama_logo.png'),
    path.join(__dirname, '../../src/assets/nama-logo.png'),
    path.join(__dirname, '../../src/assets/nama_logo.png'),
    path.join(process.cwd(), 'assets/nama-logo.png'),
    path.join(process.cwd(), 'assets/nama_logo.png'),
  ];
  return candidates.find((filePath) => fs.existsSync(filePath)) ?? null;
})();

export function generatePerformanceSummaryPDF(data: PerformanceSummaryData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      autoFirstPage: false,
    });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const fmt = (value: number | null, decimals = 1) => (value != null ? `${value.toFixed(decimals)}%` : '-');
    const scoreColor = (score: number) => (score >= 90 ? SUCCESS : score >= 75 ? PRIMARY : score >= 60 ? WARNING : DANGER);
    const line = (x1: number, y1: number, x2: number, y2: number, color = GRAY_200, width = 0.5) => {
      doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(color).lineWidth(width).stroke();
    };
    const sectionHeader = (title: string, y: number) => {
      doc.save();
      doc.rect(MARGIN, y, 3, 20).fill(PRIMARY);
      doc.rect(MARGIN + 3, y, CONTENT_W - 3, 20).fill(PRIMARY_LIGHT);
      doc.restore();
      doc.fontSize(9.5).fillColor(PRIMARY).font('Helvetica-Bold').text(title, MARGIN + 10, y + 5, {
        lineBreak: false,
      });
    };
    const footer = (pageNum: number) => {
      const y = PAGE_H - 40;
      line(MARGIN, y - 5, PAGE_W - MARGIN, y - 5);
      doc.fontSize(7).fillColor(GRAY_500).font('Helvetica').text(
        'NAMA Water Services - Compliance Inspection System',
        MARGIN,
        y,
        { lineBreak: false }
      );
      doc.text(`Report ID: ${data.reportId}`, 0, y + 10, {
        width: PAGE_W,
        align: 'center',
        lineBreak: false,
      });
      doc.text(`Page ${pageNum}`, MARGIN, y, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
      doc.text('Copyright 2026 NAMA Water Services SAOC', MARGIN, y + 10, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
    };
    const header = () => {
      const headerH = 52;
      doc.save();
      doc.rect(0, 0, PAGE_W, headerH).fill(WHITE);
      doc.rect(0, 0, 4, headerH).fill(PRIMARY);
      if (LOGO_PATH) {
        doc.image(LOGO_PATH, MARGIN, 8, {
          height: 36,
          fit: [90, 36],
        });
      }
      doc.restore();

      doc.fontSize(11).fillColor(PRIMARY).font('Helvetica-Bold').text('NAMA WATER SERVICES', 136, 12, {
        lineBreak: false,
      });
      doc.fontSize(8).fillColor(GRAY_500).font('Helvetica').text('Performance Summary Report', 136, 26, {
        lineBreak: false,
      });

      const dateStr = data.generatedAt.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      doc.fontSize(8).fillColor(GRAY_500).text(`Generated: ${dateStr}`, 0, 12, {
        align: 'right',
        width: PAGE_W - MARGIN,
        lineBreak: false,
      });
      doc.fontSize(7).fillColor(GRAY_500).text('CONFIDENTIAL', 0, 24, {
        align: 'right',
        width: PAGE_W - MARGIN,
        lineBreak: false,
      });

      const badgeW = 80;
      const badgeX = PAGE_W - MARGIN - badgeW;
      doc.save();
      doc.rect(badgeX, 33, badgeW, 13).fill(PRIMARY);
      doc.restore();
      doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold').text('INTERNAL USE ONLY', badgeX, 36, {
        width: badgeW,
        align: 'center',
        lineBreak: false,
      });

      line(0, headerH, PAGE_W, headerH);
    };

    doc.addPage();
    header();

    doc.fontSize(20).fillColor(GRAY_900).font('Helvetica-Bold').text('Performance Summary Report', MARGIN, 76, {
      width: CONTENT_W,
      align: 'center',
      lineBreak: false,
    });
    doc.fontSize(9).fillColor(GRAY_500).font('Helvetica').text(data.filters.periodLabel, MARGIN, 104, {
      width: CONTENT_W,
      align: 'center',
      lineBreak: false,
    });

    sectionHeader('Executive Overview', 130);
    const ov = data.executiveOverview;
    const kpis = [
      { value: fmt(ov.avgScore), sub1: 'All Contractors Avg Score', sub2: 'Target: 90%', color: ov.avgScore != null ? scoreColor(ov.avgScore) : GRAY_700 },
      { value: String(ov.totalWorkOrders), sub1: 'Total Work Orders', sub2: `${ov.inspectedWorkOrders} Inspected, ${ov.pendingWorkOrders} Pending`, color: GRAY_900 },
      { value: String(ov.activeContractors), sub1: 'Active Contractors', sub2: '', color: GRAY_900 },
      { value: String(ov.pendingInspections), sub1: 'Pending Inspections', sub2: `${ov.overdueInspections} Overdue`, color: GRAY_900 },
    ];
    const kpiW = CONTENT_W / 4 - 4;
    const kpiY = 158;
    kpis.forEach((kpi, index) => {
      const x = MARGIN + index * (kpiW + 5.3);
      doc.save();
      doc.rect(x, kpiY, kpiW, 55).strokeColor(GRAY_200).lineWidth(0.5).stroke();
      if (index === 0) doc.rect(x, kpiY, 3, 55).fill(PRIMARY);
      doc.restore();
      doc.fontSize(index === 0 ? 22 : 20).fillColor(kpi.color).font('Helvetica-Bold').text(kpi.value, x + 6, kpiY + 7, {
        width: kpiW - 12,
        lineBreak: false,
      });
      doc.fontSize(7.5).fillColor(GRAY_500).font('Helvetica').text(kpi.sub1, x + 6, kpiY + 32, {
        width: kpiW - 12,
        lineBreak: false,
      });
      if (kpi.sub2) {
        doc.fontSize(7).fillColor(GRAY_500).text(kpi.sub2, x + 6, kpiY + 43, {
          width: kpiW - 12,
          lineBreak: false,
        });
      }
    });

    sectionHeader('Contractor Performance Ranking', 228);
    const cols = {
      rank: { x: MARGIN, w: 18 },
      name: { x: MARGIN + 20, w: 130 },
      cr: { x: MARGIN + 153, w: 55 },
      wo: { x: MARGIN + 211, w: 42 },
      avg: { x: MARGIN + 256, w: 52 },
      chg: { x: MARGIN + 311, w: 55 },
      ins: { x: MARGIN + 369, w: 45 },
      pend: { x: MARGIN + 417, w: 40 },
    };
    const rankingHeaderY = 256;
    doc.save();
    doc.rect(MARGIN, rankingHeaderY, CONTENT_W, 16).fill(PRIMARY);
    doc.restore();
    [
      ['rank', '#'],
      ['name', 'Contractor'],
      ['cr', 'CR #'],
      ['wo', 'Work Orders'],
      ['avg', 'Avg Score'],
      ['chg', 'Score Change'],
      ['ins', 'Inspected'],
      ['pend', 'Pending'],
    ].forEach(([key, label]) => {
      const col = cols[key as keyof typeof cols];
      doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold').text(label, col.x + 2, rankingHeaderY + 4, {
        width: col.w - 4,
        lineBreak: false,
      });
    });
    data.contractorRanking.slice(0, 6).forEach((contractor, index) => {
      const rowY = rankingHeaderY + 18 + index * 17;
      doc.save();
      doc.rect(MARGIN, rowY, CONTENT_W, 16).fill(index % 2 === 0 ? WHITE : GRAY_100);
      doc.restore();
      const scoreCol = contractor.avgScore != null && contractor.avgScore < 90 ? WARNING : GRAY_900;
      const rowValues: Array<[keyof typeof cols, string, string]> = [
        ['rank', String(contractor.rank), GRAY_700],
        ['name', contractor.companyName, GRAY_900],
        ['cr', contractor.crNumber, GRAY_700],
        ['wo', String(contractor.totalWOs), GRAY_700],
        ['avg', fmt(contractor.avgScore), scoreCol],
        ['chg', contractor.scoreChange != null ? `${contractor.scoreChange > 0 ? 'UP' : 'DOWN'} ${Math.abs(contractor.scoreChange).toFixed(1)}%` : '-', GRAY_700],
        ['ins', String(contractor.inspected), GRAY_700],
        ['pend', String(contractor.pending), GRAY_700],
      ];
      rowValues.forEach(([key, value, color]) => {
        const col = cols[key];
        doc.fontSize(7.5).fillColor(color).font(key === 'avg' ? 'Helvetica-Bold' : 'Helvetica').text(value, col.x + 2, rowY + 4, {
          width: col.w - 4,
          lineBreak: false,
        });
      });
    });
    doc.fontSize(7).fillColor(GRAY_500).font('Helvetica-Oblique').text(
      '"Score Change" is shown when previous-period data exists. Rows below target should be reviewed.',
      MARGIN,
      380,
      { width: CONTENT_W }
    );

    sectionHeader('Category-wise Compliance (All Contractors Average)', 404);
    const barNameColW = 120;
    const barLabelColW = 40;
    const barMaxW = CONTENT_W - barNameColW - barLabelColW - 16;
    data.categoryCompliance.slice(0, 4).forEach((category, index) => {
      const rowY = 432 + index * 20;
      const score = category.avgScore;
      const barW = score > 0 ? (score / 100) * barMaxW : 0;
      doc.fontSize(8.5).fillColor(GRAY_700).font('Helvetica').text(category.sectionName, MARGIN, rowY + 3, {
        width: barNameColW,
        lineBreak: false,
      });
      doc.save();
      doc.rect(MARGIN + barNameColW + 4, rowY, barMaxW, 14).fill(GRAY_100);
      if (barW > 0) {
        doc.rect(MARGIN + barNameColW + 4, rowY, barW, 14).fill(scoreColor(score));
      }
      doc.restore();
      doc.fontSize(8.5).fillColor(GRAY_900).font('Helvetica-Bold').text(fmt(score), MARGIN + barNameColW + 4 + barMaxW + 6, rowY + 3, {
        width: barLabelColW,
        lineBreak: false,
      });
    });

    sectionHeader('Score Distribution (All Inspected Work Orders)', 530);
    const bands = [
      { label: '< 75%', value: data.scoreDistribution.below75 },
      { label: '75-79%', value: data.scoreDistribution.s75to79 },
      { label: '80-84%', value: data.scoreDistribution.s80to84 },
      { label: '85-89%', value: data.scoreDistribution.s85to89 },
      { label: '90-94%', value: data.scoreDistribution.s90to94 },
      { label: '95-100%', value: data.scoreDistribution.s95to100 },
    ];
    const histogramMax = Math.max(...bands.map((band) => band.value), 1);
    const colW = CONTENT_W / bands.length;
    const chartTop = 566;
    const chartH = 70;
    const chartBottom = chartTop + chartH;
    bands.forEach((band, index) => {
      const x = MARGIN + index * colW;
      const barHeight = band.value > 0 ? Math.max((band.value / histogramMax) * (chartH - 20), 4) : 0;
      const barY = chartBottom - barHeight;
      const color = index === 0 ? DANGER : index === 1 ? WARNING : index <= 3 ? PRIMARY : SUCCESS;
      if (barHeight > 0) {
        doc.save();
        doc.rect(x + 6, barY, colW - 12, barHeight).fill(color);
        doc.restore();
        doc.fontSize(8).fillColor(GRAY_900).font('Helvetica-Bold').text(String(band.value), x, barY - 12, {
          width: colW,
          align: 'center',
          lineBreak: false,
        });
      }
      doc.fontSize(7).fillColor(GRAY_500).font('Helvetica').text(band.label, x, chartBottom + 4, {
        width: colW,
        align: 'center',
        lineBreak: false,
      });
    });

    footer(1);
    doc.addPage();
    header();

    sectionHeader('Compliance Trend (All Contractors Monthly Average)', 76);
    const trend = data.complianceTrend.filter((entry) => entry.avgScore != null).slice(0, 12);
    const trendTop = 112;
    const trendH = 76;
    const trendBottom = trendTop + trendH;
    if (trend.length >= 1) {
      ['72%', '79%', '86%', '93%', '100%'].forEach((label, index) => {
        const y = trendBottom - (index / 4) * trendH;
        doc.fontSize(6.5).fillColor(GRAY_500).font('Helvetica').text(label, MARGIN, y - 3, { width: 22, lineBreak: false });
        line(MARGIN + 26, y, MARGIN + CONTENT_W, y, GRAY_200, 0.3);
      });
      const targetY = trendBottom - ((90 - 72) / (100 - 72)) * trendH;
      doc.moveTo(MARGIN + 26, targetY).lineTo(MARGIN + CONTENT_W, targetY).strokeColor(GRAY_500).lineWidth(0.5).dash(3, { space: 3 }).stroke();
      doc.undash();
      const points = trend.map((entry, index) => ({
        x: trend.length === 1 ? MARGIN + 28 + (CONTENT_W - 32) / 2 : MARGIN + 28 + (index / (trend.length - 1)) * (CONTENT_W - 32),
        y: trendBottom - (((entry.avgScore ?? 72) - 72) / (100 - 72)) * trendH,
        score: entry.avgScore ?? 0,
        label: entry.monthLabel,
      }));
      for (let index = 1; index < points.length; index += 1) {
        line(points[index - 1].x, points[index - 1].y, points[index].x, points[index].y, PRIMARY, 1.5);
      }
      points.forEach((point) => {
        doc.save();
        doc.circle(point.x, point.y, 3).fill(PRIMARY);
        doc.restore();
        doc.fontSize(7).fillColor(GRAY_700).font('Helvetica-Bold').text(fmt(point.score), point.x - 18, point.y - 13, {
          width: 36,
          align: 'center',
          lineBreak: false,
        });
        doc.fontSize(6.5).fillColor(GRAY_500).font('Helvetica').text(point.label, point.x - 22, trendBottom + 4, {
          width: 44,
          align: 'center',
          lineBreak: false,
        });
      });
    }

    sectionHeader('Per-Category Comparison by Contractor', 220);
    const sectionNames = data.categoryCompliance.map((category) => category.sectionName);
    const shortNames: Record<string, string> = {
      'HSE & Safety': 'HSE & Safety',
      'Technical Installation': 'Technical Install.',
      'Process & Communication': 'Process & Comm.',
      'Site Closure': 'Site Closure',
    };
    const contractorNameW = 125;
    const overallW = 45;
    const sectionColWidth = (CONTENT_W - 170) / Math.max(sectionNames.length, 1);
    const comparisonHeaderY = 248;
    doc.save();
    doc.rect(MARGIN, comparisonHeaderY, CONTENT_W, 20).fill(PRIMARY);
    doc.restore();
    doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold').text('Contractor', MARGIN + 3, comparisonHeaderY + 6, {
      width: contractorNameW - 6,
      lineBreak: false,
    });
    sectionNames.forEach((name, index) => {
      doc.fontSize(6.5).fillColor(WHITE).font('Helvetica-Bold').text(shortNames[name] ?? name, MARGIN + contractorNameW + index * sectionColWidth + 2, comparisonHeaderY + 6, {
        width: sectionColWidth - 4,
        align: 'center',
        lineBreak: false,
      });
    });
    doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold').text('Overall', MARGIN + CONTENT_W - overallW + 2, comparisonHeaderY + 6, {
      width: overallW - 4,
      align: 'center',
      lineBreak: false,
    });
    const comparisonRows = [
      ...data.perCategoryByContractor,
      {
        companyName: 'ALL CONTRACTORS AVG',
        sections: Object.fromEntries(sectionNames.map((name) => [name, data.categoryCompliance.find((category) => category.sectionName === name)?.avgScore ?? null])),
        overall: data.executiveOverview.avgScore,
        isAverage: true,
      },
    ];
    comparisonRows.slice(0, 8).forEach((row: any, index) => {
      const rowY = comparisonHeaderY + 22 + index * 16;
      const isAverage = row.isAverage === true;
      doc.save();
      doc.rect(MARGIN, rowY, CONTENT_W, 15).fill(isAverage ? PRIMARY_LIGHT : index % 2 === 0 ? WHITE : GRAY_100);
      doc.restore();
      doc.fontSize(7.5).fillColor(isAverage ? PRIMARY : GRAY_900).font(isAverage ? 'Helvetica-Bold' : 'Helvetica').text(row.companyName, MARGIN + 3, rowY + 4, {
        width: contractorNameW - 6,
        lineBreak: false,
      });
      sectionNames.forEach((name, sectionIndex) => {
        const score = row.sections[name];
        const color = score != null ? (score < 85 ? WARNING : PRIMARY) : GRAY_500;
        doc.fontSize(7.5).fillColor(color).font('Helvetica-Bold').text(fmt(score), MARGIN + contractorNameW + sectionIndex * sectionColWidth + 2, rowY + 4, {
          width: sectionColWidth - 4,
          align: 'center',
          lineBreak: false,
        });
      });
      const overallColor = row.overall != null ? (row.overall < 85 ? WARNING : PRIMARY) : GRAY_500;
      doc.fontSize(7.5).fillColor(overallColor).font('Helvetica-Bold').text(fmt(row.overall), MARGIN + CONTENT_W - overallW + 2, rowY + 4, {
        width: overallW - 4,
        align: 'center',
        lineBreak: false,
      });
    });

    sectionHeader('Lowest Scoring Checklist Items (All Contractors)', 430);
    const lowHeaderY = 458;
    doc.save();
    doc.rect(MARGIN, lowHeaderY, CONTENT_W, 15).fill(PRIMARY);
    doc.restore();
    doc.fontSize(7).fillColor(WHITE).font('Helvetica-Bold').text('#', MARGIN + 3, lowHeaderY + 4, { width: 15, lineBreak: false });
    doc.text('Checklist Item', MARGIN + 20, lowHeaderY + 4, { width: 240, lineBreak: false });
    doc.text('Category', MARGIN + 265, lowHeaderY + 4, { width: 130, lineBreak: false });
    doc.text('Avg Score %', MARGIN + 400, lowHeaderY + 4, { width: 80, lineBreak: false });
    data.lowestScoringItems.slice(0, 5).forEach((item, index) => {
      const rowY = lowHeaderY + 17 + index * 16;
      const scoreCol = item.avgScore >= 90 ? SUCCESS : item.avgScore >= 75 ? PRIMARY : item.avgScore >= 60 ? WARNING : DANGER;
      doc.save();
      doc.rect(MARGIN, rowY, CONTENT_W, 15).fill(index % 2 === 0 ? WHITE : GRAY_100);
      doc.restore();
      doc.fontSize(7.5).fillColor(GRAY_700).font('Helvetica').text(String(item.rank), MARGIN + 3, rowY + 4, { width: 15, lineBreak: false });
      doc.text(item.itemText, MARGIN + 20, rowY + 4, { width: 240, ellipsis: true, lineBreak: false });
      doc.text(item.sectionName, MARGIN + 265, rowY + 4, { width: 130, lineBreak: false });
      doc.fontSize(7.5).fillColor(scoreCol).font('Helvetica-Bold').text(fmt(item.avgScore), MARGIN + 400, rowY + 4, { width: 80, lineBreak: false });
    });

    footer(2);
    doc.end();
  });
}
