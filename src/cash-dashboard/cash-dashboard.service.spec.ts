import { Test, TestingModule } from '@nestjs/testing';
import { CashDashboardService } from './cash-dashboard.service';

describe('CashDashboardService', () => {
  let service: CashDashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashDashboardService],
    }).compile();

    service = module.get<CashDashboardService>(CashDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
