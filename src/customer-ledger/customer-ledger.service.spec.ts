import { Test, TestingModule } from '@nestjs/testing';
import { CustomerLedgerService } from './customer-ledger.service';

describe('CustomerLedgerService', () => {
  let service: CustomerLedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomerLedgerService],
    }).compile();

    service = module.get<CustomerLedgerService>(CustomerLedgerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
