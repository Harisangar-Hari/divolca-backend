import { Test, TestingModule } from '@nestjs/testing';
import { CustomerLedgerController } from './customer-ledger.controller';

describe('CustomerLedgerController', () => {
  let controller: CustomerLedgerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerLedgerController],
    }).compile();

    controller = module.get<CustomerLedgerController>(CustomerLedgerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
