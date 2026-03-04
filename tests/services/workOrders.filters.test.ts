import { listWorkOrders } from '../../src/services/workOrders.service';

const mockFindMany = jest.fn();
const mockCount = jest.fn();
const mockTransaction = jest.fn();

jest.mock('../../src/config/database', () => ({
  prisma: {
    workOrder: {
      findMany: (...args: any[]) => mockFindMany(...args),
      count: (...args: any[]) => mockCount(...args),
    },
    $transaction: (...args: any[]) => mockTransaction(...args),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockFindMany.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockTransaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
});

describe('workOrders list filters', () => {
  test('supports scalar status', async () => {
    await listWorkOrders({ status: 'APPROVED', page: 1, limit: 50 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['APPROVED'] },
        }),
      })
    );
  });

  test('supports array status', async () => {
    await listWorkOrders({ status: ['APPROVED', 'SUBMITTED'], page: 1, limit: 50 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['APPROVED', 'SUBMITTED'] },
        }),
      })
    );
  });

  test('supports comma-separated status', async () => {
    await listWorkOrders({ status: 'APPROVED,SUBMITTED', page: 1, limit: 50 });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['APPROVED', 'SUBMITTED'] },
        }),
      })
    );
  });

  test('supports year + month combinations with UTC windows', async () => {
    await listWorkOrders({ year: ['2026'], month: ['2'], page: 1, limit: 50 });
    expect(mockFindMany).toHaveBeenCalledWith(
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

  test('empty arrays/scalars are ignored', async () => {
    await listWorkOrders({
      status: ['', '  '],
      year: '',
      month: [],
      page: 1,
      limit: 50,
    });
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  test('combined with search filters and pagination', async () => {
    await listWorkOrders({
      status: ['APPROVED'],
      searchContractor: 'Acme',
      searchInspector: 'Ahmed',
      page: 2,
      limit: 10,
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['APPROVED'] },
          contractor: expect.any(Object),
          inspector: expect.any(Object),
        }),
        skip: 10,
        take: 10,
      })
    );
  });
});
