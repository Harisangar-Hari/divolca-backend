import { Test, TestingModule } from '@nestjs/testing';
import { CashLedgerService } from './cash-ledger.service';

describe('CashLedgerService', () => {
  let service: CashLedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CashLedgerService],
    }).compile();

    service = module.get<CashLedgerService>(CashLedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
