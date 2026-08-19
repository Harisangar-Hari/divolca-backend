import { Test, TestingModule } from '@nestjs/testing';
import { ChequeDashboardService } from './cheque-dashboard.service';

describe('ChequeDashboardService', () => {
  let service: ChequeDashboardService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChequeDashboardService],
    }).compile();

    service = module.get<ChequeDashboardService>(ChequeDashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
