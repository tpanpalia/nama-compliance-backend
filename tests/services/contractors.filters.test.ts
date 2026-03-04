import { listContractors } from '../../src/services/contractors.service';

const mockContractorFindMany = jest.fn();
const mockContractorCount = jest.fn();
const mockWorkOrderCount = jest.fn();
const mockWorkOrderAggregate = jest.fn();
const mockWorkOrderAggregateMonthly = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../src/config/database', () => ({
  prisma: {
    contractor: {
      findMany: (...args: any[]) => mockContractorFindMany(...args),
      count: (...args: any[]) => mockContractorCount(...args),
    },
    workOrder: {
      count: (...args: any[]) => mockWorkOrderCount(...args),
      aggregate: (...args: any[]) => {
        if (args?.[0]?.where?.contractorId) return mockWorkOrderAggregateMonthly(...args);
        return mockWorkOrderAggregate(...args);
      },
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

const contractors = [
  {
    id: '1',
    contractorId: 'C-00001',
    companyName: 'Active Co',
    email: 'a@test.com',
    phone: '12345678',
    address: 'Muscat',
    contactName: 'A',
    crNumber: 'CR-1',
    isActive: true,
    createdAt: new Date('2025-01-10T00:00:00.000Z'),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockContractorFindMany.mockResolvedValue(contractors);
  mockContractorCount.mockResolvedValue(1);
  mockWorkOrderCount.mockResolvedValue(0);
  mockWorkOrderAggregate.mockResolvedValue({ _avg: { overallScore: 0 } });
  mockWorkOrderAggregateMonthly.mockResolvedValue({ _avg: { overallScore: 0 } });
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
});

describe('contractors list filters', () => {
  test('supports status=active', async () => {
    await listContractors({ status: 'active', page: 1, limit: 20 });
    expect(mockContractorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      })
    );
  });

  test('supports status=inactive', async () => {
    await listContractors({ status: ['inactive'], page: 1, limit: 20 });
    expect(mockContractorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: false }),
      })
    );
  });

  test('both active+inactive does not constrain status', async () => {
    await listContractors({ status: ['active', 'inactive'], page: 1, limit: 20 });
    const call = mockContractorFindMany.mock.calls[0]?.[0];
    expect(call.where?.isActive).toBeUndefined();
  });

  test('supports year/month filtering with UTC windows', async () => {
    await listContractors({
      status: ['active', 'inactive'],
      year: ['2026'],
      month: ['2'],
      page: 1,
      limit: 20,
    });

    expect(mockContractorFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                {
                  createdAt: {
                    gte: new Date(Date.UTC(2026, 1, 1, 0, 0, 0)),
                    lt: new Date(Date.UTC(2026, 2, 1, 0, 0, 0)),
                  },
                },
              ],
            },
          ],
        }),
      })
    );
  });
});
