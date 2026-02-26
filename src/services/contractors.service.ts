import { prisma } from '../config/database';

export const getContractorPerformance = async (id: string) => {
  const workOrders = await prisma.workOrder.findMany({
    where: { contractorId: id },
    select: {
      overallScore: true,
      createdAt: true,
      checklist: {
        include: {
          responses: {
            include: {
              item: {
                include: { section: true },
              },
            },
          },
        },
      },
    },
  });

  const totalInspections = workOrders.length;
  const scoreValues = workOrders.map((w) => w.overallScore).filter((s): s is number => s !== null);
  const avgScore = scoreValues.length ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : 0;

  const complianceByCategory: Record<string, { total: number; count: number }> = {};

  for (const workOrder of workOrders) {
    for (const response of workOrder.checklist?.responses || []) {
      const section = response.item.section.name;
      if (!complianceByCategory[section]) {
        complianceByCategory[section] = { total: 0, count: 0 };
      }
      const value = response.rating === 'COMPLIANT' ? 100 : response.rating === 'PARTIAL' ? 67 : 33;
      complianceByCategory[section].total += value;
      complianceByCategory[section].count += 1;
    }
  }

  const formattedCategory = Object.fromEntries(
    Object.entries(complianceByCategory).map(([key, value]) => [key, value.count ? value.total / value.count : 0])
  );

  const recentTrend = workOrders
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(-6)
    .map((w) => ({ month: w.createdAt.toISOString().slice(0, 7), score: w.overallScore || 0 }));

  return {
    totalInspections,
    avgScore,
    complianceByCategory: formattedCategory,
    recentTrend,
  };
};
